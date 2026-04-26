import React, { useCallback } from 'react'
import { useTabsStore } from '../state/tabsStore'
import { ContainerBadge } from './ContainerBadge'
import internalTabIconUrl from '../assets/icon.png'

interface Props {
  onNewTab: () => void
}

export const TabStrip: React.FC<Props> = ({ onNewTab }) => {
  const { tabs, activeTabId, switchTab, closeTab } = useTabsStore()

  const handleClose = useCallback((e: React.MouseEvent, tabId: string) => {
    e.stopPropagation()
    closeTab(tabId)
  }, [closeTab])

  return (
    <div
      className="flex items-center bg-toolbar border-b border-border drag-region overflow-x-auto"
      style={{ height: 36, minHeight: 36, flexShrink: 0 }}
    >
      {/* macOS traffic lights spacer */}
      {navigator.userAgent.includes('Mac') && <div className="w-20 flex-shrink-0 no-drag" />}

      <div className="flex flex-1 overflow-x-auto no-drag" style={{ scrollbarWidth: 'none' }}>
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab no-drag ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => switchTab(tab.id)}
            title={tab.title}
          >
            {/* Loading spinner */}
            {tab.isLoading ? (
              <span className="flex-shrink-0 w-3 h-3 rounded-full border border-red-core border-t-transparent animate-spin" style={{ borderColor: '#C1122F', borderTopColor: 'transparent' }} />
            ) : tab.favicon ? (
              <img src={tab.favicon} alt="" className="flex-shrink-0 w-3.5 h-3.5 rounded-sm object-contain" />
            ) : tab.isInternal ? (
              <img src={internalTabIconUrl} alt="" className="flex-shrink-0 w-3.5 h-3.5 rounded-sm object-contain" />
            ) : (
              <span className="flex-shrink-0 text-[10px] text-muted">
                ●
              </span>
            )}
            <span className="flex-1 truncate text-[12px]">{tab.title || 'New Tab'}</span>
            <ContainerBadge containerId={tab.containerId} size="sm" />
            <button
              type="button"
              className="no-drag flex-shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-surface-el hover:text-text opacity-60 hover:opacity-100 transition-opacity"
              onClick={e => handleClose(e, tab.id)}
              aria-label="Close tab"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* New tab button */}
      <button
        type="button"
        className="no-drag flex-shrink-0 w-8 h-8 flex items-center justify-center text-muted hover:text-text hover:bg-surface-el rounded transition-colors mx-1"
        onClick={onNewTab}
        title="New Tab (Ctrl+T)"
        aria-label="New Tab"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  )
}
