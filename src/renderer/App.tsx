/**
 * App.tsx — Root React component.
 * - Wires up IPC listeners for tab updates, network requests, and console messages.
 * - Handles global keyboard shortcuts forwarded from main.
 * - Renders BrowserShell + CommandPalette overlay.
 */
import React, { useEffect, useState } from 'react'
import { BrowserShell } from './components/BrowserShell'
import { CommandPalette } from './components/CommandPalette'
import { useTabsStore } from './state/tabsStore'
import { useSettingsStore } from './state/settingsStore'
import { useInspectorStore } from './state/inspectorStore'
import type { Tab } from '../shared/types'

// Extend window type for the preload API
declare global {
  interface Window {
    abumrium: import('../preload/index').AbumriumAPI
  }
}

export const App: React.FC = () => {
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false)
  const { _syncFromMain, newTab, closeTab, reload, goBack, goForward } = useTabsStore()
  const { load: loadSettings, settings } = useSettingsStore()
  const { addRequest, addConsoleMessage } = useInspectorStore()

  useEffect(() => {
    // Load settings on startup
    loadSettings()

    // ─── Tab updates from main ────────────────────────────────────────────────
    window.abumrium.tabs.onUpdated(({ tabs, activeTabId }) => {
      _syncFromMain(tabs as Tab[], activeTabId)
    })

    window.abumrium.tabs.getState().then(({ tabs, activeTabId }) => {
      _syncFromMain(tabs as Tab[], activeTabId)
    })

    // ─── Network requests ─────────────────────────────────────────────────────
    window.abumrium.network.onRequest((req) => {
      addRequest(req as Parameters<typeof addRequest>[0])
    })

    // ─── Console messages (Error Lens) ────────────────────────────────────────
    window.abumrium.console.onMessage((msg: unknown) => {
      addConsoleMessage(msg as Parameters<typeof addConsoleMessage>[0])
    })

    // ─── Keyboard shortcuts from main ─────────────────────────────────────────
    window.abumrium.app.onCommandPaletteOpen(() => setCmdPaletteOpen(true))
    window.abumrium.app.onShortcut('new-tab',      () => newTab())
    window.abumrium.app.onShortcut('close-tab',    () => {
      const { tabs, activeTabId } = useTabsStore.getState()
      if (activeTabId) closeTab(activeTabId)
    })
    window.abumrium.app.onShortcut('reload', () => {
      const { tabs, activeTabId } = useTabsStore.getState()
      const active = tabs.find(t => t.id === activeTabId)
      if (active && !active.isInternal) reload(activeTabId!)
    })
    window.abumrium.app.onShortcut('go-back', () => {
      const { tabs, activeTabId } = useTabsStore.getState()
      const active = tabs.find(t => t.id === activeTabId)
      if (active?.canGoBack) goBack(active.id)
    })
    window.abumrium.app.onShortcut('go-forward', () => {
      const { tabs, activeTabId } = useTabsStore.getState()
      const active = tabs.find(t => t.id === activeTabId)
      if (active?.canGoForward) goForward(active.id)
    })
    window.abumrium.app.onShortcut('devtools', () => {
      const { tabs, activeTabId } = useTabsStore.getState()
      const active = tabs.find(t => t.id === activeTabId)
      if (!active) return
      if (active.isInternal) {
        window.abumrium.app.openDevTools()
      } else {
        window.abumrium.tabs.openDevTools(active.id)
      }
    })
    window.abumrium.app.onShortcut('focus-address', () => {
      const el = document.getElementById('address-bar') as HTMLInputElement | null
      el?.focus(); el?.select()
    })

    return () => {
      window.abumrium.tabs.offUpdated()
      window.abumrium.network.offRequest()
      window.abumrium.console.offMessage()
      window.abumrium.app.offCommandPaletteOpen()
      for (const event of ['new-tab', 'close-tab', 'reload', 'go-back', 'go-forward', 'devtools', 'focus-address']) {
        window.abumrium.app.offShortcut(event)
      }
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const applyTheme = () => {
      const systemTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
      root.dataset.theme = settings.theme === 'system' ? systemTheme : settings.theme
    }
    applyTheme()

    if (settings.theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: light)')
    media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [settings.theme])

  return (
    <div className="w-screen h-screen overflow-hidden flex flex-col bg-app-bg">
      <BrowserShell />
      <CommandPalette
        open={cmdPaletteOpen}
        onClose={() => setCmdPaletteOpen(false)}
      />
    </div>
  )
}
