import React, { useState, useEffect, useCallback } from 'react'
import { useTabsStore } from '../state/tabsStore'
import { useSettingsStore } from '../state/settingsStore'
import type { LocalhostService } from '../../shared/types'
import { INTERNAL_URLS } from '../../shared/constants'
import logoUrl from '../assets/abumrium-logo.png'

interface QuickCard {
  icon: string
  label: string
  desc: string
  url: string
}

const QUICK_CARDS: QuickCard[] = [
  { icon: '🖥', label: 'localhost:3000', desc: 'Open local dev server', url: 'http://localhost:3000' },
  { icon: '⚡', label: 'localhost:5173', desc: 'Vite default port', url: 'http://localhost:5173' },
  { icon: '🌐', label: 'localhost:8000', desc: 'Common dev server', url: 'http://localhost:8000' },
  { icon: '🔧', label: 'localhost:8080', desc: 'Common alt port', url: 'http://localhost:8080' },
  { icon: '🧪', label: 'API Lab', desc: 'Send, debug, repeat', url: INTERNAL_URLS.API_LAB },
  { icon: '{ }', label: 'JSON Tools', desc: 'Format, validate, generate', url: INTERNAL_URLS.JSON_TOOLS },
  { icon: '.*', label: 'Regex Lab', desc: 'Test regex patterns', url: INTERNAL_URLS.REGEX_LAB },
  { icon: '⚙', label: 'Settings', desc: 'Configure Abumrium', url: INTERNAL_URLS.SETTINGS },
]

const PortStatusCard: React.FC<{ svc: LocalhostService; onOpen: (url: string) => void }> = ({ svc, onOpen }) => (
  <button
    type="button"
    disabled={!svc.responding}
    className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg border transition-all
      ${svc.responding
        ? 'border-border hover:border-red-core bg-surface hover:shadow-[0_0_12px_rgba(193,18,47,0.1)]'
        : 'border-border bg-surface opacity-50 cursor-default'}`}
    onClick={() => onOpen(`http://localhost:${svc.port}`)}
  >
    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${svc.responding ? 'bg-green-400' : 'bg-border'}`}
      style={svc.responding ? { boxShadow: '0 0 6px rgba(52,211,153,0.7)' } : {}}
    />
    <div className="flex-1 min-w-0">
      <div className="text-sm font-mono text-text">:{svc.port}</div>
      {svc.framework && <div className="text-[10px] text-muted">{svc.framework}</div>}
      {svc.title && <div className="text-[10px] text-muted truncate" title={svc.title}>{svc.title}</div>}
    </div>
    {svc.responseTime && <div className="text-[9px] text-muted flex-shrink-0">{svc.responseTime}ms</div>}
    {svc.responding && (
      <span className="text-[10px] text-red-core font-semibold flex-shrink-0">Open →</span>
    )}
  </button>
)

export const Home: React.FC = () => {
  const { navigate, activeTabId } = useTabsStore()
  const { settings } = useSettingsStore()
  const [searchInput, setSearchInput] = useState('')
  const [services, setServices] = useState<LocalhostService[]>([])
  const [scanning, setScanning] = useState(false)
  const [recentUrls, setRecentUrls] = useState<string[]>([])

  useEffect(() => {
    window.abumrium.store.getAll().then(store => {
      setRecentUrls(store.recentUrls.slice(0, 8))
    })
    if (settings.enableLocalhostRadar) runScan()
  }, [])

  const runScan = useCallback(async () => {
    setScanning(true)
    try {
      const results = await window.abumrium.radar.scan()
      setServices(results as LocalhostService[])
    } finally {
      setScanning(false)
    }
  }, [])

  const go = useCallback((url: string) => {
    if (activeTabId) navigate(activeTabId, url)
  }, [activeTabId, navigate])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchInput.trim()) go(searchInput.trim())
  }

  const responding = services.filter(s => s.responding)

  return (
    <div className="min-h-full bg-app-bg aperture-bg">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-16">
        {/* Logo + branding */}
        <div className="flex flex-col items-center mb-10">
          <div className="relative mb-5">
            <div className="absolute inset-0 rounded-full blur-2xl opacity-20" style={{ background: 'radial-gradient(circle, #3B405E 0%, transparent 70%)' }} />
            <img
              src={logoUrl}
              alt="Abumrium logo"
              className="w-20 h-20 relative z-10 drop-shadow-lg"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
          <h1 className="text-3xl font-bold text-text mb-1">Abumrium</h1>
          <p className="text-muted text-sm">Chromium, but for builders.</p>
        </div>

        {/* Search / address input */}
        <form onSubmit={handleSearch} className="mb-10">
          <div className="relative">
            <input
              className="input input-mono text-sm py-3 pl-4 pr-16 rounded-lg"
              placeholder="Search or enter URL — try localhost:3000"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              aria-label="Search or navigate"
              id="home-search-input"
              autoFocus
            />
            <button
              type="submit"
              className="absolute right-3 top-1/2 -translate-y-1/2 btn btn-primary py-1.5 px-3 text-xs"
            >
              Go
            </button>
          </div>
        </form>

        {/* Quick action cards */}
        <section className="mb-10">
          <h2 className="text-xs text-muted uppercase mb-3 font-semibold">Quick Access</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {QUICK_CARDS.map(card => (
              <button
                type="button"
                key={card.url}
                className="quick-card text-left"
                onClick={() => go(card.url)}
              >
                <div className="quick-card-icon">{card.icon}</div>
                <div className="text-sm font-semibold text-text truncate">{card.label}</div>
                <div className="text-[11px] text-muted leading-snug">{card.desc}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Localhost Radar */}
        {settings.enableLocalhostRadar && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs text-muted uppercase font-semibold">
                Localhost Radar
                {responding.length > 0 && (
                  <span className="ml-2 text-green-400">• {responding.length} active</span>
                )}
              </h2>
              <button
                type="button"
                className="btn btn-ghost text-[11px] py-1 px-2.5"
                onClick={runScan}
                disabled={scanning}
              >
                {scanning ? 'Scanning…' : '↻ Rescan'}
              </button>
            </div>
            {scanning && services.length === 0 ? (
              <div className="text-muted text-xs text-center py-6">Scanning localhost ports…</div>
            ) : (
              services.length === 0 ? (
                <div className="text-muted text-xs text-center py-6">No localhost services found yet.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {services.map(svc => (
                    <PortStatusCard key={svc.port} svc={svc} onOpen={go} />
                  ))}
                </div>
              )
            )}
          </section>
        )}

        {/* Recent URLs */}
        {recentUrls.length > 0 && (
          <section>
            <h2 className="text-xs text-muted uppercase mb-3 font-semibold">Recent</h2>
            <div className="flex flex-col gap-1">
              {recentUrls.map(url => (
                <button
                  type="button"
                  key={url}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface border border-transparent hover:border-border text-left transition-all group"
                  onClick={() => go(url)}
                >
                  <span className="text-muted text-xs">🔗</span>
                  <span className="font-mono text-[12px] text-muted group-hover:text-text transition-colors truncate">{url}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
