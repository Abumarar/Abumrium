/**
 * RequestInspector — collects network request logs from all container sessions.
 *
 * Security / Privacy:
 * - Does NOT log request/response bodies by default.
 * - Does NOT log Authorization or Cookie header values.
 * - Logs are kept in memory only (not persisted).
 * - Max 500 entries per tab (ring buffer).
 */
import { session, BrowserWindow } from 'electron'
import type { NetworkRequest } from '../../shared/types'
import { CONTAINERS, SENSITIVE_HEADERS, IPC } from '../../shared/constants'

const MAX_ENTRIES = 500

export class RequestInspector {
  private static instance: RequestInspector
  private logs: Map<string, NetworkRequest[]> = new Map() // tabId → entries
  private win: BrowserWindow | null = null
  private tabIdByWebContentsId: Map<number, string> = new Map()

  static getInstance(): RequestInspector {
    if (!RequestInspector.instance) RequestInspector.instance = new RequestInspector()
    return RequestInspector.instance
  }

  setWindow(win: BrowserWindow): void { this.win = win }

  registerTab(tabId: string, webContentsId: number): void {
    this.tabIdByWebContentsId.set(webContentsId, tabId)
    if (!this.logs.has(tabId)) this.logs.set(tabId, [])
  }

  unregisterTab(webContentsId: number): void {
    this.tabIdByWebContentsId.delete(webContentsId)
  }

  clearTab(tabId: string): void {
    this.logs.set(tabId, [])
  }

  getLogsForTab(tabId: string): NetworkRequest[] {
    return this.logs.get(tabId) ?? []
  }

  installListeners(): void {
    for (const container of CONTAINERS) {
      const sess = session.fromPartition(container.partition)

      sess.webRequest.onSendHeaders({ urls: ['*://*/*'] }, (details) => {
        const tabId = this.tabIdByWebContentsId.get(details.webContentsId ?? -1)
        if (!tabId) return

        const entry: NetworkRequest = {
          id: String(details.id ?? `${Date.now()}-${Math.random()}`),
          tabId,
          url: details.url,
          method: details.method,
          timestamp: Date.now(),
          resourceType: details.resourceType,
        }

        const list = this.logs.get(tabId) ?? []
        list.push(entry)
        if (list.length > MAX_ENTRIES) list.shift()
        this.logs.set(tabId, list)

        // Push to renderer
        this.win?.webContents.send(IPC.NETWORK_REQUEST, entry)
      })

      sess.webRequest.onCompleted({ urls: ['*://*/*'] }, (details) => {
        const tabId = this.tabIdByWebContentsId.get(details.webContentsId ?? -1)
        if (!tabId) return
        const list = this.logs.get(tabId) ?? []
        // Update the matching entry with status
        const entry = [...list].reverse().find(e => e.id === String(details.id))
        if (entry) {
          entry.status = details.statusCode
          entry.duration = Date.now() - entry.timestamp
          this.win?.webContents.send(IPC.NETWORK_REQUEST, entry)
        }
      })

      sess.webRequest.onErrorOccurred({ urls: ['*://*/*'] }, (details) => {
        const tabId = this.tabIdByWebContentsId.get(details.webContentsId ?? -1)
        if (!tabId) return
        const list = this.logs.get(tabId) ?? []
        const entry = [...list].reverse().find(e => e.id === String(details.id))
        if (entry) {
          entry.status = 0
          entry.duration = Date.now() - entry.timestamp
          this.win?.webContents.send(IPC.NETWORK_REQUEST, entry)
        }
      })
    }
  }
}
