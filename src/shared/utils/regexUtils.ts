/** Regex utilities for Regex Lab page */

export interface RegexMatch {
  fullMatch: string
  index: number
  length: number
  groups: string[]
  namedGroups?: Record<string, string>
}

export interface RegexResult {
  valid: boolean
  error?: string
  matches: RegexMatch[]
  count: number
}

export function testRegex(pattern: string, flags: string, input: string): RegexResult {
  if (!pattern) return { valid: true, matches: [], count: 0 }
  try {
    // Ensure 'g' flag for finding all matches
    const allFlags = flags.includes('g') ? flags : flags + 'g'
    const rx = new RegExp(pattern, allFlags)
    const matches: RegexMatch[] = []
    let m: RegExpExecArray | null
    // Safety: limit to 10000 matches
    while ((m = rx.exec(input)) !== null && matches.length < 10000) {
      matches.push({
        fullMatch: m[0],
        index: m.index,
        length: m[0].length,
        groups: m.slice(1),
        namedGroups: m.groups ? { ...m.groups } : undefined,
      })
      // Prevent infinite loop on zero-length matches
      if (m[0].length === 0) rx.lastIndex++
    }
    return { valid: true, matches, count: matches.length }
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : String(e), matches: [], count: 0 }
  }
}

/**
 * Given match ranges, produces an array of segments for highlighted rendering.
 * Each segment is { text, isMatch }
 */
export function buildHighlightedSegments(
  input: string,
  matches: RegexMatch[]
): Array<{ text: string; isMatch: boolean; matchIndex?: number }> {
  if (matches.length === 0) return [{ text: input, isMatch: false }]
  const segments: Array<{ text: string; isMatch: boolean; matchIndex?: number }> = []
  let cursor = 0
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    if (m.index > cursor) segments.push({ text: input.slice(cursor, m.index), isMatch: false })
    segments.push({ text: m.fullMatch, isMatch: true, matchIndex: i })
    cursor = m.index + m.length
  }
  if (cursor < input.length) segments.push({ text: input.slice(cursor), isMatch: false })
  return segments
}
