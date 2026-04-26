/**
 * Preload script — exposes a safe, typed API to the renderer via contextBridge.
 *
 * Security: Only explicitly listed APIs are exposed. No raw Node/Electron APIs
 * are accessible from the renderer. All inputs flow through validated IPC handlers.
 */
import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/constants'
import type { ApiRequest, ContainerId, AppStore, Tab } from '../shared/types'

const abumriumAPI = {
  // ─── Tabs ──────────────────────────────────────────────────────────────────
  tabs: {
    create: (url?: string, containerId?: ContainerId) =>
      ipcRenderer.invoke(IPC.TAB_CREATE, url, containerId),
    close: (tabId: string) =>
      ipcRenderer.invoke(IPC.TAB_CLOSE, tabId),
    switch: (tabId: string) =>
      ipcRenderer.invoke(IPC.TAB_SWITCH, tabId),
    navigate: (tabId: string, url: string) =>
      ipcRenderer.invoke(IPC.TAB_NAVIGATE, tabId, url),
    reload: (tabId: string) =>
      ipcRenderer.invoke(IPC.TAB_RELOAD, tabId),
    stopLoading: (tabId: string) =>
      ipcRenderer.invoke(IPC.TAB_STOP_LOADING, tabId),
    goBack: (tabId: string) =>
      ipcRenderer.invoke(IPC.TAB_GO_BACK, tabId),
    goForward: (tabId: string) =>
      ipcRenderer.invoke(IPC.TAB_GO_FORWARD, tabId),
    openDevTools: (tabId: string) =>
      ipcRenderer.invoke(IPC.TAB_DEVTOOLS, tabId),
    getState: (): Promise<{ tabs: Tab[]; activeTabId: string | null }> =>
      ipcRenderer.invoke(IPC.TAB_STATE),
    onUpdated: (cb: (data: { tabs: unknown[]; activeTabId: string | null }) => void) => {
      ipcRenderer.on(IPC.TAB_UPDATED, (_e, data) => cb(data))
    },
    offUpdated: () => ipcRenderer.removeAllListeners(IPC.TAB_UPDATED),
  },

  // ─── Layout ────────────────────────────────────────────────────────────────
  layout: {
    setContentBounds: (x: number, y: number, w: number, h: number) =>
      ipcRenderer.invoke(IPC.CONTENT_BOUNDS, x, y, w, h),
  },

  // ─── Store ────────────────────────────────────────────────────────────────
  store: {
    get: (key?: string) => ipcRenderer.invoke(IPC.STORE_GET, key),
    set: (key: string, value: unknown) => ipcRenderer.invoke(IPC.STORE_SET, key, value),
    getAll: (): Promise<AppStore> => ipcRenderer.invoke(IPC.STORE_GET),
  },

  // ─── Header Rules ─────────────────────────────────────────────────────────
  headerRules: {
    get: () => ipcRenderer.invoke(IPC.HEADER_RULES_GET),
    set: (rules: unknown[]) => ipcRenderer.invoke(IPC.HEADER_RULES_SET, rules),
  },

  // ─── Network / Inspector ──────────────────────────────────────────────────
  network: {
    onRequest: (cb: (req: unknown) => void) => {
      ipcRenderer.on(IPC.NETWORK_REQUEST, (_e, req) => cb(req))
    },
    offRequest: () => ipcRenderer.removeAllListeners(IPC.NETWORK_REQUEST),
    clear: (tabId: string) => ipcRenderer.invoke(IPC.NETWORK_CLEAR, tabId),
  },

  // ─── API Lab ──────────────────────────────────────────────────────────────
  api: {
    request: (req: ApiRequest) => ipcRenderer.invoke(IPC.API_REQUEST, req),
  },

  // ─── Localhost Radar ──────────────────────────────────────────────────────
  radar: {
    scan: () => ipcRenderer.invoke(IPC.RADAR_SCAN),
  },

  // ─── Console / Error Lens ─────────────────────────────────────────────────
  console: {
    onMessage: (cb: (msg: unknown) => void) => {
      ipcRenderer.on(IPC.CONSOLE_MESSAGE, (_e, msg) => cb(msg))
    },
    offMessage: () => ipcRenderer.removeAllListeners(IPC.CONSOLE_MESSAGE),
  },

  // ─── App commands ─────────────────────────────────────────────────────────
  app: {
    openDevTools: () => ipcRenderer.invoke(IPC.OPEN_DEVTOOLS),
    clearSiteData: (tabId: string) => ipcRenderer.invoke(IPC.CLEAR_SITE_DATA, tabId),
    clearContainerData: (containerId: ContainerId) => ipcRenderer.invoke(IPC.CLEAR_CONTAINER_DATA, containerId),
    onCommandPaletteOpen: (cb: () => void) => {
      ipcRenderer.on('command-palette:open', cb)
    },
    offCommandPaletteOpen: () => ipcRenderer.removeAllListeners('command-palette:open'),
    onShortcut: (event: string, cb: () => void) => {
      ipcRenderer.on(`shortcut:${event}`, cb)
    },
    offShortcut: (event: string) => ipcRenderer.removeAllListeners(`shortcut:${event}`),
  },
}

contextBridge.exposeInMainWorld('abumrium', abumriumAPI)

// ─── TypeScript type export (for renderer) ────────────────────────────────────
export type AbumriumAPI = typeof abumriumAPI
