import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useTabsStore, useActiveTab } from '../state/tabsStore'
import { useInspectorStore } from '../state/inspectorStore'
import { useSettingsStore } from '../state/settingsStore'
import { ContainerBadge } from './ContainerBadge'
import { CONTAINERS, INTERNAL_URLS } from '../../shared/constants'
import type { ContainerId } from '../../shared/types'

// SVG icon helpers
const Icon = ({ d, size = 14 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

function addressMeta(url: string): { label: string; tone: 'internal' | 'secure' | 'plain' } {
  if (url.startsWith('abumrium://')) return { label: 'Abumrium', tone: 'internal' }
  if (url.startsWith('https://')) return { label: 'Secure', tone: 'secure' }
  if (url.startsWith('http://')) return { label: 'HTTP', tone: 'plain' }
  return { label: 'Search', tone: 'plain' }
}

export const Toolbar: React.FC = () => {
  const activeTab = useActiveTab()
  const { goBack, goForward, reload, stopLoading, navigate, newTab } = useTabsStore()
  const { inspectorOpen, errorLensOpen, toggleInspector, toggleErrorLens } = useInspectorStore()
  const { settings } = useSettingsStore()

  const [addressValue, setAddressValue] = useState('')
  const [isAddressFocused, setIsAddressFocused] = useState(false)
  const [containerMenuOpen, setContainerMenuOpen] = useState(false)
  const addressRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Sync address bar with active tab URL
  useEffect(() => {
    if (!isAddressFocused && activeTab) {
      setAddressValue(activeTab.url)
    }
  }, [activeTab?.url, isAddressFocused])

  const handleAddressSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (activeTab) {
      navigate(activeTab.id, addressValue)
      addressRef.current?.blur()
    }
  }, [activeTab, addressValue, navigate])

  const handleNewTabInContainer = useCallback((containerId: ContainerId) => {
    newTab(undefined, containerId)
    setContainerMenuOpen(false)
  }, [newTab])

  useEffect(() => {
    if (!containerMenuOpen) return

    const handlePointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setContainerMenuOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContainerMenuOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [containerMenuOpen])

  if (!activeTab) return null

  const openDevTools = () => {
    if (activeTab.isInternal) {
      window.abumrium.app.openDevTools()
    } else {
      window.abumrium.tabs.openDevTools(activeTab.id)
    }
  }

  const meta = addressMeta(activeTab.url)

  return (
    <div
      className="browser-toolbar no-drag"
      style={{ height: 44, minHeight: 44, flexShrink: 0 }}
    >
      <div className="toolbar-group">
        <button
          type="button"
          className="toolbar-btn"
          disabled={!activeTab.canGoBack}
          onClick={() => goBack(activeTab.id)}
          title="Back"
          aria-label="Go back"
        >
          <Icon d="M19 12H5M12 5l-7 7 7 7" />
        </button>

        <button
          type="button"
          className="toolbar-btn"
          disabled={!activeTab.canGoForward}
          onClick={() => goForward(activeTab.id)}
          title="Forward"
          aria-label="Go forward"
        >
          <Icon d="M5 12h14M12 5l7 7-7 7" />
        </button>

        <button
          type="button"
          className="toolbar-btn"
          onClick={() => activeTab.isLoading ? stopLoading(activeTab.id) : reload(activeTab.id)}
          disabled={activeTab.isInternal}
          title={activeTab.isLoading ? 'Stop loading' : activeTab.isInternal ? 'Internal pages update live' : 'Reload'}
          aria-label={activeTab.isLoading ? 'Stop loading' : 'Reload'}
        >
          {activeTab.isLoading ? (
            <Icon d="M6 18L18 6M6 6l12 12" />
          ) : (
            <Icon d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          )}
        </button>

        <button
          type="button"
          className="toolbar-btn"
          onClick={() => navigate(activeTab.id, INTERNAL_URLS.HOME)}
          title="Home"
          aria-label="Go home"
        >
          <Icon d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10" />
        </button>
      </div>

      <form onSubmit={handleAddressSubmit} className="address-form">
        <div className="address-shell">
          <span className={`address-chip ${meta.tone}`}>{meta.label}</span>
          <input
            ref={addressRef}
            className="address-bar"
            value={addressValue}
            onChange={e => setAddressValue(e.target.value)}
            onFocus={() => {
              setIsAddressFocused(true)
              addressRef.current?.select()
            }}
            onBlur={() => setIsAddressFocused(false)}
            placeholder="Search or enter URL — abumrium://home"
            aria-label="Address bar"
            id="address-bar"
            spellCheck={false}
            autoComplete="off"
          />
          {activeTab.isLoading && (
            <div className="loading-bar">
              <div className="loading-bar-inner" />
            </div>
          )}
        </div>
      </form>

      <div className="toolbar-group toolbar-tools">
        <div className="relative no-drag" ref={menuRef}>
          <button
            type="button"
            className="toolbar-btn toolbar-profile"
            onClick={() => setContainerMenuOpen(o => !o)}
            title="New tab container"
            aria-label="Container selector"
            aria-expanded={containerMenuOpen}
          >
            <ContainerBadge containerId={activeTab.containerId} size="sm" />
          </button>

          {containerMenuOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 card w-44 py-1 shadow-xl fade-in">
              <div className="px-3 py-1.5 text-[10px] text-muted uppercase">New tab in</div>
              {CONTAINERS.map(c => (
                <button
                  type="button"
                  key={c.id}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-el text-sm text-text transition-colors"
                  onClick={() => handleNewTabInContainer(c.id)}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {settings.enableRequestInspector && (
          <button
            type="button"
            className={`toolbar-btn ${inspectorOpen ? 'active' : ''}`}
            onClick={toggleInspector}
            title="Request Inspector"
            aria-label="Toggle request inspector"
            aria-pressed={inspectorOpen}
          >
            <Icon d="M4 6h16M4 12h16M4 18h7" />
          </button>
        )}

        <button
          type="button"
          className={`toolbar-btn ${errorLensOpen ? 'active' : ''}`}
          onClick={toggleErrorLens}
          title="Error Lens"
          aria-label="Toggle error lens"
          aria-pressed={errorLensOpen}
        >
          <Icon d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
        </button>

        <span className="toolbar-separator" />

        <button
          type="button"
          className="toolbar-btn"
          onClick={openDevTools}
          title={activeTab.isInternal ? 'App DevTools' : 'Page DevTools'}
          aria-label="Open DevTools"
        >
          <Icon d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
        </button>

        <button
          type="button"
          className="toolbar-btn"
          onClick={() => navigate(activeTab.id, INTERNAL_URLS.SETTINGS)}
          title="Settings"
          aria-label="Open settings"
        >
          <Icon d="M12 20a8 8 0 100-16 8 8 0 000 16zM12 14a2 2 0 100-4 2 2 0 000 4z" />
        </button>
      </div>
    </div>
  )
}
