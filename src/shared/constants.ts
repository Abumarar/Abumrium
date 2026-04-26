import type { Container, AppSettings, RegexSnippet } from './types'
export { IPC } from './types'

// ─── Brand / Color ───────────────────────────────────────────────────────────
export const BRAND = {
  name: 'Abumrium',
  tagline: 'Chromium, but for builders.',
  version: '0.1.0',
} as const

// ─── UI Layout ────────────────────────────────────────────────────────────────
export const LAYOUT = {
  TAB_STRIP_HEIGHT: 36,
  TOOLBAR_HEIGHT: 44,
  get CHROME_HEIGHT() { return this.TAB_STRIP_HEIGHT + this.TOOLBAR_HEIGHT }, // 76
  SIDEBAR_WIDTH: 320,
} as const

// ─── Internal Routes ─────────────────────────────────────────────────────────
export const INTERNAL_ROUTES = {
  HOME: 'home',
  API_LAB: 'api-lab',
  JSON_TOOLS: 'json-tools',
  REGEX_LAB: 'regex-lab',
  SETTINGS: 'settings',
} as const

export const INTERNAL_URLS = {
  HOME: 'abumrium://home',
  API_LAB: 'abumrium://api-lab',
  JSON_TOOLS: 'abumrium://json-tools',
  REGEX_LAB: 'abumrium://regex-lab',
  SETTINGS: 'abumrium://settings',
} as const

export function isInternalUrl(url: string): boolean {
  return url.startsWith('abumrium://')
}

export function internalRouteFromUrl(url: string): string | undefined {
  if (!isInternalUrl(url)) return undefined
  return url.replace('abumrium://', '')
}

// ─── Containers ──────────────────────────────────────────────────────────────
export const CONTAINERS: Container[] = [
  { id: 'default', name: 'Default',  color: '#303A3D', partition: 'persist:container-default' },
  { id: 'admin',   name: 'Admin',    color: '#C1122F', partition: 'persist:container-admin'   },
  { id: 'user',    name: 'User',     color: '#3B405E', partition: 'persist:container-user'    },
  { id: 'guest',   name: 'Guest',    color: '#4A5568', partition: 'container-guest'            },
] as const

// ─── Localhost Radar ──────────────────────────────────────────────────────────
export const RADAR_PORTS = [3000, 3001, 4200, 5000, 5173, 5174, 8000, 8080, 8888, 9000] as const

export const FRAMEWORK_SIGNATURES: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /vite/i,             name: 'Vite'    },
  { pattern: /next\.js|__next/i,  name: 'Next.js' },
  { pattern: /angular/i,          name: 'Angular' },
  { pattern: /vue/i,              name: 'Vue'     },
  { pattern: /laravel/i,          name: 'Laravel' },
  { pattern: /django/i,           name: 'Django'  },
  { pattern: /rails/i,            name: 'Rails'   },
  { pattern: /express/i,          name: 'Express' },
  { pattern: /react/i,            name: 'React'   },
]

// ─── Default Settings ────────────────────────────────────────────────────────
export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  homePage: 'abumrium://home',
  searchEngine: 'https://duckduckgo.com/?q=',
  enableLocalhostRadar: true,
  enableRequestInspector: true,
  defaultContainer: 'default',
}

// ─── Default Regex Snippets ───────────────────────────────────────────────────
export const DEFAULT_REGEX_SNIPPETS: RegexSnippet[] = [
  { id: 'email',    name: 'Email',     pattern: '[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}', flags: 'g', description: 'Match email addresses' },
  { id: 'url',      name: 'URL',       pattern: 'https?:\\/\\/[^\\s/$.?#].[^\\s]*', flags: 'gi', description: 'Match URLs' },
  { id: 'uuid',     name: 'UUID',      pattern: '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', flags: 'gi', description: 'Match UUID v4' },
  { id: 'date',     name: 'ISO Date',  pattern: '\\d{4}-\\d{2}-\\d{2}', flags: 'g', description: 'Match ISO dates (YYYY-MM-DD)' },
  { id: 'hexcolor', name: 'Hex Color', pattern: '#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b', flags: 'g', description: 'Match hex color codes' },
]

// ─── Sensitive Header Names ───────────────────────────────────────────────────
export const SENSITIVE_HEADERS = ['authorization', 'cookie', 'set-cookie', 'proxy-authorization']

export function isSensitiveHeader(name: string): boolean {
  return SENSITIVE_HEADERS.includes(name.toLowerCase())
}
