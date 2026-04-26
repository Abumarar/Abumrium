import { CONTAINERS, DEFAULT_REGEX_SNIPPETS, DEFAULT_SETTINGS, isSensitiveHeader } from '../constants'
import type { ApiRequest, AppSettings, AppStore, ContainerId, HeaderRule, RegexSnippet } from '../types'

const THEMES: AppSettings['theme'][] = ['system', 'dark', 'light']
const HEADER_NAME_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/
const STORE_KEYS: Array<keyof AppStore> = [
  'settings',
  'recentUrls',
  'savedRequests',
  'headerRules',
  'regexSnippets',
  'developerShortcuts',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanString(value: unknown, fallback = '', maxLength = 2048): string {
  if (typeof value !== 'string') return fallback
  const next = value.trim()
  return next ? next.slice(0, maxLength) : fallback
}

function cleanBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function isStoreKey(key: unknown): key is keyof AppStore {
  return typeof key === 'string' && STORE_KEYS.includes(key as keyof AppStore)
}

export function isContainerId(value: unknown): value is ContainerId {
  return typeof value === 'string' && CONTAINERS.some(container => container.id === value)
}

export function normalizeSettings(value: unknown, fallback: AppSettings = DEFAULT_SETTINGS): AppSettings {
  const source = isRecord(value) ? value : {}
  const theme = THEMES.includes(source.theme as AppSettings['theme'])
    ? source.theme as AppSettings['theme']
    : fallback.theme

  return {
    theme,
    homePage: cleanString(source.homePage, fallback.homePage),
    searchEngine: cleanString(source.searchEngine, fallback.searchEngine),
    enableLocalhostRadar: cleanBoolean(source.enableLocalhostRadar, fallback.enableLocalhostRadar),
    enableRequestInspector: cleanBoolean(source.enableRequestInspector, fallback.enableRequestInspector),
    defaultContainer: isContainerId(source.defaultContainer) ? source.defaultContainer : fallback.defaultContainer,
  }
}

export function normalizeRuleDomain(value: unknown): string {
  const raw = cleanString(value, '', 253).replace(/^https?:\/\//i, '')
  return raw.split(/[/?#]/)[0].replace(/^\*\./, '').toLowerCase()
}

export function isValidRuleDomain(domain: string): boolean {
  if (!domain || /\s/.test(domain)) return false
  try {
    const parsed = new URL(`http://${domain}`)
    return parsed.host.toLowerCase() === domain && Boolean(parsed.hostname)
  } catch {
    return false
  }
}

export function isValidHeaderName(name: string): boolean {
  return HEADER_NAME_RE.test(name)
}

export function normalizeHeaderRule(value: unknown): HeaderRule | null {
  if (!isRecord(value)) return null
  const domain = normalizeRuleDomain(value.domain)
  const headerName = cleanString(value.headerName, '', 128)

  if (!isValidRuleDomain(domain) || !isValidHeaderName(headerName)) return null

  return {
    id: cleanString(value.id, `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, 128),
    domain,
    headerName,
    headerValue: typeof value.headerValue === 'string' ? value.headerValue.slice(0, 8192) : '',
    enabled: cleanBoolean(value.enabled, true),
    isSensitive: isSensitiveHeader(headerName),
  }
}

export function normalizeHeaderRules(value: unknown): HeaderRule[] {
  if (!Array.isArray(value)) return []
  return value
    .map(normalizeHeaderRule)
    .filter((rule): rule is HeaderRule => Boolean(rule))
}

function normalizeRecentUrls(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback
  return value
    .filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
    .map(url => url.trim().slice(0, 2048))
    .slice(0, 50)
}

function normalizeSavedRequests(value: unknown, fallback: ApiRequest[]): ApiRequest[] {
  if (!Array.isArray(value)) return fallback
  return value.filter(isRecord) as unknown as ApiRequest[]
}

function normalizeRegexSnippets(value: unknown, fallback: RegexSnippet[]): RegexSnippet[] {
  if (!Array.isArray(value)) return fallback
  const snippets = value
    .filter(isRecord)
    .map(snippet => ({
      id: cleanString(snippet.id, '', 128),
      name: cleanString(snippet.name, '', 128),
      pattern: typeof snippet.pattern === 'string' ? snippet.pattern : '',
      flags: typeof snippet.flags === 'string' ? snippet.flags.slice(0, 16) : 'g',
      description: typeof snippet.description === 'string' ? snippet.description.slice(0, 512) : undefined,
    }))
    .filter(snippet => snippet.id && snippet.name)
  return snippets.length ? snippets : DEFAULT_REGEX_SNIPPETS
}

function normalizeDeveloperShortcuts(
  value: unknown,
  fallback: Array<{ label: string; url: string }>
): Array<{ label: string; url: string }> {
  if (!Array.isArray(value)) return fallback
  const shortcuts = value
    .filter(isRecord)
    .map(shortcut => ({
      label: cleanString(shortcut.label, '', 80),
      url: cleanString(shortcut.url, '', 2048),
    }))
    .filter(shortcut => shortcut.label && shortcut.url)
  return shortcuts.length ? shortcuts : fallback
}

export function normalizeStoreValue<K extends keyof AppStore>(
  key: K,
  value: unknown,
  fallback: AppStore[K]
): AppStore[K] {
  switch (key) {
    case 'settings':
      return normalizeSettings(value, fallback as AppSettings) as AppStore[K]
    case 'recentUrls':
      return normalizeRecentUrls(value, fallback as string[]) as AppStore[K]
    case 'savedRequests':
      return normalizeSavedRequests(value, fallback as ApiRequest[]) as AppStore[K]
    case 'headerRules':
      return normalizeHeaderRules(value) as AppStore[K]
    case 'regexSnippets':
      return normalizeRegexSnippets(value, fallback as RegexSnippet[]) as AppStore[K]
    case 'developerShortcuts':
      return normalizeDeveloperShortcuts(value, fallback as Array<{ label: string; url: string }>) as AppStore[K]
    default:
      return fallback
  }
}
