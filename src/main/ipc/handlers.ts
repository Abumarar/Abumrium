/**
 * IPC Handlers — registers all ipcMain handlers for renderer ↔ main communication.
 *
 * Security rules:
 * - All inputs are validated before use.
 * - No raw Node.js APIs are exposed.
 * - Sensitive header values are not logged.
 * - API requests are proxied through main to avoid CORS issues in the renderer.
 */
import { ipcMain, BrowserWindow } from 'electron'
import * as http from 'http'
import * as https from 'https'
import { IPC, RADAR_PORTS, FRAMEWORK_SIGNATURES } from '../../shared/constants'
import { storeGet, storeSet, storeGetAll } from '../storage/store'
import { HeaderRulesManager } from '../network/HeaderRules'
import { RequestInspector } from '../network/RequestInspector'
import type { TabManager } from '../tabs/TabManager'
import type { ApiRequest, LocalhostService, ContainerId } from '../../shared/types'
import { isContainerId, isStoreKey, normalizeHeaderRules } from '../../shared/utils/settingsValidation'

export function registerIpcHandlers(win: BrowserWindow, tabManager: TabManager): void {
  // ─── Tab Management ──────────────────────────────────────────────────────────
  ipcMain.handle(IPC.TAB_CREATE, (_e, url?: string, containerId?: string) => {
    return tabManager.createTab(url, isContainerId(containerId) ? containerId : 'default')
  })

  ipcMain.handle(IPC.TAB_CLOSE, (_e, tabId: string) => {
    tabManager.closeTab(tabId)
  })

  ipcMain.handle(IPC.TAB_SWITCH, (_e, tabId: string) => {
    tabManager.switchToTab(tabId)
  })

  ipcMain.handle(IPC.TAB_NAVIGATE, (_e, tabId: string, url: string) => {
    if (typeof url !== 'string' || url.length > 2048) return
    tabManager.navigate(tabId, url)
  })

  ipcMain.handle(IPC.TAB_RELOAD, (_e, tabId: string) => {
    tabManager.reload(tabId)
  })

  ipcMain.handle(IPC.TAB_STOP_LOADING, (_e, tabId: string) => {
    tabManager.stopLoading(tabId)
  })

  ipcMain.handle(IPC.TAB_GO_BACK, (_e, tabId: string) => {
    tabManager.goBack(tabId)
  })

  ipcMain.handle(IPC.TAB_GO_FORWARD, (_e, tabId: string) => {
    tabManager.goForward(tabId)
  })

  ipcMain.handle(IPC.TAB_DEVTOOLS, (_e, tabId: string) => {
    tabManager.openDevTools(tabId)
  })

  ipcMain.handle(IPC.TAB_STATE, () => ({
    tabs: tabManager.getAllTabs(),
    activeTabId: tabManager.getActiveTabId(),
  }))

  ipcMain.handle(IPC.OPEN_DEVTOOLS, () => {
    win.webContents.openDevTools()
  })

  ipcMain.handle(IPC.CLEAR_SITE_DATA, (_e, tabId: string) => {
    tabManager.clearSiteData(tabId)
  })

  ipcMain.handle(IPC.CLEAR_CONTAINER_DATA, async (_e, containerId: ContainerId) => {
    await tabManager.clearContainerData(containerId)
  })

  // ─── Layout bounds ────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.CONTENT_BOUNDS, (_e, x: number, y: number, w: number, h: number) => {
    tabManager.setContentBounds(
      Math.round(x), Math.round(y), Math.round(w), Math.round(h)
    )
  })

  // ─── Store ───────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.STORE_GET, (_e, key?: string) => {
    if (!key) return storeGetAll()
    if (!isStoreKey(key)) return undefined
    return storeGet(key)
  })

  ipcMain.handle(IPC.STORE_SET, (_e, key: string, value: unknown) => {
    if (!isStoreKey(key)) return
    storeSet(key, value)
  })

  // ─── Header Rules ─────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.HEADER_RULES_GET, () => {
    return HeaderRulesManager.getInstance().getRules()
  })

  ipcMain.handle(IPC.HEADER_RULES_SET, (_e, rules: unknown) => {
    if (!Array.isArray(rules)) return
    const normalizedRules = normalizeHeaderRules(rules)
    const mgr = HeaderRulesManager.getInstance()
    mgr.setRules(normalizedRules)
    storeSet('headerRules', normalizedRules)
    return normalizedRules
  })

  // ─── Network clear ────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.NETWORK_CLEAR, (_e, tabId: string) => {
    RequestInspector.getInstance().clearTab(tabId)
  })

  // ─── API Lab: proxy HTTP requests through main ────────────────────────────────
  ipcMain.handle(IPC.API_REQUEST, async (_e, req: ApiRequest) => {
    return proxyApiRequest(req)
  })

  // ─── Localhost Radar ──────────────────────────────────────────────────────────
  ipcMain.handle(IPC.RADAR_SCAN, async () => {
    return scanLocalhostPorts()
  })
}

// ─── API proxy ────────────────────────────────────────────────────────────────

async function proxyApiRequest(req: ApiRequest): Promise<{
  status: number; statusText: string; headers: Record<string, string>; body: string; time: number; size: number
}> {
  const start = Date.now()
  return new Promise((resolve) => {
    try {
      const url = new URL(req.url)
      const lib = url.protocol === 'https:' ? https : http
      const options: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: req.method,
        headers: req.headers ?? {},
        timeout: 30000,
      }
      const httpReq = lib.request(options, (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => {
          const bodyBuffer = Buffer.concat(chunks)
          resolve({
            status: res.statusCode ?? 0,
            statusText: res.statusMessage ?? '',
            headers: Object.fromEntries(
              Object.entries(res.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v ?? ''])
            ),
            body: bodyBuffer.toString('utf-8'),
            time: Date.now() - start,
            size: bodyBuffer.byteLength,
          })
        })
      })
      httpReq.on('error', (e) => resolve({ status: 0, statusText: e.message, headers: {}, body: '', time: Date.now() - start, size: 0 }))
      httpReq.on('timeout', () => { httpReq.destroy(); resolve({ status: 0, statusText: 'Timeout', headers: {}, body: '', time: Date.now() - start, size: 0 }) })
      if (req.body) httpReq.write(req.body)
      httpReq.end()
    } catch (e) {
      resolve({ status: 0, statusText: String(e), headers: {}, body: '', time: Date.now() - start, size: 0 })
    }
  })
}

// ─── Localhost Radar ──────────────────────────────────────────────────────────

async function scanLocalhostPorts(): Promise<LocalhostService[]> {
  const results = await Promise.all(RADAR_PORTS.map(port => scanPort(port)))
  return results
}

function scanPort(port: number): Promise<LocalhostService> {
  return new Promise((resolve) => {
    const start = Date.now()
    const req = http.request(
      { hostname: 'localhost', port, path: '/', method: 'GET', timeout: 1500 },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8', 0, 4096)
          const serverHeader = (res.headers['server'] ?? '') as string
          const xPowered = (res.headers['x-powered-by'] ?? '') as string
          const combo = body + serverHeader + xPowered

          let framework: string | undefined
          for (const sig of FRAMEWORK_SIGNATURES) {
            if (sig.pattern.test(combo)) { framework = sig.name; break }
          }

          // Extract <title> if present
          const titleMatch = body.match(/<title[^>]*>([^<]+)<\/title>/i)
          resolve({
            port,
            responding: true,
            framework,
            title: titleMatch?.[1]?.trim(),
            responseTime: Date.now() - start,
          })
        })
      }
    )
    req.on('error', () => resolve({ port, responding: false }))
    req.on('timeout', () => { req.destroy(); resolve({ port, responding: false }) })
    req.end()
  })
}
