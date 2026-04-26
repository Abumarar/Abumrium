import React, { useState, useCallback } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import { parseJson, jsonToTypeScript, jsonToZod } from '../../shared/utils/jsonUtils'

type OutputMode = 'formatted' | 'minified' | 'typescript' | 'zod'

export const JsonTools: React.FC = () => {
  const [input, setInput] = useState('')
  const [outputMode, setOutputMode] = useState<OutputMode>('formatted')
  const [copied, setCopied] = useState(false)
  const [rootName, setRootName] = useState('Root')

  const result = input.trim() ? parseJson(input) : null

  const output = useCallback((): string => {
    if (!input.trim()) return ''
    if (!result?.valid) return result?.error ?? ''
    switch (outputMode) {
      case 'formatted':  return result.formatted ?? ''
      case 'minified':   return result.minified ?? ''
      case 'typescript': return jsonToTypeScript(input, rootName)
      case 'zod':        return jsonToZod(input, rootName.charAt(0).toLowerCase() + rootName.slice(1) + 'Schema')
    }
  }, [input, outputMode, result, rootName])

  const copy = () => {
    navigator.clipboard.writeText(output())
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const TABS: { id: OutputMode; label: string }[] = [
    { id: 'formatted',  label: '{ } Format' },
    { id: 'minified',   label: '⊟ Minify'   },
    { id: 'typescript', label: 'TS Interface' },
    { id: 'zod',        label: 'Zod Schema' },
  ]

  const outputValue = output()

  return (
    <div className="flex flex-col h-full bg-app-bg">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-text">JSON Tools</h1>
          <p className="text-muted text-xs">Format, validate, and generate</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="input text-xs py-1 px-2 w-28"
            placeholder="Root name"
            value={rootName}
            onChange={e => setRootName(e.target.value)}
            title="Type/interface root name for TS/Zod output"
          />
          <button type="button" className="btn btn-ghost text-xs" onClick={() => setInput('')} disabled={!input.trim()}>Clear</button>
          <button type="button" className="btn btn-primary text-xs" onClick={copy} disabled={!outputValue}>
            {copied ? '✓ Copied' : '⧉ Copy output'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Input pane */}
        <div className="flex-1 flex flex-col border-r border-border overflow-hidden">
          <div className="px-4 py-2 border-b border-border flex-shrink-0 text-[10px] text-muted uppercase font-semibold">
            Input JSON
          </div>
          <div className="flex-1 overflow-hidden">
            <CodeMirror
              value={input}
              onChange={setInput}
              extensions={[json()]}
              theme={oneDark}
              height="100%"
              placeholder='Paste JSON here…'
              basicSetup={{ lineNumbers: true, foldGutter: true }}
            />
          </div>
          {result && (
            <div className={`px-4 py-2 text-xs font-mono border-t flex-shrink-0 ${result.valid ? 'border-green-400/20 text-green-400' : 'border-red-core/30 text-red-core'}`}>
              {result.valid
                ? `✓ Valid JSON`
                : `✕ ${result.error}${result.errorLine ? ` (line ${result.errorLine})` : ''}`
              }
            </div>
          )}
        </div>

        {/* Output pane */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center border-b border-border flex-shrink-0">
            {TABS.map(t => (
              <button
                type="button"
                key={t.id}
                className={`px-4 py-2.5 text-xs font-medium transition-colors ${outputMode === t.id ? 'text-text border-b-2 border-red-core' : 'text-muted hover:text-text'}`}
                onClick={() => setOutputMode(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-hidden">
            <CodeMirror
              value={outputValue}
              extensions={[json()]}
              theme={oneDark}
              height="100%"
              editable={false}
              basicSetup={{ lineNumbers: true, foldGutter: true }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
