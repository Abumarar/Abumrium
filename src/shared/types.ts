// Shared TypeScript types for Abumrium main process, preload, and renderer

export type ContainerId = 'default' | 'admin' | 'user' | 'guest'

export interface Container {
  id: ContainerId
  name: string
  color: string
  partition: string // Electron session partition string
}

export interface Tab {
  id: string
  url: string
  title: string
  favicon?: string
  isLoading: boolean
  isInternal: boolean       // true when showing an abumrium:// page
  internalRoute?: string    // 'home' | 'api-lab' | 'json-tools' | 'regex-lab' | 'settings'
  containerId: ContainerId
  canGoBack: boolean
  canGoForward: boolean
  error?: string            // navigation error message
}

export interface HeaderRule {
  id: string
  domain: string
  headerName: string
  headerValue: string
  enabled: boolean
  isSensitive: boolean      // true if Authorization/Cookie etc.
}

export interface ApiRequest {
  id: string
  name?: string
  method: HttpMethod
  url: string
  headers: Record<string, string>
  body?: string
  createdAt: number
}

export interface ApiResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  time: number              // ms
  size: number              // bytes
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export interface NetworkRequest {
  id: string
  tabId: string
  url: string
  method: string
  status?: number
  resourceType?: string
  timestamp: number
  duration?: number
}

export interface RegexSnippet {
  id: string
  name: string
  pattern: string
  flags: string
  description?: string
}

export interface LocalhostService {
  port: number
  responding: boolean
  framework?: string
  title?: string
  responseTime?: number
}

export interface AppSettings {
  theme: 'system' | 'dark' | 'light'
  homePage: string
  searchEngine: string
  enableLocalhostRadar: boolean
  enableRequestInspector: boolean
  defaultContainer: ContainerId
}

export interface AppStore {
  settings: AppSettings
  recentUrls: string[]
  savedRequests: ApiRequest[]
  headerRules: HeaderRule[]
  regexSnippets: RegexSnippet[]
  developerShortcuts: Array<{ label: string; url: string }>
}

// IPC channel names — typed to avoid typos
export const IPC = {
  // Tab management
  TAB_CREATE: 'tab:create',
  TAB_CLOSE: 'tab:close',
  TAB_SWITCH: 'tab:switch',
  TAB_NAVIGATE: 'tab:navigate',
  TAB_RELOAD: 'tab:reload',
  TAB_GO_BACK: 'tab:go-back',
  TAB_GO_FORWARD: 'tab:go-forward',
  TAB_STOP_LOADING: 'tab:stop-loading',
  TAB_STATE: 'tab:state',
  TAB_UPDATED: 'tab:updated',         // main → renderer
  TAB_DEVTOOLS: 'tab:devtools',

  // Layout / bounds
  CONTENT_BOUNDS: 'layout:content-bounds',

  // Network / Inspector
  NETWORK_REQUEST: 'network:request',  // main → renderer
  NETWORK_CLEAR: 'network:clear',

  // Header rules
  HEADER_RULES_GET: 'header-rules:get',
  HEADER_RULES_SET: 'header-rules:set',

  // Localhost Radar
  RADAR_SCAN: 'radar:scan',
  RADAR_RESULT: 'radar:result',        // main → renderer

  // Console errors (Error Lens)
  CONSOLE_MESSAGE: 'console:message',  // main → renderer

  // Store / persistence
  STORE_GET: 'store:get',
  STORE_SET: 'store:set',

  // API Lab (HTTP requests sent via main to avoid CORS)
  API_REQUEST: 'api:request',

  // App
  OPEN_DEVTOOLS: 'app:open-devtools',
  CLEAR_SITE_DATA: 'app:clear-site-data',
  CLEAR_CONTAINER_DATA: 'app:clear-container-data',
} as const
