import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { testRegex, buildHighlightedSegments } from '../../shared/utils/regexUtils'
import { DEFAULT_REGEX_SNIPPETS } from '../../shared/constants'
import type { RegexSnippet } from '../../shared/types'

const SAMPLE_TEXT = `The quick brown fox jumps over the lazy dog.
Contact us at hello@example.com or admin@test.org
Visit https://www.example.com/api/v2?key=value
UUID: 550e8400-e29b-41d4-a716-446655440000
Date: 2024-01-15, Color: #ff5733 or #abc
Phone: 123-456-7890, ZIP: 90210`

export const RegexLab: React.FC = () => {
  const [pattern, setPattern] = useState('')
  const [flags, setFlags]     = useState('g')
  const [testText, setTestText] = useState(SAMPLE_TEXT)
  const [snippets, setSnippets] = useState<RegexSnippet[]>(DEFAULT_REGEX_SNIPPETS)
  const [newSnippetName, setNewSnippetName] = useState('')

  useEffect(() => {
    window.abumrium.store.getAll().then(store => {
      setSnippets(store.regexSnippets.length ? store.regexSnippets : DEFAULT_REGEX_SNIPPETS)
    })
  }, [])

  const result = useMemo(() => testRegex(pattern, flags, testText), [pattern, flags, testText])
  const segments = useMemo(
    () => result.valid ? buildHighlightedSegments(testText, result.matches) : [],
    [testText, result]
  )

  const loadSnippet = (s: RegexSnippet) => {
    setPattern(s.pattern)
    setFlags(s.flags)
  }

  const saveSnippet = useCallback(async () => {
    if (!pattern.trim() || !newSnippetName.trim()) return
    const s: RegexSnippet = {
      id: Date.now().toString(), name: newSnippetName.trim(), pattern, flags
    }
    const next = [...snippets, s]
    setSnippets(next)
    await window.abumrium.store.set('regexSnippets', next)
    setNewSnippetName('')
  }, [pattern, flags, newSnippetName, snippets])

  return (
    <div className="flex flex-col h-full bg-app-bg">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-text">Regex Lab</h1>
          <p className="text-muted text-xs">Test patterns, find matches</p>
        </div>
        {result.valid && pattern && (
          <div className="text-sm font-semibold" style={{ color: result.count > 0 ? '#34d399' : '#8B94A7' }}>
            {result.count} match{result.count !== 1 ? 'es' : ''}
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Regex input */}
          <div className="px-4 py-3 border-b border-border flex-shrink-0 space-y-2">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-mono text-sm select-none">/</span>
                <input
                  className="input input-mono pl-6 pr-2"
                  placeholder="Enter regex pattern…"
                  value={pattern}
                  onChange={e => setPattern(e.target.value)}
                  aria-label="Regex pattern"
                  id="regex-pattern"
                  style={!result.valid ? { borderColor: '#C1122F', boxShadow: '0 0 0 2px rgba(193,18,47,0.2)' } : {}}
                />
              </div>
              <div className="relative w-20">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-mono text-sm select-none">/</span>
                <input
                  className="input input-mono pl-5"
                  placeholder="gim"
                  value={flags}
                  onChange={e => setFlags(e.target.value)}
                  aria-label="Regex flags"
                  maxLength={6}
                />
              </div>
            </div>
            {!result.valid && result.error && (
              <div className="text-xs font-mono text-red-core">{result.error}</div>
            )}
          </div>

          {/* Test text */}
          <div className="px-4 py-2 border-b border-border text-[10px] text-muted uppercase font-semibold flex-shrink-0">
            Test Text
          </div>
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <textarea
              className="input input-mono flex-1 resize-none rounded-none border-0 border-b border-border focus:ring-0 focus:border-border"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
              value={testText}
              onChange={e => setTestText(e.target.value)}
              aria-label="Test text"
              id="regex-test-text"
            />
            {/* Highlighted output */}
            <div className="flex-1 overflow-y-auto p-4 font-mono text-[12px] leading-6 whitespace-pre-wrap break-all">
              {segments.length > 0 ? segments.map((seg, i) => (
                seg.isMatch ? (
                  <mark
                    key={i}
                    className="rounded px-0.5"
                    style={{ background: 'rgba(193,18,47,0.25)', color: '#E6EAF2', outline: '1px solid rgba(193,18,47,0.4)' }}
                    title={`Match ${(seg.matchIndex ?? 0) + 1}`}
                  >
                    {seg.text}
                  </mark>
                ) : (
                  <span key={i} className="text-muted">{seg.text}</span>
                )
              )) : (
                <span className="text-muted opacity-50">Highlighted matches will appear here</span>
              )}
            </div>
          </div>
        </div>

        {/* Side: capture groups + snippets */}
        <div className="w-72 border-l border-border flex flex-col overflow-hidden">
          {/* Capture groups */}
          <div className="px-3 py-2 border-b border-border text-[10px] text-muted uppercase font-semibold flex-shrink-0">
            Capture Groups
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
            {result.matches.slice(0, 20).map((m, i) => (
              <div key={i} className="card p-2 text-xs">
                <div className="text-muted mb-1 text-[10px]">Match {i + 1} @ {m.index}</div>
                <div className="font-mono text-text break-all">{m.fullMatch || '(empty)'}</div>
                {m.groups.filter(Boolean).map((g, gi) => (
                  <div key={gi} className="font-mono text-navy mt-0.5 text-[10px]">Group {gi + 1}: {g}</div>
                ))}
              </div>
            ))}
            {result.matches.length > 20 && (
              <div className="text-muted text-xs text-center py-2">+{result.matches.length - 20} more matches</div>
            )}
          </div>

          {/* Snippets */}
          <div className="border-t border-border">
            <div className="px-3 py-2 text-[10px] text-muted uppercase font-semibold">Snippets</div>
            <div className="flex gap-1 px-2 pb-2">
              <input
                className="input text-xs py-1 px-2 flex-1"
                placeholder="Snippet name…"
                value={newSnippetName}
                onChange={e => setNewSnippetName(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-primary text-xs py-1 px-2"
                onClick={saveSnippet}
                disabled={!pattern.trim() || !newSnippetName.trim()}
              >
                Save
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto pb-2">
              {snippets.map(s => (
                <button
                  type="button"
                  key={s.id}
                  className="w-full text-left px-3 py-2 hover:bg-surface-el transition-colors"
                  onClick={() => loadSnippet(s)}
                  title={s.description}
                >
                  <div className="text-xs text-text">{s.name}</div>
                  <div className="font-mono text-[10px] text-muted truncate">/{s.pattern}/{s.flags}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
