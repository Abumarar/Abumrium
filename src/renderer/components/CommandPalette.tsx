import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useTabsStore, useActiveTab } from '../state/tabsStore'
import { useInspectorStore } from '../state/inspectorStore'
import { useSettingsStore } from '../state/settingsStore'
import { INTERNAL_URLS } from '../../shared/constants'

interface Command {
  id: string
  label: string
  description?: string
  icon: string
  action: () => void
}

interface Props {
  open: boolean
  onClose: () => void
}

export const CommandPalette: React.FC<Props> = ({ open, onClose }) => {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const activeTab = useActiveTab()
  const { newTab, closeTab, reload, stopLoading, navigate } = useTabsStore()
  const { toggleInspector, toggleErrorLens } = useInspectorStore()
  const { settings } = useSettingsStore()

  const openDevTools = () => {
    if (!activeTab) return
    if (activeTab.isInternal) {
      window.abumrium.app.openDevTools()
    } else {
      window.abumrium.tabs.openDevTools(activeTab.id)
    }
  }

  const clearActiveData = () => {
    if (!activeTab) return
    if (activeTab.isInternal) {
      window.abumrium.app.clearContainerData(activeTab.containerId)
    } else {
      window.abumrium.app.clearSiteData(activeTab.id)
    }
  }

  const commands: Command[] = [
    { id: 'new-tab',      label: 'New Tab',              icon: '＋', action: () => newTab() },
    { id: 'close-tab',    label: 'Close Tab',             icon: '✕', action: () => activeTab && closeTab(activeTab.id) },
    ...(!activeTab?.isInternal ? [{ id: 'reload', label: activeTab?.isLoading ? 'Stop Loading' : 'Reload', icon: activeTab?.isLoading ? '×' : '↻', action: () => activeTab && (activeTab.isLoading ? stopLoading(activeTab.id) : reload(activeTab.id)) }] : []),
    { id: 'home',         label: 'Go Home',               icon: '⌂', action: () => activeTab && navigate(activeTab.id, INTERNAL_URLS.HOME) },
    { id: 'api-lab',      label: 'Open API Lab',          icon: '⚡', description: 'Send, debug, repeat', action: () => activeTab && navigate(activeTab.id, INTERNAL_URLS.API_LAB) },
    { id: 'json-tools',   label: 'Open JSON Tools',       icon: '{ }', description: 'Format, validate, and generate', action: () => activeTab && navigate(activeTab.id, INTERNAL_URLS.JSON_TOOLS) },
    { id: 'regex-lab',    label: 'Open Regex Lab',        icon: '.*', description: 'Test regex patterns', action: () => activeTab && navigate(activeTab.id, INTERNAL_URLS.REGEX_LAB) },
    { id: 'settings',     label: 'Open Settings',         icon: '⚙', action: () => activeTab && navigate(activeTab.id, INTERNAL_URLS.SETTINGS) },
    { id: 'devtools',     label: activeTab?.isInternal ? 'Open App DevTools' : 'Open Page DevTools', icon: '🔧', action: openDevTools },
    ...(settings.enableRequestInspector ? [{ id: 'inspector', label: 'Toggle Request Inspector', icon: '⌲', action: () => toggleInspector() }] : []),
    { id: 'error-lens',   label: 'Toggle Error Lens',     icon: '⚠', action: () => toggleErrorLens() },
    { id: 'clear-data',   label: activeTab?.isInternal ? 'Clear Container Data' : 'Clear Site Data', icon: '🗑', action: clearActiveData },
    { id: 'copy-url',     label: 'Copy URL as Markdown',  icon: '📋', action: () => { if (activeTab) { const md = `[${activeTab.title}](${activeTab.url})`; navigator.clipboard.writeText(md) } } },
    { id: 'localhost',    label: 'Open localhost:3000',   icon: '🖥', action: () => activeTab && navigate(activeTab.id, 'http://localhost:3000') },
  ]

  const filtered = query
    ? commands.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.description?.toLowerCase().includes(query.toLowerCase())
      )
    : commands

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => { setSelected(0) }, [query])

  const runCommand = useCallback((cmd: Command) => {
    cmd.action()
    onClose()
  }, [onClose])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && filtered[selected]) { runCommand(filtered[selected]) }
  }

  if (!open) return null

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette fade-in" onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <span className="text-muted text-sm">⌘</span>
          <input
            ref={inputRef}
            className="flex-1 bg-transparent outline-none text-text text-sm placeholder-muted"
            placeholder="Type a command…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Command palette search"
            id="command-palette-input"
          />
          <span className="text-[10px] text-muted border border-border rounded px-1.5 py-0.5">ESC</span>
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-muted text-sm text-center">No commands found</div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                type="button"
                key={cmd.id}
                className={`command-item ${i === selected ? 'selected' : ''}`}
                onClick={() => runCommand(cmd)}
                onMouseEnter={() => setSelected(i)}
              >
                <span className="text-base w-6 text-center flex-shrink-0">{cmd.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm">{cmd.label}</div>
                  {cmd.description && <div className="text-[11px] text-muted">{cmd.description}</div>}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-border flex gap-3 text-[10px] text-muted">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>ESC close</span>
        </div>
      </div>
    </div>
  )
}
