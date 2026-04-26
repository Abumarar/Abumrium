import React, { useMemo } from 'react'
import { useInspectorStore } from '../state/inspectorStore'
import { useActiveTab } from '../state/tabsStore'

function methodBadge(method: string): string {
  const m = method?.toUpperCase()
  if (m === 'GET')    return 'badge badge-get'
  if (m === 'POST')   return 'badge badge-post'
  if (m === 'PUT')    return 'badge badge-put'
  if (m === 'PATCH')  return 'badge badge-patch'
  if (m === 'DELETE') return 'badge badge-delete'
  return 'badge'
}

function statusBadge(status?: number): string {
  if (!status) return 'badge badge-0xx'
  if (status < 300) return 'badge badge-2xx'
  if (status < 400) return 'badge badge-3xx'
  if (status < 500) return 'badge badge-4xx'
  return 'badge badge-5xx'
}

export const RequestInspectorPanel: React.FC = () => {
  const activeTab = useActiveTab()
  const { requests, filter, setFilter, clearRequests, inspectorOpen } = useInspectorStore()

  const tabRequests = useMemo(() => {
    if (!activeTab) return []
    return requests
      .filter(r => r.tabId === activeTab.id)
      .filter(r => !filter || r.url.includes(filter) || r.method.includes(filter.toUpperCase()))
  }, [requests, activeTab, filter])

  if (!inspectorOpen) return null

  return (
    <div className="side-panel slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
        <span className="text-xs font-semibold text-text uppercase">Request Inspector</span>
        <button
          type="button"
          className="text-muted hover:text-text transition-colors text-xs"
          onClick={() => activeTab && clearRequests(activeTab.id)}
          disabled={!activeTab}
          title="Clear"
        >
          Clear
        </button>
      </div>

      {/* Filter */}
      <div className="px-2 py-1.5 border-b border-border flex-shrink-0">
        <input
          className="input input-mono text-[11px]"
          placeholder="Filter by URL or method…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          aria-label="Filter requests"
        />
      </div>

      {/* Log */}
      <div className="flex-1 overflow-y-auto">
        {tabRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted text-xs text-center p-4">
            <div className="text-2xl mb-2">⌲</div>
            <div>Inspect what your app is doing.</div>
            <div className="mt-1 opacity-60">Navigate to a web page to see requests.</div>
          </div>
        ) : (
          tabRequests.map(req => (
            <div key={req.id} className="px-2 py-1.5 border-b border-border hover:bg-surface-el transition-colors">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={methodBadge(req.method)}>{req.method}</span>
                {req.status && <span className={statusBadge(req.status)}>{req.status}</span>}
                {req.resourceType && <span className="badge" style={{ background: '#303A3D30', color: '#8B94A7' }}>{req.resourceType}</span>}
                {req.duration && <span className="text-[9px] text-muted ml-auto">{req.duration}ms</span>}
              </div>
              <div className="font-mono text-[10px] text-muted truncate" title={req.url}>
                {req.url}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-3 py-1.5 border-t border-border text-[10px] text-muted flex-shrink-0">
        {tabRequests.length} request{tabRequests.length !== 1 ? 's' : ''} • Bodies not captured
      </div>
    </div>
  )
}
