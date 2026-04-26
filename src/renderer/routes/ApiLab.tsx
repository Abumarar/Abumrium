import React, { useState, useCallback } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import type { ApiRequest, ApiResponse, HttpMethod } from '../../shared/types'

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

function methodClass(m: string): string {
  const map: Record<string, string> = {
    GET: 'badge-get', POST: 'badge-post', PUT: 'badge-put',
    PATCH: 'badge-patch', DELETE: 'badge-delete'
  }
  return `badge ${map[m] ?? ''}`
}

function statusClass(s: number): string {
  if (s < 300) return 'badge-2xx'
  if (s < 400) return 'badge-3xx'
  if (s < 500) return 'badge-4xx'
  return 'badge-5xx'
}

function tryFormat(body: string): string {
  try { return JSON.stringify(JSON.parse(body), null, 2) } catch { return body }
}

function buildCurl(method: string, url: string, headers: Record<string, string>, body?: string): string {
  let cmd = `curl -X ${method} '${url}'`
  for (const [k, v] of Object.entries(headers)) cmd += ` \\\n  -H '${k}: ${v}'`
  if (body) cmd += ` \\\n  -d '${body.replace(/'/g, "\\'")}'`
  return cmd
}

function normalizeApiUrl(input: string): string {
  const raw = input.trim()
  if (/^https?:\/\//i.test(raw)) return raw
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(raw)) return `http://${raw}`
  return `https://${raw}`
}

export const ApiLab: React.FC = () => {
  const [method, setMethod] = useState<HttpMethod>('GET')
  const [url, setUrl] = useState('')
  const [headersRaw, setHeadersRaw] = useState('{\n  "Content-Type": "application/json"\n}')
  const [body, setBody] = useState('')
  const [response, setResponse] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'pretty' | 'raw'>('pretty')
  const [activeTab, setActiveTab] = useState<'headers' | 'body'>('headers')
  const [savedRequests, setSavedRequests] = useState<ApiRequest[]>([])
  const [showSaved, setShowSaved] = useState(false)
  const [reqName, setReqName] = useState('')
  const [copied, setCopied] = useState<'curl' | 'body' | null>(null)

  const sendRequest = useCallback(async () => {
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    try {
      let parsedHeaders: Record<string, string> = {}
      try { parsedHeaders = JSON.parse(headersRaw) } catch { /* ignore */ }

      const req: ApiRequest = {
        id: Date.now().toString(),
        method,
        url: normalizeApiUrl(url),
        headers: parsedHeaders,
        body: ['POST', 'PUT', 'PATCH'].includes(method) ? body : undefined,
        createdAt: Date.now(),
      }
      const res = await window.abumrium.api.request(req)
      setResponse(res as ApiResponse)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [method, url, headersRaw, body])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') sendRequest()
  }

  const copyAs = (type: 'curl' | 'body') => {
    if (type === 'curl') {
      if (!url.trim()) return
      let h: Record<string, string> = {}
      try { h = JSON.parse(headersRaw) } catch { h = {} }
      navigator.clipboard.writeText(buildCurl(method, normalizeApiUrl(url), h, body))
    } else if (response) {
      navigator.clipboard.writeText(response.body)
    } else {
      return
    }
    setCopied(type)
    setTimeout(() => setCopied(null), 1500)
  }

  const saveRequest = async () => {
    if (!url.trim()) return
    const store = await window.abumrium.store.getAll()
    let h: Record<string, string> = {}
    try { h = JSON.parse(headersRaw) } catch { h = {} }
    const req: ApiRequest = {
      id: Date.now().toString(),
      name: reqName || url,
      method, url: normalizeApiUrl(url), headers: h, body, createdAt: Date.now()
    }
    const next = [req, ...store.savedRequests].slice(0, 100)
    await window.abumrium.store.set('savedRequests', next)
    setSavedRequests(next)
    setReqName('')
  }

  const loadSaved = async () => {
    const store = await window.abumrium.store.getAll()
    setSavedRequests(store.savedRequests)
    setShowSaved(true)
  }

  const applyRequest = (req: ApiRequest) => {
    setMethod(req.method)
    setUrl(req.url)
    setHeadersRaw(JSON.stringify(req.headers, null, 2))
    setBody(req.body ?? '')
    setShowSaved(false)
  }

  const formattedBody = response ? tryFormat(response.body) : ''

  return (
    <div className="flex flex-col h-full bg-app-bg">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-text">API Lab</h1>
          <p className="text-muted text-xs">Send, debug, repeat</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost text-xs" onClick={loadSaved}>📁 Saved</button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => copyAs('curl')} disabled={!url.trim()}>
            {copied === 'curl' ? '✓ Copied' : '⧉ Copy as cURL'}
          </button>
          <button type="button" className="btn btn-primary text-xs" onClick={saveRequest} disabled={!url.trim()}>Save</button>
        </div>
      </div>

      {showSaved && (
        <div className="mx-6 mt-3 card p-3 max-h-48 overflow-y-auto">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-muted uppercase">Saved Requests</span>
            <button type="button" className="text-muted hover:text-text text-xs" onClick={() => setShowSaved(false)}>✕</button>
          </div>
          {savedRequests.length === 0 ? <div className="text-muted text-xs text-center py-2">No saved requests</div> : savedRequests.map(req => (
            <button type="button" key={req.id} className="flex items-center gap-2 w-full text-left px-2 py-1.5 hover:bg-surface-el rounded text-sm" onClick={() => applyRequest(req)}>
              <span className={methodClass(req.method)}>{req.method}</span>
              <span className="font-mono text-xs text-muted truncate">{req.name ?? req.url}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Request builder */}
        <div className="flex-1 flex flex-col border-r border-border overflow-hidden">
          {/* URL bar */}
          <div className="flex gap-2 px-4 py-3 border-b border-border flex-shrink-0">
            <select
              className="input w-28 flex-shrink-0 font-mono text-xs"
              value={method}
              onChange={e => setMethod(e.target.value as HttpMethod)}
              aria-label="HTTP method"
            >
              {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input
              className="input input-mono flex-1"
              placeholder="https://api.example.com/endpoint"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Request URL"
              id="api-lab-url"
            />
            <button
              type="button"
              className="btn btn-primary flex-shrink-0"
              onClick={sendRequest}
              disabled={loading || !url.trim()}
            >
              {loading ? 'Sending…' : 'Send'}
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border flex-shrink-0">
            {(['headers', 'body'] as const).map(t => (
              <button
                type="button"
                key={t}
                className={`px-4 py-2 text-xs font-medium transition-colors ${activeTab === t ? 'text-text border-b-2 border-red-core' : 'text-muted hover:text-text'}`}
                onClick={() => setActiveTab(t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
            <div className="flex items-center ml-auto px-3 gap-2">
              <input
                className="input text-xs py-1 px-2 w-40"
                placeholder="Request name…"
                value={reqName}
                onChange={e => setReqName(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            {activeTab === 'headers' ? (
              <CodeMirror
                value={headersRaw}
                onChange={setHeadersRaw}
                extensions={[json()]}
                theme={oneDark}
                height="100%"
                basicSetup={{ lineNumbers: true, foldGutter: true }}
              />
            ) : (
              <CodeMirror
                value={body}
                onChange={setBody}
                extensions={[json()]}
                theme={oneDark}
                height="100%"
                placeholder='{"key": "value"}'
                basicSetup={{ lineNumbers: true }}
              />
            )}
          </div>
        </div>

        {/* Response viewer */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {error ? (
            <div className="flex-1 p-6 flex flex-col justify-center items-center">
              <div className="text-red-core text-sm font-mono">{error}</div>
            </div>
          ) : !response ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted text-sm">
              <div className="text-3xl mb-3">⚡</div>
              <div>Send a request to see the response</div>
            </div>
          ) : (
            <>
              {/* Response meta */}
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border flex-shrink-0 flex-wrap">
                <span className={`badge ${statusClass(response.status)}`}>{response.status} {response.statusText}</span>
                <span className="text-muted text-xs font-mono">{response.time}ms</span>
                <span className="text-muted text-xs font-mono">{((response.size ?? response.body.length) / 1024).toFixed(1)}KB</span>
                <div className="ml-auto flex gap-2">
                  {(['pretty', 'raw'] as const).map(v => (
                    <button type="button" key={v} className={`text-xs px-2 py-1 rounded transition-colors ${viewMode === v ? 'bg-surface-el text-text' : 'text-muted hover:text-text'}`} onClick={() => setViewMode(v)}>{v}</button>
                  ))}
                  <button type="button" className="btn btn-ghost text-xs py-1 px-2" onClick={() => copyAs('body')}>
                    {copied === 'body' ? '✓' : '⧉'}
                  </button>
                </div>
              </div>

              {/* Response headers */}
              <details className="px-4 py-2 border-b border-border text-xs flex-shrink-0">
                <summary className="text-muted cursor-pointer hover:text-text">Response Headers ({Object.keys(response.headers).length})</summary>
                <div className="mt-2 space-y-0.5 font-mono">
                  {Object.entries(response.headers).map(([k, v]) => (
                    <div key={k}><span className="text-navy">{k}:</span> <span className="text-muted">{v}</span></div>
                  ))}
                </div>
              </details>

              {/* Body */}
              <div className="flex-1 overflow-hidden">
                <CodeMirror
                  value={viewMode === 'pretty' ? formattedBody : response.body}
                  extensions={[json()]}
                  theme={oneDark}
                  height="100%"
                  editable={false}
                  basicSetup={{ lineNumbers: true, foldGutter: true }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
