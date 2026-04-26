import React, { useEffect, useRef, useState } from 'react'
import { useSettingsStore } from '../state/settingsStore'
import { CONTAINERS, isSensitiveHeader } from '../../shared/constants'
import type { AppSettings, AppStore, ContainerId, HeaderRule } from '../../shared/types'
import {
  isValidHeaderName,
  isValidRuleDomain,
  normalizeHeaderRules,
  normalizeRuleDomain,
  normalizeSettings,
  normalizeStoreValue,
} from '../../shared/utils/settingsValidation'

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2) }

type Status = { type: 'success' | 'error'; message: string }
type ImportableStoreKey = Exclude<keyof AppStore, 'settings' | 'headerRules'>
type ImportPayload = Partial<Record<keyof AppStore, unknown>>

const STORE_IMPORT_KEYS: Array<keyof AppStore> = [
  'settings',
  'recentUrls',
  'savedRequests',
  'headerRules',
  'regexSnippets',
  'developerShortcuts',
]
const EXTRA_IMPORT_KEYS: ImportableStoreKey[] = ['recentUrls', 'savedRequests', 'regexSnippets', 'developerShortcuts']

function hasOwnKey(value: Record<string, unknown>, key: keyof AppStore): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function looksLikeStoreExport(value: Record<string, unknown>): boolean {
  return STORE_IMPORT_KEYS.some(key => hasOwnKey(value, key))
}

export const Settings: React.FC = () => {
  const { settings, update } = useSettingsStore()
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [headerRules, setHeaderRules] = useState<HeaderRule[]>([])
  const [newRule, setNewRule] = useState({ domain: '', headerName: '', headerValue: '' })
  const [homePageDraft, setHomePageDraft] = useState(settings.homePage)
  const [status, setStatus] = useState<Status | null>(null)
  const [clearingContainer, setClearingContainer] = useState<ContainerId | null>(null)

  const newRuleDomain = normalizeRuleDomain(newRule.domain)
  const newRuleHeaderName = newRule.headerName.trim()
  const canAddRule = isValidRuleDomain(newRuleDomain) && isValidHeaderName(newRuleHeaderName)
  const hasRuleDraft = Boolean(newRule.domain.trim() || newRule.headerName.trim() || newRule.headerValue)

  const showStatus = (type: Status['type'], message: string) => {
    if (statusTimer.current) clearTimeout(statusTimer.current)
    setStatus({ type, message })
    statusTimer.current = setTimeout(() => setStatus(null), type === 'error' ? 4200 : 2200)
  }

  useEffect(() => {
    let mounted = true
    window.abumrium.headerRules.get()
      .then((rules: unknown) => {
        if (mounted) setHeaderRules(normalizeHeaderRules(rules))
      })
      .catch(() => {
        if (mounted) showStatus('error', 'Could not load header rules')
      })

    return () => {
      mounted = false
      if (statusTimer.current) clearTimeout(statusTimer.current)
    }
  }, [])

  useEffect(() => {
    setHomePageDraft(settings.homePage)
  }, [settings.homePage])

  const saveSettings = async (patch: Partial<AppSettings>) => {
    try {
      const next = normalizeSettings({ ...settings, ...patch }, settings)
      await update(next)
      showStatus('success', 'Saved')
      return true
    } catch {
      showStatus('error', 'Could not save settings')
      return false
    }
  }

  const commitHomePage = async () => {
    const homePage = normalizeSettings({ ...settings, homePage: homePageDraft }, settings).homePage
    setHomePageDraft(homePage)
    if (homePage === settings.homePage) return
    await saveSettings({ homePage })
  }

  const saveHeaderRules = async (rules: HeaderRule[]) => {
    const previous = headerRules
    const normalizedRules = normalizeHeaderRules(rules)
    setHeaderRules(normalizedRules)

    try {
      const savedRules = await window.abumrium.headerRules.set(normalizedRules)
      setHeaderRules(normalizeHeaderRules(savedRules ?? normalizedRules))
      showStatus('success', 'Saved')
      return true
    } catch {
      setHeaderRules(previous)
      showStatus('error', 'Could not save header rules')
      return false
    }
  }

  const addRule = async () => {
    if (!canAddRule) {
      showStatus('error', 'Use a valid domain and header name')
      return
    }

    const duplicate = headerRules.some(rule =>
      rule.domain === newRuleDomain && rule.headerName.toLowerCase() === newRuleHeaderName.toLowerCase()
    )
    if (duplicate) {
      showStatus('error', 'Header rule already exists')
      return
    }

    const rule: HeaderRule = {
      id: genId(),
      domain: newRuleDomain,
      headerName: newRuleHeaderName,
      headerValue: newRule.headerValue,
      enabled: true,
      isSensitive: isSensitiveHeader(newRuleHeaderName),
    }
    const saved = await saveHeaderRules([...headerRules, rule])
    if (saved) setNewRule({ domain: '', headerName: '', headerValue: '' })
  }

  const toggleRule = async (id: string) => {
    await saveHeaderRules(headerRules.map(rule => rule.id === id ? { ...rule, enabled: !rule.enabled } : rule))
  }

  const deleteRule = async (id: string) => {
    await saveHeaderRules(headerRules.filter(rule => rule.id !== id))
  }

  const clearData = async (containerId: ContainerId) => {
    setClearingContainer(containerId)
    try {
      await window.abumrium.app.clearContainerData(containerId)
      showStatus('success', 'Container data cleared')
    } catch {
      showStatus('error', 'Could not clear container data')
    } finally {
      setClearingContainer(null)
    }
  }

  const exportSettings = async () => {
    try {
      const all = await window.abumrium.store.getAll()
      const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      const url = URL.createObjectURL(blob)
      a.href = url
      a.download = 'abumrium-settings.json'
      document.body.append(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      showStatus('success', 'Exported')
    } catch {
      showStatus('error', 'Could not export settings')
    }
  }

  const importSettings = async (file: File | null) => {
    if (!file) return

    try {
      const raw = await file.text()
      const parsed = JSON.parse(raw) as unknown
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Invalid settings file')
      }

      const record = parsed as Record<string, unknown>
      const imported: ImportPayload = looksLikeStoreExport(record) ? record : { settings: record }
      const currentStore = await window.abumrium.store.getAll()

      if (imported.settings !== undefined) {
        await update(normalizeSettings(imported.settings, currentStore.settings))
      }

      if (imported.headerRules !== undefined) {
        const rules = normalizeHeaderRules(imported.headerRules)
        const savedRules = await window.abumrium.headerRules.set(rules)
        setHeaderRules(normalizeHeaderRules(savedRules ?? rules))
      }

      for (const key of EXTRA_IMPORT_KEYS) {
        if (imported[key] !== undefined) {
          await window.abumrium.store.set(key, normalizeStoreValue(key, imported[key], currentStore[key]))
        }
      }

      showStatus('success', 'Imported')
    } catch {
      showStatus('error', 'Import failed')
    } finally {
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  const clearRecentUrls = async () => {
    try {
      await window.abumrium.store.set('recentUrls', [])
      showStatus('success', 'Recent URLs cleared')
    } catch {
      showStatus('error', 'Could not clear recent URLs')
    }
  }

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mb-8">
      <h2 className="text-xs text-muted uppercase font-semibold mb-4">{title}</h2>
      <div className="card-elevated p-4 space-y-4">{children}</div>
    </section>
  )

  const Row = ({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) => (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <div className="text-sm text-text">{label}</div>
        {desc && <div className="text-xs text-muted">{desc}</div>}
      </div>
      <div className="w-full sm:w-auto sm:flex-shrink-0">{children}</div>
    </div>
  )

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void | Promise<void> }) => (
    <button
      type="button"
      className={`w-10 h-5 rounded-full transition-colors relative ${value ? 'bg-red-core' : 'bg-border'}`}
      onClick={() => { void onChange(!value) }}
      role="switch"
      aria-checked={value}
    >
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )

  return (
    <div className="min-h-full bg-app-bg overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8 flex min-h-8 flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-text">Settings</h1>
          {status && (
            <span
              className={`text-xs fade-in ${status.type === 'error' ? 'text-red-bright' : 'text-green-400'}`}
              role="status"
            >
              {status.message}
            </span>
          )}
        </div>

        <Section title="Appearance">
          <Row label="Theme" desc="UI color scheme">
            <select
              className="input w-full sm:w-32 text-sm"
              value={settings.theme}
              onChange={e => { void saveSettings({ theme: e.target.value as AppSettings['theme'] }) }}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </Row>
        </Section>

        <Section title="Navigation">
          <Row label="Home Page" desc="Used for new tabs and startup">
            <input
              className="input w-full sm:w-64 text-sm"
              value={homePageDraft}
              onChange={e => setHomePageDraft(e.target.value)}
              onBlur={() => { void commitHomePage() }}
              onKeyDown={e => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') {
                  setHomePageDraft(settings.homePage)
                  e.currentTarget.blur()
                }
              }}
              placeholder="abumrium://home"
            />
          </Row>
          <Row label="Search Engine" desc="Used when entering non-URL text">
            <select
              className="input w-full sm:w-48 text-sm"
              value={settings.searchEngine}
              onChange={e => { void saveSettings({ searchEngine: e.target.value }) }}
            >
              <option value="https://duckduckgo.com/?q=">DuckDuckGo</option>
              <option value="https://www.google.com/search?q=">Google</option>
              <option value="https://search.brave.com/search?q=">Brave Search</option>
            </select>
          </Row>
          <Row label="Default Container" desc="Container for new tabs">
            <select
              className="input w-full sm:w-32 text-sm"
              value={settings.defaultContainer}
              onChange={e => { void saveSettings({ defaultContainer: e.target.value as ContainerId }) }}
            >
              {CONTAINERS.map(container => <option key={container.id} value={container.id}>{container.name}</option>)}
            </select>
          </Row>
        </Section>

        <Section title="Developer Features">
          <Row label="Localhost Radar" desc="Scan common dev ports on the home page">
            <Toggle value={settings.enableLocalhostRadar} onChange={value => { void saveSettings({ enableLocalhostRadar: value }) }} />
          </Row>
          <Row label="Request Inspector" desc="Show network request panel for active tab">
            <Toggle value={settings.enableRequestInspector} onChange={value => { void saveSettings({ enableRequestInspector: value }) }} />
          </Row>
        </Section>

        <Section title="Header Rules">
          <p className="text-xs text-muted -mt-2">Inject custom headers for specific domains. Applied to all requests matching that host.</p>

          {headerRules.length > 0 && (
            <div className="space-y-2">
              {headerRules.map(rule => (
                <div key={rule.id} className="flex flex-wrap items-center gap-2 p-2 bg-surface rounded-lg border border-border text-xs font-mono">
                  <Toggle value={rule.enabled} onChange={() => toggleRule(rule.id)} />
                  <span className="text-muted min-w-0 flex-1 sm:flex-none sm:w-32 truncate" title={rule.domain}>{rule.domain}</span>
                  <span className="text-navy flex-shrink-0">{rule.headerName}:</span>
                  <span className="text-text min-w-0 flex-1 truncate">{rule.isSensitive ? '••••••' : rule.headerValue}</span>
                  {rule.isSensitive && <span className="text-[9px] text-red-core border border-red-core/30 px-1 rounded">SENSITIVE</span>}
                  <button type="button" className="text-muted hover:text-red-core transition-colors ml-auto" onClick={() => { void deleteRule(rule.id) }}>Delete</button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 pt-2 border-t border-border">
            {isSensitiveHeader(newRuleHeaderName) && (
              <div className="text-xs text-red-core border border-red-core/30 rounded p-2">
                Sensitive header values can affect authentication. Proceed carefully.
              </div>
            )}
            {hasRuleDraft && !canAddRule && (
              <div className="text-xs text-red-bright border border-red-core/30 rounded p-2">
                Use a domain like localhost:3000 and a valid HTTP header name.
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <input className="input text-xs py-1.5 flex-1" placeholder="domain (e.g. localhost:3000)" value={newRule.domain} onChange={e => setNewRule(rule => ({ ...rule, domain: e.target.value }))} />
              <input className="input text-xs py-1.5 flex-1" placeholder="Header-Name" value={newRule.headerName} onChange={e => setNewRule(rule => ({ ...rule, headerName: e.target.value }))} />
              <input className="input text-xs py-1.5 flex-1" placeholder="value" value={newRule.headerValue} onChange={e => setNewRule(rule => ({ ...rule, headerValue: e.target.value }))} />
              <button
                type="button"
                className="btn btn-primary text-xs py-1.5 px-3 justify-center"
                onClick={() => { void addRule() }}
                disabled={!canAddRule}
              >
                Add
              </button>
            </div>
          </div>
        </Section>

        <Section title="Containers">
          {CONTAINERS.map(container => (
            <Row key={container.id} label={container.name} desc={`Session partition: ${container.partition}`}>
              <button
                type="button"
                className="btn btn-ghost text-xs py-1 px-2 w-full justify-center sm:w-auto"
                onClick={() => { void clearData(container.id) }}
                disabled={clearingContainer === container.id}
              >
                {clearingContainer === container.id ? 'Clearing...' : 'Clear data'}
              </button>
            </Row>
          ))}
        </Section>

        <Section title="Data">
          <Row label="Export Settings" desc="Save all Abumrium settings to a JSON file">
            <button type="button" className="btn btn-ghost text-xs w-full justify-center sm:w-auto" onClick={() => { void exportSettings() }}>Export</button>
          </Row>
          <Row label="Import Settings" desc="Restore settings from a JSON file">
            <input
              ref={importInputRef}
              className="hidden"
              type="file"
              accept="application/json,.json"
              onChange={e => { void importSettings(e.currentTarget.files?.[0] ?? null) }}
            />
            <button type="button" className="btn btn-ghost text-xs w-full justify-center sm:w-auto" onClick={() => importInputRef.current?.click()}>Import</button>
          </Row>
          <Row label="Clear Recent URLs" desc="Remove browsing history from home page">
            <button type="button" className="btn btn-ghost text-xs w-full justify-center sm:w-auto" onClick={() => { void clearRecentUrls() }}>Clear</button>
          </Row>
        </Section>

        <div className="card p-4 flex flex-wrap items-center gap-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0" style={{ background: '#11151B', border: '1px solid #2A303A' }}>⬡</div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-text">Abumrium</div>
            <div className="text-xs text-muted">Chromium, but for builders.</div>
          </div>
          <div className="sm:ml-auto flex gap-1.5">
            {['#07090D','#11151B','#171C24','#C1122F','#3B405E','#8B94A7'].map(color => (
              <div key={color} className="w-5 h-5 rounded" style={{ background: color, border: '1px solid #2A303A' }} title={color} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
