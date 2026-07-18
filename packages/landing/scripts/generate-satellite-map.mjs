#!/usr/bin/env node
/**
 * generate-satellite-map.mjs — deterministic extraction of the meowkit
 * satellite map. Re-runnable with zero LLM involvement:
 *   node scripts/generate-satellite-map.mjs
 * Reads plugin/ (read-only), writes public/data/satellite-map.json.
 * Contract version: 1. Asserts every shape/cap rule; exits non-zero on violation.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const PLUGIN = join(ROOT, 'plugin')
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'satellite-map.json')

// The only LLM-authored copy in this file (allowed by the data contract).
const TAGLINE = 'How meowkit skills, agents, commands, and hooks orbit each other'

// ─── helpers ────────────────────────────────────────────────────────────
const read = (p) => readFileSync(p, 'utf8')
const fmValue = (text, key) => {
  const m = text.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'))
  if (!m) return ''
  let v = m[1].trim()
  if (['>', '|', '>-', '|-'].includes(v)) {
    // folded/literal block scalar: gather following indented lines
    const lines = []
    for (const line of text.slice(m.index + m[0].length).split('\n').slice(1)) {
      if (/^\s+\S/.test(line)) lines.push(line.trim())
      else if (line.trim() === '') continue
      else break
    }
    v = lines.join(' ')
  }
  return v.replace(/^['"]|['"]$/g, '').trim()
}
const firstSentence = (s) => {
  const m = s.match(/^.*?[.!?](?=\s|$)/)
  return (m ? m[0] : s).trim()
}
const clip = (s, n) => {
  if (s.length <= n) return s
  const cut = s.slice(0, n - 1)
  const sp = cut.lastIndexOf(' ')
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut) + '…'
}
const rel = (p) => p.slice(ROOT.length + 1)
// label cap is 24: prefer the prefixed form, fall back to the bare id, then clip
const label24 = (prefix, id) => {
  const full = prefix + id
  if (full.length <= 24) return full
  return id.length <= 24 ? id : id.slice(0, 23) + '…'
}

// ─── 1 · inventory ──────────────────────────────────────────────────────
const nodes = new Map() // key → node record (key is kind-prefixed, id is map-level)

for (const dir of readdirSync(join(PLUGIN, 'skills'), { withFileTypes: true })) {
  if (!dir.isDirectory()) continue
  const p = join(PLUGIN, 'skills', dir.name, 'SKILL.md')
  if (!existsSync(p)) continue
  const text = read(p)
  const body = text.split('---').slice(2).join('---').trim()
  const fallback = body.split('\n').find((l) => l.trim()) || dir.name
  const desc = firstSentence(fmValue(text, 'description')) || firstSentence(fallback)
  nodes.set(`skill:${dir.name}`, {
    id: dir.name, key: `skill:${dir.name}`, kind: 'skill', label: label24("mk:", dir.name),
    detail: clip(desc, 200), sourceRef: rel(p),
    owner: fmValue(text, 'owner'), criticality: fmValue(text, 'criticality'), text,
  })
}
for (const f of readdirSync(join(PLUGIN, 'agents'))) {
  if (!f.endsWith('.md')) continue
  const p = join(PLUGIN, 'agents', f)
  const text = read(p)
  const name = basename(f, '.md')
  nodes.set(`agent:${name}`, {
    id: name, key: `agent:${name}`, kind: 'agent', label: name,
    detail: clip(firstSentence(fmValue(text, 'description')) || name, 200), sourceRef: rel(p),
    owner: fmValue(text, 'owner'), criticality: fmValue(text, 'criticality'), text,
  })
}
const skillIds = new Set([...nodes.values()].filter((n) => n.kind === 'skill').map((n) => n.id))
for (const f of readdirSync(join(PLUGIN, 'commands', 'mk'))) {
  const p = join(PLUGIN, 'commands', 'mk', f)
  const text = read(p)
  const name = basename(f, '.md')
  // command names collide with same-named skills at the map level → suffix the id
  const id = skillIds.has(name) ? `${name}-cmd` : name
  nodes.set(`command:${name}`, {
    id, key: `command:${name}`, kind: 'command', label: label24("/mk:", name),
    detail: clip(firstSentence(fmValue(text, 'description')) || name, 200), sourceRef: rel(p),
    owner: fmValue(text, 'owner'), criticality: fmValue(text, 'criticality'), text,
  })
}
for (const f of readdirSync(join(PLUGIN, 'hooks', 'handlers'))) {
  if (!f.endsWith('.cjs')) continue
  const p = join(PLUGIN, 'hooks', 'handlers', f)
  const text = read(p)
  const name = basename(f, '.cjs')
  const comment = text.split('\n').find((l) => /^\s*(\/\/|\/?\*+)/.test(l) && /[a-zA-Z]{4,}/.test(l)) || name
  nodes.set(`hook:${name}`, {
    id: name, key: `hook:${name}`, kind: 'hook', label: name,
    detail: clip(firstSentence(comment.replace(/^[\s/*]+/, '').trim()) || name, 200),
    sourceRef: rel(p), owner: '', criticality: '', text,
  })
}

// ─── metadata enrichment: pack membership (via owner) + criticality ─────
const packManifest = JSON.parse(read(join(PLUGIN, 'pack-manifest.json')))
const ownerToPack = new Map()
for (const [packName, pack] of Object.entries(packManifest.packs || {}))
  for (const owner of pack.owners || [])
    if (!ownerToPack.has(owner)) ownerToPack.set(owner, packName)
const inventory = JSON.parse(read(join(PLUGIN, 'harness-inventory.json'))).artifacts || {}
for (const n of nodes.values()) {
  const inv = inventory[n.sourceRef.replace(/^plugin\//, '')]
  if (inv?.criticality) n.criticality = inv.criticality
  n.group = ownerToPack.get(n.owner) || ''
}

// ─── 2 · edges (mechanical only) ────────────────────────────────────────
const agentIds = [...nodes.values()].filter((n) => n.kind === 'agent').map((n) => n.id)
const edges = []
const edgeSet = new Set()
const addEdge = (from, to) => {
  if (from === to) return
  const k = `${from}→${to}`
  if (edgeSet.has(k)) return
  edgeSet.add(k)
  edges.push({ from, to })
}
for (const n of nodes.values()) {
  if (n.kind === 'hook') continue // hooks are inventory-only; not scanned for edges
  for (const m of n.text.matchAll(/\bmk:([a-z][a-z0-9-]+)/g)) {
    const target = `skill:${m[1]}`
    if (nodes.has(target)) addEdge(n.key, target)
  }
  if (n.kind === 'skill' || n.kind === 'command') {
    for (const m of n.text.matchAll(/\bTask\(([a-z][a-z-]*)\)/g))
      if (nodes.has(`agent:${m[1]}`)) addEdge(n.key, `agent:${m[1]}`)
    // subagent spawns are written backtick-wrapped in skill/command prose
    for (const a of agentIds)
      if (n.text.includes('`' + a + '`')) addEdge(n.key, `agent:${a}`)
  }
}

const outDeg = new Map()
const totDeg = new Map()
for (const e of edges) {
  outDeg.set(e.from, (outDeg.get(e.from) || 0) + 1)
  totDeg.set(e.from, (totDeg.get(e.from) || 0) + 1)
  totDeg.set(e.to, (totDeg.get(e.to) || 0) + 1)
}

// ─── 3 · curation ───────────────────────────────────────────────────────
const PLANET_CAP = 10
const planetKeys = [...nodes.values()]
  .filter((n) => (n.kind === 'skill' || n.kind === 'command') && (outDeg.get(n.key) || 0) > 0)
  .sort((a, b) => (outDeg.get(b.key) || 0) - (outDeg.get(a.key) || 0) || a.id.localeCompare(b.id))
  .slice(0, PLANET_CAP)
  .map((n) => n.key)
if (planetKeys.length < 6) fail(`only ${planetKeys.length} planets found (need >= 6)`)
const planetSet = new Set(planetKeys)

const outTargets = (key) => edges.filter((e) => e.from === key).map((e) => e.to)

// pick a satellite cap (start 8, walk down then up) so visible nodes land in 40-60
let satCap = 8
let planets = []
let visibleCount = 0
for (const tryCap of [8, 7, 6, 5, 4, 9, 10, 11, 12]) {
  const built = planetKeys.map((pk) => ({
    key: pk,
    sats: outTargets(pk)
      .filter((t) => !planetSet.has(t))
      .sort((a, b) => (totDeg.get(b) || 0) - (totDeg.get(a) || 0) || a.localeCompare(b))
      .slice(0, tryCap),
  }))
  const unique = new Set(built.flatMap((p) => p.sats))
  const count = planetKeys.length + unique.size
  if (count >= 40 && count <= 60) { satCap = tryCap; planets = built; visibleCount = count; break }
  if (tryCap === 12) fail(`could not reach 40-60 visible nodes (last try cap=${tryCap} → ${count})`)
}

const satPlanets = new Map() // sat key → [planet ids]
for (const p of planets)
  for (const s of p.sats) satPlanets.set(s, [...(satPlanets.get(s) || []), nodes.get(p.key).id])

const edgeVerb = (kind) => (kind === 'agent' ? 'spawns' : 'calls')
const planetsJson = planets.map((p) => {
  const pn = nodes.get(p.key)
  return {
    id: pn.id, label: pn.label, kind: pn.kind,
    sub: clip(pn.detail, 40),
    detail: pn.detail, sourceRef: pn.sourceRef,
    ...(pn.group ? { group: pn.group } : {}),
    ...(pn.criticality ? { criticality: pn.criticality } : {}),
    satellites: p.sats.map((sk) => {
      const sn = nodes.get(sk)
      const shared = (satPlanets.get(sk) || []).filter((pid) => pid !== pn.id)
      return {
        id: sn.id, label: sn.label, kind: sn.kind, edge: edgeVerb(sn.kind),
        ...(shared.length ? { sharedWith: shared } : {}),
        detail: sn.detail, sourceRef: sn.sourceRef,
        ...(sn.group ? { group: sn.group } : {}),
        ...(sn.criticality ? { criticality: sn.criticality } : {}),
      }
    }),
  }
})

const CROSS_CAP = 15
const crossLinks = edges
  .filter((e) => planetSet.has(e.from) && planetSet.has(e.to))
  .map((e) => ({ from: nodes.get(e.from).id, to: nodes.get(e.to).id, w: (totDeg.get(e.from) || 0) + (totDeg.get(e.to) || 0) }))
  .sort((a, b) => b.w - a.w || a.from.localeCompare(b.from))
  .slice(0, CROSS_CAP)
  .map(({ from, to }) => ({ from, to }))

const visibleKeys = new Set([...planetKeys, ...planets.flatMap((p) => p.sats)])
const hidden = [...nodes.values()].filter((n) => !visibleKeys.has(n.key))
const byKind = { skills: 0, agents: 0, commands: 0, hooks: 0 }
for (const n of hidden) byKind[n.kind + 's'] += 1
const belt = {
  count: hidden.length,
  byKind,
  sample: hidden
    .sort((a, b) => (totDeg.get(b.key) || 0) - (totDeg.get(a.key) || 0) || a.id.localeCompare(b.id))
    .slice(0, 12)
    .map((n) => n.id),
}

const map = {
  version: 1,
  meta: { name: 'meowkit', tagline: TAGLINE, date: new Date().toISOString().slice(0, 10) },
  stats: {
    skills: [...nodes.values()].filter((n) => n.kind === 'skill').length,
    agents: [...nodes.values()].filter((n) => n.kind === 'agent').length,
    commands: [...nodes.values()].filter((n) => n.kind === 'command').length,
    hooks: [...nodes.values()].filter((n) => n.kind === 'hook').length,
    edges: edges.length,
  },
  planets: planetsJson,
  crossLinks,
  belt,
}

// ─── 4 · assertions (shape + caps) ──────────────────────────────────────
function fail(msg) { console.error(`satellite-map violation: ${msg}`); process.exit(1) }
const KINDS = new Set(['skill', 'agent', 'command', 'hook'])
if (map.version !== 1) fail('version must be 1')
if (map.meta.tagline.length > 80) fail('tagline > 80')
if (map.planets.length < 6 || map.planets.length > 10) fail(`planet count ${map.planets.length} outside 6-10`)
const planetIds = new Set()
for (const p of map.planets) {
  if (planetIds.has(p.id)) fail(`duplicate planet id ${p.id}`)
  planetIds.add(p.id)
  if (!KINDS.has(p.kind)) fail(`bad kind ${p.kind}`)
  if (p.label.length > 24 || p.sub.length > 40 || p.detail.length > 200 || p.sourceRef.length > 120)
    fail(`length cap violated on planet ${p.id}`)
  if (p.satellites.length > satCap) fail(`planet ${p.id} exceeds satellite cap`)
  const satIds = new Set()
  for (const s of p.satellites) {
    if (satIds.has(s.id)) fail(`duplicate satellite id ${s.id} under ${p.id}`)
    satIds.add(s.id)
    if (!KINDS.has(s.kind)) fail(`bad kind ${s.kind}`)
    if (s.label.length > 24 || s.detail.length > 200 || s.sourceRef.length > 120)
      fail(`length cap violated on satellite ${s.id}`)
    for (const sw of s.sharedWith || [])
      if (!planetIds.has(sw) && ![...map.planets].some((pp) => pp.id === sw)) fail(`sharedWith ${sw} is not a planet`)
  }
}
if (map.crossLinks.length > 15) fail('crossLinks > 15')
for (const c of map.crossLinks) {
  if (![...planetIds].includes(c.from) || ![...planetIds].includes(c.to)) fail(`crossLink ${c.from}→${c.to} not planet↔planet`)
  if (c.label && c.label.length > 24) fail('crossLink label > 24')
}
if (visibleCount < 40 || visibleCount > 60) fail(`visible nodes ${visibleCount} outside 40-60`)
if (belt.sample.length > 12) fail('belt sample > 12')
if (belt.count !== byKind.skills + byKind.agents + byKind.commands + byKind.hooks) fail('belt byKind sum mismatch')

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(map, null, 2) + '\n')
console.log(`satellite-map.json written: ${map.planets.length} planets, ${visibleCount} visible nodes (satCap=${satCap}), ${map.crossLinks.length} crossLinks, belt=${belt.count}, edges=${map.stats.edges}`)
