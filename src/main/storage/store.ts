/**
 * Simple JSON-file-based store for persisting Abumrium settings and data.
 * Uses Node fs + Electron userData path. No native addon required.
 */
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import type { AppStore } from '../../shared/types'
import { DEFAULT_SETTINGS, DEFAULT_REGEX_SNIPPETS } from '../../shared/constants'
import { normalizeStoreValue } from '../../shared/utils/settingsValidation'

const DEFAULT_STORE: AppStore = {
  settings: DEFAULT_SETTINGS,
  recentUrls: [],
  savedRequests: [],
  headerRules: [],
  regexSnippets: DEFAULT_REGEX_SNIPPETS,
  developerShortcuts: [
    { label: 'localhost:3000', url: 'http://localhost:3000' },
    { label: 'localhost:5173', url: 'http://localhost:5173' },
    { label: 'localhost:8080', url: 'http://localhost:8080' },
    { label: 'GitHub', url: 'https://github.com' },
  ],
}

let storeData: AppStore = { ...DEFAULT_STORE }
let storePath: string | null = null
let loaded = false

function getStorePath(): string {
  if (!storePath) {
    storePath = path.join(app.getPath('userData'), 'abumrium-store.json')
  }
  return storePath
}

function load(): void {
  if (loaded) return
  loaded = true
  try {
    const p = getStorePath()
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<AppStore>
      // Deep merge with defaults so new keys are always present
      storeData = {
        settings: normalizeStoreValue('settings', parsed.settings, DEFAULT_STORE.settings),
        recentUrls: normalizeStoreValue('recentUrls', parsed.recentUrls, DEFAULT_STORE.recentUrls),
        savedRequests: normalizeStoreValue('savedRequests', parsed.savedRequests, DEFAULT_STORE.savedRequests),
        headerRules: normalizeStoreValue('headerRules', parsed.headerRules, DEFAULT_STORE.headerRules),
        regexSnippets: normalizeStoreValue('regexSnippets', parsed.regexSnippets, DEFAULT_STORE.regexSnippets),
        developerShortcuts: normalizeStoreValue('developerShortcuts', parsed.developerShortcuts, DEFAULT_STORE.developerShortcuts),
      }
    }
  } catch {
    storeData = { ...DEFAULT_STORE }
  }
}

function save(): void {
  try {
    const p = getStorePath()
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, JSON.stringify(storeData, null, 2), 'utf-8')
  } catch (e) {
    console.error('[store] Failed to save:', e)
  }
}

export function storeGet<K extends keyof AppStore>(key: K): AppStore[K] {
  load()
  return storeData[key]
}

export function storeSet<K extends keyof AppStore>(key: K, value: unknown): void {
  load()
  storeData[key] = normalizeStoreValue(key, value, storeData[key])
  save()
}

export function storeGetAll(): AppStore {
  load()
  return { ...storeData }
}

/** Add a URL to recent history (deduped, max 50) */
export function addRecentUrl(url: string): void {
  load()
  const list = storeData.recentUrls.filter(u => u !== url)
  list.unshift(url)
  storeData.recentUrls = list.slice(0, 50)
  save()
}
