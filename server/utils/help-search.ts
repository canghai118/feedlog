import { sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { CJK_RANGE } from '#layers/feedlog/shared/constants/help'

const CJK_CHAR = new RegExp(`[${CJK_RANGE}]`)
const WIDE_CHAR = /[ᄀ-ᅟ⺀-꓏ꥠ-꥿가-힣豈-﫿︐-︙︰-﹯＀-｠￠-￦]/
const LATIN_STEM = /(ing|ed|es|s)$/i

const MAX_SEGMENTS = 8
const EXCERPT_BEFORE = 100
const EXCERPT_AFTER = 160

export interface HelpQuerySub {
  kind: 'latin' | 'cjk'
  text: string
}

export function splitHelpQuery(q: string): HelpQuerySub[] {
  const subs: HelpQuerySub[] = []

  for (const segment of q.trim().split(/\s+/).filter(Boolean).slice(0, MAX_SEGMENTS)) {
    let buffer = ''
    let kind: HelpQuerySub['kind'] | null = null

    const flush = () => {
      if (buffer && kind) subs.push({ kind, text: buffer })
      buffer = ''
    }

    for (const char of segment) {
      const next = CJK_CHAR.test(char) ? 'cjk' : 'latin'
      if (next !== kind) {
        flush()
        kind = next
      }
      buffer += char
    }
    flush()
  }

  return subs.filter(sub => sub.kind === 'cjk' || /[a-z0-9]/i.test(sub.text))
}

export function buildHelpTsQuery(subs: HelpQuerySub[]): SQL | null {
  const parts = subs.map((sub) => {
    if (sub.kind === 'latin') return sql`plainto_tsquery('english', ${sub.text})`
    if (sub.text.length >= 2) return sql`to_tsquery('simple', ${cjkBigrams(sub.text).split(' ').join(' | ')})`
    return sql`to_tsquery('simple', ${`${sub.text}:*`})`
  })

  if (!parts.length) return null
  return parts.reduce((acc, part) => sql`${acc} || ${part}`)
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function mergeRanges(ranges: [number, number][]): [number, number][] {
  const sorted = ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const out: [number, number][] = []

  for (const range of sorted) {
    const last = out[out.length - 1]
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1])
    else out.push([range[0], range[1]])
  }

  return out
}

export function helpHighlightRanges(text: string, subs: HelpQuerySub[]): [number, number][] {
  const ranges: [number, number][] = []

  for (const sub of subs) {
    let pattern: RegExp
    if (sub.kind === 'latin') {
      const root = sub.text.replace(LATIN_STEM, '')
      pattern = root.length >= 4 && root.length < sub.text.length
        ? new RegExp(`${escapeRegExp(root)}[\\p{L}\\p{N}]*`, 'giu')
        : new RegExp(escapeRegExp(sub.text), 'gi')
    }
    else {
      pattern = new RegExp(escapeRegExp(sub.text), 'g')
    }

    for (const match of text.matchAll(pattern)) {
      if (match[0].length) ranges.push([match.index, match.index + match[0].length])
    }
  }

  return mergeRanges(ranges)
}

const charWidth = (char: string) => (WIDE_CHAR.test(char) ? 2 : 1)

function truncateToWidth(text: string, maxWidth: number): string {
  let width = 0
  for (let i = 0; i < text.length; i++) {
    width += charWidth(text[i]!)
    if (width > maxWidth) return `${text.slice(0, i)}…`
  }
  return text
}

export function buildHelpExcerpt(body: string, description: string | null, subs: HelpQuerySub[]): {
  excerpt: string
  ranges: [number, number][]
} {
  const hits = helpHighlightRanges(body, subs)

  if (!hits.length) {
    const fallback = truncateToWidth((description?.trim() || body).trim(), EXCERPT_BEFORE + EXCERPT_AFTER)
    return { excerpt: fallback, ranges: helpHighlightRanges(fallback, subs) }
  }

  const [hitStart, hitEnd] = hits[0]!

  let start = hitStart
  for (let width = 0; start > 0;) {
    const next = charWidth(body[start - 1]!)
    if (width + next > EXCERPT_BEFORE) break
    width += next
    start--
  }

  let end = hitEnd
  for (let width = 0; end < body.length;) {
    const next = charWidth(body[end]!)
    if (width + next > EXCERPT_AFTER) break
    width += next
    end++
  }

  const prefix = start > 0 ? '…' : ''
  const shift = prefix.length - start

  return {
    excerpt: `${prefix}${body.slice(start, end)}${end < body.length ? '…' : ''}`,
    ranges: hits
      .filter(([from, to]) => from >= start && to <= end)
      .map(([from, to]) => [from + shift, to + shift] as [number, number]),
  }
}
