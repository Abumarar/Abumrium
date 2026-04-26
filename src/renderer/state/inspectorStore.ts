import { create } from 'zustand'
import type { NetworkRequest } from '../../shared/types'

interface ConsoleMessage {
  tabId: string
  level: number
  message: string
  line?: number
  sourceId?: string
  timestamp: number
  errorType?: string
  explanation?: string
}

interface InspectorState {
  requests: NetworkRequest[]
  consoleMessages: ConsoleMessage[]
  filter: string
  inspectorOpen: boolean
  errorLensOpen: boolean

  addRequest: (req: NetworkRequest) => void
  clearRequests: (tabId: string) => void
  setFilter: (f: string) => void
  toggleInspector: () => void
  toggleErrorLens: () => void
  addConsoleMessage: (msg: ConsoleMessage) => void
  clearConsoleMessages: (tabId: string) => void
}

const ERROR_PATTERNS: Array<{ pattern: RegExp; type: string; explanation: string }> = [
  { pattern: /CORS|cross-origin|Access-Control/i, type: 'CORS', explanation: 'The server is not sending CORS headers that allow this origin. Add Access-Control-Allow-Origin on the server, or use a proxy.' },
  { pattern: /Content.Security.Policy|CSP|violat/i, type: 'CSP', explanation: 'A Content Security Policy header is blocking a resource. Check the server CSP headers.' },
  { pattern: /Mixed Content/i, type: 'Mixed Content', explanation: 'An HTTPS page is loading HTTP resources. Ensure all resources use HTTPS.' },
  { pattern: /Failed to fetch|net::ERR_/i, type: 'Network Error', explanation: 'A network request failed. The server may be down, or a firewall/proxy is blocking the request.' },
  { pattern: /404|Not Found/i, type: '404', explanation: 'A resource was not found. Check the URL or file path.' },
  { pattern: /import|module|Cannot find module/i, type: 'Module Import', explanation: 'A JavaScript module import failed. Check the import path and whether the module is installed.' },
  { pattern: /WebSocket/i, type: 'WebSocket', explanation: 'A WebSocket connection failed. The server may not support WebSocket, or the port/URL is wrong.' },
]

function detectErrorType(message: string): { errorType: string; explanation: string } | undefined {
  for (const p of ERROR_PATTERNS) {
    if (p.pattern.test(message)) return { errorType: p.type, explanation: p.explanation }
  }
  return undefined
}

export const useInspectorStore = create<InspectorState>((set, get) => ({
  requests: [],
  consoleMessages: [],
  filter: '',
  inspectorOpen: false,
  errorLensOpen: false,

  addRequest: (req) => {
    set(s => {
      const existing = s.requests.find(r => r.id === req.id)
      if (existing) {
        return {
          requests: s.requests.map(r => r.id === req.id ? { ...r, ...req } : r),
        }
      }
      return { requests: [req, ...s.requests].slice(0, 500) }
    })
  },

  clearRequests: (tabId) => {
    set(s => ({ requests: s.requests.filter(r => r.tabId !== tabId) }))
    window.abumrium.network.clear(tabId)
  },

  setFilter: (filter) => set({ filter }),

  toggleInspector: () => set(s => ({ inspectorOpen: !s.inspectorOpen })),
  toggleErrorLens:  () => set(s => ({ errorLensOpen:  !s.errorLensOpen  })),

  addConsoleMessage: (msg) => {
    const detected = detectErrorType(msg.message)
    const enriched = detected ? { ...msg, ...detected } : msg
    set(s => ({ consoleMessages: [enriched, ...s.consoleMessages].slice(0, 200) }))
  },

  clearConsoleMessages: (tabId) => {
    set(s => ({ consoleMessages: s.consoleMessages.filter(m => m.tabId !== tabId) }))
  },
}))
