/**
 * TabManager — manages WebContentsViews for browser tabs.
 *
 * Architecture:
 * - Each tab is a WebContentsView positioned inside the main BrowserWindow's contentView.
 * - The React renderer (loaded in the main BrowserWindow's own webContents) renders the chrome UI.
 * - Tab web content overlays the chrome's content area via absolute positioning set by main.
 * - Only the active tab's view has non-zero bounds; others are hidden.
 *
 * Security: all WebContentsViews are created with:
 *   - contextIsolation: true
 *   - nodeIntegration: false (they load external web pages)
 *   - webSecurity: true
 */
import { WebContentsView, BrowserWindow, Menu, clipboard, shell } from 'electron'
import type { Tab, ContainerId } from '../../shared/types'
import { IPC, LAYOUT, isInternalUrl, internalRouteFromUrl } from '../../shared/constants'
import { SessionManager } from '../sessions/SessionManager'
import { RequestInspector } from '../network/RequestInspector'
import { addRecentUrl } from '../storage/store'

// Simple uuid-like generator without the 'uuid' package dependency
function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

interface ManagedTab {
  data: Tab
  view?: WebContentsView  // undefined for internal pages
}

export class TabManager {
  private win: BrowserWindow
  private tabs: Map<string, ManagedTab> = new Map()
  private activeTabId: string | null = null
  private sessions = SessionManager.getInstance()

  constructor(win: BrowserWindow) {
    this.win = win
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  createTab(url: string = 'abumrium://home', containerId: ContainerId = 'default'): string {
    const id = genId()
    const internal = isInternalUrl(url)
    const tabData: Tab = {
      id,
      url,
      title: internal ? this.titleForInternal(url) : 'New Tab',
      isLoading: !internal,
      isInternal: internal,
      internalRoute: internal ? internalRouteFromUrl(url) : undefined,
      containerId,
      canGoBack: false,
      canGoForward: false,
    }

    const managedTab: ManagedTab = { data: tabData }
    this.tabs.set(id, managedTab)

    if (!internal) {
      managedTab.view = this.createWebContentsView(tabData)
    }

    this.switchToTab(id)
    return id
  }

  closeTab(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab) return

    this.destroyView(tab)

    this.tabs.delete(tabId)

    // If closing the active tab, switch to adjacent tab
    if (this.activeTabId === tabId) {
      const remaining = [...this.tabs.keys()]
      if (remaining.length > 0) {
        this.switchToTab(remaining[remaining.length - 1])
      } else {
        this.activeTabId = null
        this.createTab() // always keep at least one tab
      }
    }
  }

  switchToTab(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab) return

    // Hide all other views
    for (const [tid, t] of this.tabs) {
      if (tid !== tabId && t.view) {
        t.view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
      }
    }

    this.activeTabId = tabId

    // Show this tab's view (if it's an external page)
    if (tab.view) {
      this.positionActiveView(tab.view)
    }

    this.notifyRenderer()
  }

  navigate(tabId: string, url: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab) return

    const internal = isInternalUrl(url)

    if (internal) {
      // Transition to an internal page: destroy web view if exists
      this.destroyView(tab)
      tab.data.url = url
      tab.data.isInternal = true
      tab.data.internalRoute = internalRouteFromUrl(url)
      tab.data.isLoading = false
      tab.data.title = this.titleForInternal(url)
      tab.data.canGoBack = false
      tab.data.canGoForward = false
      this.notifyRenderer()
      return
    }

    // Navigating to external URL
    tab.data.isInternal = false
    tab.data.internalRoute = undefined
    tab.data.url = url
    tab.data.title = url
    tab.data.isLoading = true
    tab.data.error = undefined

    if (!tab.view) {
      // Was showing internal page — create a new view
      tab.view = this.createWebContentsView(tab.data)
      if (tabId === this.activeTabId) this.positionActiveView(tab.view)
      this.notifyRenderer()
      return
    }

    this.notifyRenderer()
    tab.view.webContents.loadURL(url).catch(err => {
      tab.data.error = err.message
      tab.data.isLoading = false
      this.notifyRenderer()
    })
  }

  reload(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab || !tab.view) return
    tab.view.webContents.reload()
  }

  stopLoading(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab || !tab.view) return
    if (tab.view.webContents.isLoading()) {
      tab.view.webContents.stop()
    }
    tab.data.isLoading = false
    this.notifyRenderer()
  }

  goBack(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab?.view?.webContents.canGoBack()) return
    tab.view.webContents.goBack()
  }

  goForward(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab?.view?.webContents.canGoForward()) return
    tab.view.webContents.goForward()
  }

  openDevTools(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (tab?.view) tab.view.webContents.openDevTools()
  }

  clearSiteData(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab || tab.data.isInternal) return
    try {
      const sess = this.sessions.getSession(tab.data.containerId)
      sess.clearStorageData({ origin: new URL(tab.data.url).origin }).catch(() => {})
    } catch { /* ignore invalid/empty URLs */ }
  }

  async clearContainerData(containerId: ContainerId): Promise<void> {
    await this.sessions.clearContainer(containerId)
    for (const tab of this.tabs.values()) {
      if (tab.data.containerId === containerId && tab.view && !tab.view.webContents.isDestroyed()) {
        tab.view.webContents.reloadIgnoringCache()
      }
    }
    this.notifyRenderer()
  }

  /** Called when the window resizes — reposition the active view */
  onResize(): void {
    if (!this.activeTabId) return
    const tab = this.tabs.get(this.activeTabId)
    if (tab?.view && !tab.data.isInternal) this.positionActiveView(tab.view)
  }

  /** Called from IPC with the renderer-measured content area bounds */
  setContentBounds(x: number, y: number, width: number, height: number): void {
    if (!this.activeTabId) return
    const tab = this.tabs.get(this.activeTabId)
    if (tab?.view && !tab.data.isInternal) {
      tab.view.setBounds({ x, y, width, height })
    }
  }

  getActiveTabId(): string | null { return this.activeTabId }

  getAllTabs(): Tab[] {
    return [...this.tabs.values()].map(t => t.data)
  }

  getTab(tabId: string): Tab | undefined {
    return this.tabs.get(tabId)?.data
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private createWebContentsView(tabData: Tab): WebContentsView {
    const sess = this.sessions.getSession(tabData.containerId)
    const view = new WebContentsView({
      webPreferences: {
        // SECURITY: no node integration for web pages
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        session: sess,
      },
    })

    this.win.contentView.addChildView(view)
    const webContentsId = view.webContents.id
    RequestInspector.getInstance().registerTab(tabData.id, webContentsId)
    view.webContents.once('destroyed', () => {
      RequestInspector.getInstance().unregisterTab(webContentsId)
    })
    this.wireViewEvents(view, tabData.id)

    view.webContents.loadURL(tabData.url).catch(err => {
      const tab = this.tabs.get(tabData.id)
      if (tab) {
        tab.data.error = err.message
        tab.data.isLoading = false
        this.notifyRenderer()
      }
    })

    // Keep browser-like links inside Abumrium; hand non-web protocols to the OS.
    view.webContents.setWindowOpenHandler(({ url }) => {
      if (/^(https?:|abumrium:)/i.test(url)) {
        this.createTab(url, tabData.containerId)
      } else {
        shell.openExternal(url).catch(() => {})
      }
      return { action: 'deny' }
    })

    view.webContents.on('context-menu', (_event, params) => {
      const wc = view.webContents
      const template: Electron.MenuItemConstructorOptions[] = [
        { label: 'Back', enabled: wc.canGoBack(), click: () => wc.goBack() },
        { label: 'Forward', enabled: wc.canGoForward(), click: () => wc.goForward() },
        { label: 'Reload', click: () => wc.reload() },
        { type: 'separator' },
        {
          label: 'Open Link in New Tab',
          visible: Boolean(params.linkURL),
          click: () => this.createTab(params.linkURL, tabData.containerId),
        },
        {
          label: 'Copy Link',
          visible: Boolean(params.linkURL),
          click: () => clipboard.writeText(params.linkURL),
        },
        {
          label: 'Copy Page URL',
          click: () => clipboard.writeText(wc.getURL()),
        },
        { type: 'separator' },
        { label: 'Inspect Element', click: () => wc.inspectElement(params.x, params.y) },
      ]
      Menu.buildFromTemplate(template).popup({ window: this.win })
    })

    return view
  }

  private wireViewEvents(view: WebContentsView, tabId: string): void {
    const wc = view.webContents

    wc.on('did-start-loading', () => {
      const tab = this.tabs.get(tabId)
      if (tab) { tab.data.isLoading = true; this.notifyRenderer() }
    })

    wc.on('did-stop-loading', () => {
      const tab = this.tabs.get(tabId)
      if (!tab) return
      tab.data.isLoading = false
      tab.data.url = wc.getURL()
      tab.data.title = wc.getTitle() || wc.getURL()
      tab.data.canGoBack = wc.canGoBack()
      tab.data.canGoForward = wc.canGoForward()
      tab.data.error = undefined
      addRecentUrl(tab.data.url)
      this.notifyRenderer()
    })

    wc.on('page-title-updated', (_e, title) => {
      const tab = this.tabs.get(tabId)
      if (tab) { tab.data.title = title; this.notifyRenderer() }
    })

    wc.on('page-favicon-updated', (_e, favicons) => {
      const tab = this.tabs.get(tabId)
      if (tab) { tab.data.favicon = favicons[0]; this.notifyRenderer() }
    })

    wc.on('did-fail-load', (_e, code, description, url, isMainFrame) => {
      if (code === -3 || isMainFrame === false) return
      const tab = this.tabs.get(tabId)
      if (!tab) return
      tab.data.isLoading = false
      tab.data.error = `${description} — ${url}`
      this.notifyRenderer()
    })

    wc.on('did-navigate', (_e, url) => {
      const tab = this.tabs.get(tabId)
      if (!tab) return
      tab.data.url = url
      tab.data.canGoBack = wc.canGoBack()
      tab.data.canGoForward = wc.canGoForward()
      this.notifyRenderer()
    })

    wc.on('did-navigate-in-page', (_e, url) => {
      const tab = this.tabs.get(tabId)
      if (!tab) return
      tab.data.url = url
      tab.data.canGoBack = wc.canGoBack()
      tab.data.canGoForward = wc.canGoForward()
      this.notifyRenderer()
    })

    // Forward console messages to renderer (Error Lens)
    wc.on('console-message', (_e, level, message, line, sourceId) => {
      if (level >= 2) { // warn/error only
        this.win.webContents.send(IPC.CONSOLE_MESSAGE, {
          tabId, level, message, line, sourceId, timestamp: Date.now()
        })
      }
    })
  }

  private positionActiveView(view: WebContentsView): void {
    const { width, height } = this.win.getContentBounds()
    view.setBounds({
      x: 0,
      y: LAYOUT.CHROME_HEIGHT,
      width,
      height: Math.max(0, height - LAYOUT.CHROME_HEIGHT),
    })
  }

  private destroyView(tab: ManagedTab): void {
    if (!tab.view) return
    try {
      RequestInspector.getInstance().unregisterTab(tab.view.webContents.id)
      this.win.contentView.removeChildView(tab.view)
      if (!tab.view.webContents.isDestroyed()) {
        tab.view.webContents.close()
      }
    } catch { /* already destroyed */ }
    tab.view = undefined
  }

  /** Send current tab state to the renderer */
  private notifyRenderer(): void {
    if (this.win.isDestroyed()) return
    this.win.webContents.send(IPC.TAB_UPDATED, {
      tabs: this.getAllTabs(),
      activeTabId: this.activeTabId,
    })
  }

  private titleForInternal(url: string): string {
    const map: Record<string, string> = {
      'abumrium://home': 'Abumrium Home',
      'abumrium://api-lab': 'API Lab',
      'abumrium://json-tools': 'JSON Tools',
      'abumrium://regex-lab': 'Regex Lab',
      'abumrium://settings': 'Settings',
    }
    return map[url] ?? 'Abumrium'
  }
}
