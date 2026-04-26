/**
 * main.ts — Abumrium Electron main process entry point.
 *
 * Startup sequence:
 * 1. Register abumrium:// scheme (MUST be before app.whenReady)
 * 2. Wait for app ready
 * 3. Init sessions, install protocol handler
 * 4. Create BrowserWindow + load renderer
 * 5. Init TabManager with one default tab
 * 6. Install header rules + request inspector listeners
 * 7. Register IPC handlers
 * 8. Register global shortcuts
 */
import { app, BrowserWindow, globalShortcut, Menu } from 'electron'
import { join } from 'path'
import { registerScheme, installProtocolHandler } from './protocol/abumriumProtocol'
import { SessionManager } from './sessions/SessionManager'
import { TabManager } from './tabs/TabManager'
import { HeaderRulesManager } from './network/HeaderRules'
import { RequestInspector } from './network/RequestInspector'
import { registerIpcHandlers } from './ipc/handlers'
import { storeGet } from './storage/store'
import { IPC } from '../shared/constants'
import { parseAddressBarInput } from '../shared/utils/urlParser'
import icon from '../../resources/icon.png?asset'
import { app, BrowserWindow, globalShortcut, Menu, nativeImage } from 'electron' // 1. أضف nativeImage هنا
import { join } from 'path'
import iconAsset from '../../resources/icon.png?asset'


// ─── 1. Register scheme BEFORE app ready ──────────────────────────────────────
registerScheme()

// ─── 2. Wait for app ready ────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Remove default menu bar (we have our own UI)
  Menu.setApplicationMenu(null)

  // ─── 3. Init sessions ─────────────────────────────────────────────────────
  const sessionManager = SessionManager.getInstance()
  await sessionManager.initAll()

  // ─── 4. Create BrowserWindow ──────────────────────────────────────────────
  const win = createWindow()

  // ─── 5. Install protocol handler ──────────────────────────────────────────
  const rendererDist = join(__dirname, '../renderer')
  installProtocolHandler(rendererDist)

  // ─── 6. Init TabManager + first tab ───────────────────────────────────────
  const tabManager = new TabManager(win)
  const settings = storeGet('settings')
  tabManager.createTab(parseAddressBarInput(settings.homePage, settings.searchEngine), settings.defaultContainer)

  // Reposition web content on window resize
  win.on('resize', () => tabManager.onResize())

  // ─── 7. Header rules & request inspector ──────────────────────────────────
  const headerRules = HeaderRulesManager.getInstance()
  headerRules.setRules(storeGet('headerRules'))
  headerRules.installListeners()

  const inspector = RequestInspector.getInstance()
  inspector.setWindow(win)
  inspector.installListeners()

  // ─── 8. IPC handlers ──────────────────────────────────────────────────────
  registerIpcHandlers(win, tabManager)

  // ─── 9. Global shortcuts ──────────────────────────────────────────────────
  const isMac = process.platform === 'darwin'
  const cmdCtrl = isMac ? 'Command' : 'Control'

  globalShortcut.register(`${cmdCtrl}+Shift+P`, () => {
    win.webContents.send('command-palette:open')
  })

  globalShortcut.register(`${cmdCtrl}+T`, () => {
    win.webContents.send('shortcut:new-tab')
  })

  globalShortcut.register(`${cmdCtrl}+W`, () => {
    win.webContents.send('shortcut:close-tab')
  })

  globalShortcut.register(`${cmdCtrl}+R`, () => {
    win.webContents.send('shortcut:reload')
  })

  globalShortcut.register('F5', () => {
    win.webContents.send('shortcut:reload')
  })

  globalShortcut.register(`${cmdCtrl}+L`, () => {
    win.webContents.send('shortcut:focus-address')
  })

  globalShortcut.register('Alt+Left', () => {
    win.webContents.send('shortcut:go-back')
  })

  globalShortcut.register('Alt+Right', () => {
    win.webContents.send('shortcut:go-forward')
  })

  globalShortcut.register(`${cmdCtrl}+Shift+I`, () => {
    win.webContents.send('shortcut:devtools')
  })

  loadRenderer(win)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) app.emit('ready')
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

// ─── Window factory ───────────────────────────────────────────────────────────
function createWindow(): BrowserWindow {
  const isMac = process.platform === 'darwin'
  const isWin = process.platform === 'win32'

  // 2. تحويل الأيقونة لـ NativeImage لضمان توافقها مع لينكس
  const appIcon = nativeImage.createFromPath(iconAsset)

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#07090D',

    // 👇 التعديل هنا: استخدم الكائن appIcon
    icon: appIcon,

    titleBarStyle: isMac ? 'hiddenInset' : 'default',
  })

  return win
}

const win = new BrowserWindow({
  width: 1400,
  height: 900,
  minWidth: 900,
  minHeight: 600,
  backgroundColor: '#07090D',
  // On macOS: hidden titlebar with traffic lights
  // On Windows/Linux: use the default frame
  titleBarStyle: isMac ? 'hiddenInset' : 'default',
  ...(isWin ? {
    titleBarOverlay: {
      color: '#0D1117',
      symbolColor: '#E6EAF2',
      height: 36,
    },
  } : {}),
  ...(isMac ? { trafficLightPosition: { x: 12, y: 10 } } : {}),
  frame: true,
  webPreferences: {
    // SECURITY: renderer is our trusted UI shell
    nodeIntegration: false,
    contextIsolation: true,
    webSecurity: true,
    sandbox: false, // preload needs access to contextBridge
    preload: join(__dirname, '../preload/index.js'),
  },
})

return win
}

function loadRenderer(win: BrowserWindow): void {
  if (process.env['ELECTRON_RENDERER_URL']) {
    // Development: served by Vite dev server
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    // Production: load built HTML
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}
