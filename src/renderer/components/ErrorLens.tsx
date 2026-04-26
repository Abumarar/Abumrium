import React, { useMemo } from 'react'
import { useInspectorStore } from '../state/inspectorStore'
import { useActiveTab } from '../state/tabsStore'

const ERROR_TYPE_COLORS: Record<string, string> = {
  'CORS':           '#E21B3C',
  'CSP':            '#C1122F',
  'Mixed Content':  '#fbbf24',
  'Network Error':  '#8B94A7',
  '404':            '#63b3ed',
  'Module Import':  '#a78bfa',
  'WebSocket':      '#34d399',
}

export const ErrorLensPanel: React.FC = () => {
  const activeTab = useActiveTab()
  const { consoleMessages, errorLensOpen, clearConsoleMessages } = useInspectorStore()

  const tabMessages = useMemo(() => {
    if (!activeTab) return []
    return consoleMessages.filter(m => m.tabId === activeTab.id)
  }, [consoleMessages, activeTab])

  if (!errorLensOpen) return null

  return (
    <div className="side-panel slide-in-right">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
        <span className="text-xs font-semibold text-text uppercase">Error Lens</span>
        <button
          type="button"
          className="text-muted hover:text-text transition-colors text-xs"
          onClick={() => activeTab && clearConsoleMessages(activeTab.id)}
          disabled={!activeTab}
        >
          Clear
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tabMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted text-xs text-center p-4">
            <div className="text-2xl mb-2">⚠</div>
            <div>No errors detected.</div>
            <div className="mt-1 opacity-60">Console errors from the active page appear here.</div>
          </div>
        ) : (
          tabMessages.map((msg, i) => {
            const color = msg.errorType ? (ERROR_TYPE_COLORS[msg.errorType] ?? '#8B94A7') : '#8B94A7'
            return (
              <div key={i} className="px-3 py-2.5 border-b border-border hover:bg-surface-el transition-colors">
                <div className="flex items-start justify-between gap-2 mb-1">
                  {msg.errorType && (
                    <span
                      className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ background: `${color}20`, color }}
                    >
                      {msg.errorType}
                    </span>
                  )}
                  <button
                    type="button"
                    className="text-muted hover:text-text text-[10px] ml-auto flex-shrink-0"
                    onClick={() => navigator.clipboard.writeText(msg.message)}
                    title="Copy"
                  >
                    Copy
                  </button>
                </div>
                <div className="font-mono text-[10px] text-text leading-relaxed mb-1 break-all">
                  {msg.message}
                </div>
                {msg.explanation && (
                  <div className="text-[10px] text-muted border-l-2 pl-2 mt-1.5 leading-relaxed" style={{ borderColor: color }}>
                    {msg.explanation}
                  </div>
                )}
                {msg.sourceId && (
                  <div className="font-mono text-[9px] text-muted mt-1 opacity-60 truncate">{msg.sourceId}:{msg.line}</div>
                )}
              </div>
            )
          })
        )}
      </div>

      <div className="px-3 py-1.5 border-t border-border text-[10px] text-muted flex-shrink-0">
        {tabMessages.length} error{tabMessages.length !== 1 ? 's' : ''} • Errors are not sent externally
      </div>
    </div>
  )
}
