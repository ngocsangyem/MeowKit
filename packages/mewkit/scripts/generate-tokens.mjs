#!/usr/bin/env node
// Generates lib/tokens.generated.ts + styles/tokens.generated.css from
// assets/design-tokens.json (DTCG format). Single source of truth.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '..')
const SRC = resolve(REPO, 'assets/design-tokens.json')
const OUT_TS = resolve(REPO, 'src/orchviz-web/lib/tokens.generated.ts')
const OUT_CSS = resolve(REPO, 'src/orchviz-web/styles/tokens.generated.css')

const json = JSON.parse(readFileSync(SRC, 'utf8'))

const ALIAS_RE = /^\{([\w.]+)\}$/

function isLeaf(node) {
  return node && typeof node === 'object' && 'value' in node && !Array.isArray(node.value)
}

function walk(obj, path, out) {
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue
    if (Array.isArray(v)) continue
    if (isLeaf(v)) {
      out.push({ path: [...path, k], value: v.value, type: v.type, role: v.role })
      continue
    }
    if (typeof v === 'object') walk(v, [...path, k], out)
  }
}

function getDeep(obj, dotted) {
  return dotted.split('.').reduce((acc, key) => acc?.[key], obj)
}

function resolveAlias(value) {
  if (typeof value === 'string') {
    const m = value.match(ALIAS_RE)
    if (!m) return value
    const target = getDeep(json, m[1])
    if (target && typeof target === 'object' && 'value' in target) return resolveAlias(target.value)
    return value
  }
  if (Array.isArray(value)) return value.map(resolveAlias)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = resolveAlias(v)
    return out
  }
  return value
}

function camel(name) {
  if (!name.includes('-')) return name
  return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

const records = []
walk(json, [], records)

// Build nested tree (with aliases resolved).
function buildNested(records) {
  const root = {}
  for (const r of records) {
    let cur = root
    for (let i = 0; i < r.path.length - 1; i++) {
      const seg = r.path[i]
      cur[seg] = cur[seg] ?? {}
      cur = cur[seg]
    }
    const leaf = r.path[r.path.length - 1]
    cur[leaf] = resolveAlias(r.value)
  }
  return root
}

const nested = buildNested(records)

// Build flat var map for CSS-var consumers in TS.
function buildVarMap(records) {
  const out = {}
  for (const r of records) {
    const value = resolveAlias(r.value)
    if (typeof value === 'object' && value !== null) {
      for (const [leafKey, leafVal] of Object.entries(value)) {
        const path = [...r.path, leafKey]
        const cssName = '--mk-' + path.map(toKebab).join('-')
        out[cssName] = String(resolveAlias(leafVal))
      }
    } else {
      const cssName = '--mk-' + r.path.map(toKebab).join('-')
      out[cssName] = String(value)
    }
  }
  return out
}

function toKebab(s) {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase()
}

function isPrimitive(v) {
  return v === null || ['string', 'number', 'boolean'].includes(typeof v)
}

function tsLiteral(v, indent = '  ') {
  if (typeof v === 'string') return JSON.stringify(v)
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (v === null) return 'null'
  if (Array.isArray(v)) {
    const inner = v.map((x) => tsLiteral(x, indent + '  ')).join(', ')
    return `[${inner}]`
  }
  if (typeof v === 'object') {
    const lines = Object.entries(v).map(([k, val]) => {
      const keyStr = /^[a-zA-Z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)
      return `${indent}  ${keyStr}: ${tsLiteral(val, indent + '  ')}`
    })
    return `{\n${lines.join(',\n')}\n${indent}}`
  }
  return 'undefined'
}

const varMap = buildVarMap(records)

// ─── Emit TS ─────────────────────────────────────────────────────────────────
let ts = `// AUTO-GENERATED — do not edit by hand.
// Source: assets/design-tokens.json
// Run: npm run tokens

import type { CSSProperties } from 'react'

export const MK_TOKENS = ${tsLiteral(nested, '')} as const

export type MkTokens = typeof MK_TOKENS

export const MK_VAR: Record<string, string> = ${JSON.stringify(varMap, null, 2)}

/**
 * Resolve a typography scale token into a CSSProperties bag.
 * Use:  style={typoStyle('label')}
 */
export function typoStyle(scale: keyof MkTokens['typography']['scale']): CSSProperties {
  const s = MK_TOKENS.typography.scale[scale] as Record<string, string | number>
  const style: CSSProperties = {
    fontSize: String(s.size),
    lineHeight: typeof s.lineHeight === 'number' ? s.lineHeight : Number(s.lineHeight) || s.lineHeight as never,
    letterSpacing: String(s.letterSpacing),
    fontWeight: typeof s.weight === 'number' ? s.weight : Number(s.weight) || (s.weight as never),
    fontFamily: String(s.family),
  }
  if ('transform' in s && s.transform) {
    style.textTransform = s.transform as CSSProperties['textTransform']
  }
  return style
}

/**
 * NOTE: lane / ring / compass / spread tokens are emitted but NOT bound to
 * runtime layout. The lane glyph activation is gated to claude-runtime
 * agents whose name matches the MeowKit role pattern; binding is deferred
 * to the constellation lane layout effort.
 */
`
writeFileSync(OUT_TS, ts)

// ─── Emit CSS ────────────────────────────────────────────────────────────────
let css = `/* AUTO-GENERATED — do not edit by hand.
 * Source: assets/design-tokens.json
 * Run: npm run tokens
 */

:root {
`
const sortedVars = Object.keys(varMap).sort()
for (const k of sortedVars) css += `  ${k}: ${varMap[k]};\n`
css += `}\n`
writeFileSync(OUT_CSS, css)

mkdirSync(dirname(OUT_TS), { recursive: true })
mkdirSync(dirname(OUT_CSS), { recursive: true })

console.log(`✓ wrote ${OUT_TS}`)
console.log(`✓ wrote ${OUT_CSS}`)
console.log(`  ${records.length} token records, ${sortedVars.length} CSS vars`)
