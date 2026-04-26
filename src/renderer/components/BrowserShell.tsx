import React, { useEffect, useRef, useCallback } from 'react'
import { useTabsStore, useActiveTab } from '../state/tabsStore'
import { useInspectorStore } from '../state/inspectorStore'
import { useSettingsStore } from '../state/settingsStore'
import { TabStrip } from './TabStrip'
import { Toolbar } from './Toolbar'
import { RequestInspectorPanel } from './RequestInspector'
import { ErrorLensPanel } from './ErrorLens'
import { INTERNAL_URLS, LAYOUT } from '../../shared/constants'

// Internal page routes
import { Home }      from '../routes/Home'
import { ApiLab }    from '../routes/ApiLab'
import { JsonTools } from '../routes/JsonTools'
import { RegexLab }  from '../routes/RegexLab'
import { Settings }  from '../routes/Settings'

function InternalPage({ route }: { route: string }) {
  switch (route) {
    case 'home':       return <Home />
    case 'api-lab':    return <ApiLab />
    case 'json-tools': return <JsonTools />
    case 'regex-lab':  return <RegexLab />
    case 'settings':   return <Settings />
    default:           return <Home />
  }
}

function ErrorPage({ error, onRetry, onHome }: { error: string; onRetry: () => void; onHome: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 aperture-bg">
      <div className="text-5xl mb-4">⚠</div>
      <h2 className="text-xl font-semibold text-text mb-2">Navigation Error</h2>
      <p className="text-muted text-sm font-mono break-all max-w-lg">{error}</p>
      <div className="flex items-center gap-2 mt-6">
        <button type="button" className="btn btn-primary" onClick={onRetry}>Retry</button>
        <button type="button" className="btn btn-ghost" onClick={onHome}>Home</button>
      </div>
    </div>
  )
}

function StartupPage() {
  return (
    <div className="flex h-full items-center justify-center bg-app-bg aperture-bg">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 rounded-full border border-red-core border-t-transparent animate-spin" />
        <div className="text-sm font-semibold text-text">Starting Abumrium</div>
        <div className="mt-1 text-xs text-muted">Preparing your first tab...</div>
      </div>
    </div>
  )
}

export const BrowserShell: React.FC = () => {
  const { newTab, reload, navigate } = useTabsStore()
  const activeTab = useActiveTab()
  const { inspectorOpen, errorLensOpen } = useInspectorStore()
  const { settings } = useSettingsStore()
  const contentRef = useRef<HTMLDivElement>(null)

  // Report content area bounds to main process (positions WebContentsView)
  const reportBounds = useCallback(() => {
    if (!contentRef.current) return
    const rect = contentRef.current.getBoundingClientRect()
    window.abumrium.layout.setContentBounds(
      Math.round(rect.x),
      Math.round(rect.y),
      Math.round(rect.width),
      Math.round(rect.height)
    )
  }, [])

  const showInternalPage = activeTab?.isInternal
  const showInspector = settings.enableRequestInspector && inspectorOpen

  useEffect(() => {
    reportBounds()
    const ro = new ResizeObserver(reportBounds)
    if (contentRef.current) ro.observe(contentRef.current)
    return () => ro.disconnect()
  }, [reportBounds, activeTab?.isInternal, showInspector, errorLensOpen])

  return (
    <div className="flex flex-col w-full h-full overflow-hidden" style={{ background: 'var(--color-app-bg)' }}>
      {/* Tab strip */}
      <TabStrip onNewTab={() => newTab()} />

      {/* Toolbar */}
      <Toolbar />

      {/* Content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-hidden relative" ref={contentRef}>
          {!activeTab ? (
            <StartupPage />
          ) : activeTab.error ? (
            <ErrorPage
              error={activeTab.error}
              onRetry={() => reload(activeTab.id)}
              onHome={() => navigate(activeTab.id, INTERNAL_URLS.HOME)}
            />
          ) : showInternalPage && activeTab?.internalRoute ? (
            <div className="h-full overflow-y-auto fade-in">
              <InternalPage route={activeTab.internalRoute} />
            </div>
          ) : (
            // External page: WebContentsView overlay is positioned here by main
            // This div is intentionally transparent / empty
            <div className="h-full w-full" />
          )}
        </div>

        {/* Side panels (only when viewing external pages or no active tab) */}
        {showInspector && <RequestInspectorPanel />}
        {errorLensOpen  && <ErrorLensPanel />}
      </div>
    </div>
  )
}
