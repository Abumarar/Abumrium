/** JSON utilities for JSON Tools page */

export interface JsonResult {
  valid: boolean
  formatted?: string
  minified?: string
  error?: string
  errorLine?: number
}

export function parseJson(input: string): JsonResult {
  try {
    const parsed = JSON.parse(input)
    return {
      valid: true,
      formatted: JSON.stringify(parsed, null, 2),
      minified: JSON.stringify(parsed),
    }
  } catch (e: unknown) {
    const msg = e instanceof SyntaxError ? e.message : String(e)
    const lineMatch = msg.match(/line (\d+)/i)
    return { valid: false, error: msg, errorLine: lineMatch ? parseInt(lineMatch[1]) : undefined }
  }
}

/** Generate a TypeScript interface from a JSON object */
export function jsonToTypeScript(input: string, rootName = 'Root'): string {
  try {
    const parsed = JSON.parse(input)
    const interfaces: string[] = []
    buildInterface(parsed, rootName, interfaces)
    return interfaces.join('\n\n')
  } catch (e) {
    return `// Invalid JSON: ${e instanceof Error ? e.message : e}`
  }
}

function buildInterface(obj: unknown, name: string, out: string[]): string {
  if (Array.isArray(obj)) {
    const inner = obj.length > 0 ? buildInterface(obj[0], name + 'Item', out) : 'unknown'
    return `${inner}[]`
  }
  if (obj !== null && typeof obj === 'object') {
    const lines: string[] = [`export interface ${name} {`]
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      const typeName = capitalize(key)
      const tsType = buildInterface(val, typeName, out)
      lines.push(`  ${key}: ${tsType};`)
    }
    lines.push('}')
    out.push(lines.join('\n'))
    return name
  }
  return jsTypeOf(obj)
}

function jsTypeOf(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'unknown[]'
  return typeof v
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Generate a Zod schema from a JSON value */
export function jsonToZod(input: string, rootName = 'schema'): string {
  try {
    const parsed = JSON.parse(input)
    const lines: string[] = [`import { z } from 'zod'\n`]
    lines.push(`export const ${rootName} = ${buildZod(parsed)}`)
    return lines.join('\n')
  } catch (e) {
    return `// Invalid JSON: ${e instanceof Error ? e.message : e}`
  }
}

function buildZod(v: unknown, indent = 0): string {
  const pad = '  '.repeat(indent)
  const padInner = '  '.repeat(indent + 1)
  if (v === null) return 'z.null()'
  if (typeof v === 'string') return 'z.string()'
  if (typeof v === 'number') return Number.isInteger(v) ? 'z.number().int()' : 'z.number()'
  if (typeof v === 'boolean') return 'z.boolean()'
  if (Array.isArray(v)) {
    const inner = v.length > 0 ? buildZod(v[0], indent) : 'z.unknown()'
    return `z.array(${inner})`
  }
  if (typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>)
    if (entries.length === 0) return 'z.object({})'
    const fields = entries.map(([k, val]) => `${padInner}${k}: ${buildZod(val, indent + 1)},`).join('\n')
    return `z.object({\n${fields}\n${pad}})`
  }
  return 'z.unknown()'
}
