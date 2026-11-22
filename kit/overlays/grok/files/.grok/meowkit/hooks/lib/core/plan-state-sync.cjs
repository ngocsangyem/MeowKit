'use strict';
// plan-state-sync.cjs — bring a plan's derived state up to date with its checkboxes.
//
// A plan's phase files carry `- [ ]` / `- [x]` todos. Everything else that states progress is
// derived from them: the phase frontmatter `status:`, the phase Overview `**Status:**` line,
// the plan.md Phases table cell and frontmatter `status:`, and `.plan-state.json`. Nothing
// else rewrites those, so without this they stay at `pending` while the boxes fill in.
//
// Rule, per phase file (todos counted in its `## Todo List` section only):
//   no box checked → pending, some → in_progress, all → completed
//   a phase whose frontmatter says failed, abandoned or active keeps it (a human set it)
//   a phase with no todos is left as it is (there is nothing to derive from)
// plan.md `status:` becomes in-progress once any phase is past pending, and completed only
// when every phase that is not abandoned is completed.
//
// Dependency-free (node built-ins only) because the stop hooks and the ship check of every
// runtime load it, and the `mewkit` binary that has the same rule is often not on PATH.
// Only changed values are written; line endings and every other byte are kept. A malformed
// `.plan-state.json` is left alone: the markdown is the authority, the JSON a cache.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const PLANS_DIR = 'tasks/plans';
const SKIPPED_DIRS = new Set(['archive', 'ceo-plans']);
const KEPT = new Set(['failed', 'abandoned', 'active']);
const PLAN_KEPT = new Set(['failed', 'abandoned', 'cancelled', 'archived']);
const LABELS = { pending: 'Pending', in_progress: 'In progress', completed: 'Completed' };

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
const STATUS_LINE = /^(status:[ \t]*)([^\r\n]*)/m;
const TODO = /^[ \t]*-[ \t]*\[( |x|X)\][ \t]+/gm;
const OVERVIEW = /^([ \t]*[-*][ \t]+\*\*Status:\*\*[ \t]*)([^\r\n]*)/m;

/** `In progress (rest waived)`, `"in_progress"`, `in-progress` → `in_progress`. */
function norm(value) {
  return String(value || '').replace(/\(.*$/, '').replace(/[^A-Za-z _-]/g, '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/** Written in the style the field already uses: `In progress` beside capitals, else `in_progress`. */
function styled(current, status) {
  return /^[\s"'*]*[A-Z]/.test(current) ? LABELS[status] : status;
}

function countTodos(text) {
  const start = text.search(/^## Todo List[ \t]*\r?$/m);
  if (start < 0) return { total: 0, checked: 0 };
  const rest = text.slice(start).replace(/^[^\n]*\n?/, '');
  const next = rest.search(/\n##[^#]/);
  const body = next < 0 ? rest : rest.slice(0, next);
  let total = 0;
  let checked = 0;
  for (const match of body.matchAll(TODO)) { total += 1; if (match[1] !== ' ') checked += 1; }
  return { total, checked };
}

/** The frontmatter `status:` value and a function that rewrites only that value. */
function frontmatterStatus(text) {
  const block = text.match(FRONTMATTER);
  const line = block && block[1].match(STATUS_LINE);
  if (!line) return null;
  const offset = block.index + block[0].indexOf(block[1]) + line.index;
  const valueAt = offset + line[1].length;
  const value = line[2].replace(/\s+#.*$/, '').trim().replace(/^["']|["']$/g, '');
  return { value, set: (to) => text.slice(0, valueAt) + to + text.slice(valueAt + line[2].length) };
}

function derive({ total, checked }) {
  if (checked === 0) return 'pending';
  return checked < total ? 'in_progress' : 'completed';
}

/** Rewrite the Status cell of the Phases-table row naming `file` (or numbered `num`). */
function tableCell(text, file, num, status) {
  const lines = text.split('\n');
  let col = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const cells = lines[i].replace(/\r$/, '').split('|');
    if (!lines[i].trim().startsWith('|')) { col = -1; continue; }
    const header = cells.findIndex((c) => c.trim().toLowerCase() === 'status');
    if (header >= 0 && /^\s*\|?[\s:|-]+$/.test(lines[i + 1] || '')) { col = header; continue; }
    if (col < 0 || !cells[col]) continue;
    const row = lines[i];
    const names = row.includes(`${file})`) || row.includes(`${file}]`) || row.includes(` ${file} `);
    if (!names && Number(cells[1] && cells[1].trim()) !== num) continue;
    const from = cells[col].trim();
    if (norm(from) === status) return null;
    const to = styled(from, status);
    cells[col] = cells[col].replace(from || /^\s*/, from ? to : ` ${to} `);
    const cr = row.endsWith('\r') ? '\r' : '';
    lines[i] = cells.join('|').replace(/\r$/, '') + cr;
    return { from, to, text: lines.join('\n') };
  }
  return null;
}

function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return null; }
}

/**
 * Sync one plan directory. Returns `{ plan, dir, changes: [{file, field, from, to}],
 * transitions: [{phase, to}], complete }`; with `write: false` nothing is written and the
 * changes are what a write would make.
 */
function syncPlan(planDir, { write = true } = {}) {
  const plan = path.basename(planDir);
  const changes = [];
  const transitions = [];
  const files = new Map();
  const put = (name, text) => files.set(name, text);
  let planText = readText(path.join(planDir, 'plan.md'));
  const statePath = path.join(planDir, '.plan-state.json');
  const stateRaw = readText(statePath);
  let state = null;
  try { state = stateRaw === null ? null : JSON.parse(stateRaw); } catch { state = null; }
  const stateCopy = state && typeof state === 'object' && state.phases && typeof state.phases === 'object' ? state : null;

  const phaseFiles = fs.readdirSync(planDir).filter((f) => /^phase-.*\.md$/.test(f)).sort();
  const effective = [];
  for (const file of phaseFiles) {
    let text = readText(path.join(planDir, file));
    if (text === null) continue;
    const key = file.replace(/\.md$/, '');
    const short = (key.match(/^phase-\d+/) || [key])[0];
    const num = Number((key.match(/^phase-(\d+)/) || [])[1]);
    const counts = countTodos(text);
    const fm = frontmatterStatus(text);
    const current = fm ? norm(fm.value) : '';
    if (counts.total === 0 || KEPT.has(current)) { effective.push(current); }
    else {
      const status = derive(counts);
      effective.push(status);
      if (fm && current !== status) {
        changes.push({ file, field: 'status', from: fm.value, to: status });
        text = fm.set(status);
        transitions.push({ phase: short, to: status });
      }
      const overview = text.slice((text.match(FRONTMATTER) || [''])[0].length).match(OVERVIEW);
      if (overview && norm(overview[2]) !== status) {
        const to = styled(overview[2], status);
        const at = (text.match(FRONTMATTER) || [''])[0].length + overview.index + overview[1].length;
        changes.push({ file, field: 'overview-status', from: overview[2].trim(), to });
        text = text.slice(0, at) + to + text.slice(at + overview[2].length);
        if (!fm || current === status) transitions.push({ phase: short, to: status });
      }
      if (changes.some((c) => c.file === file)) put(file, text);
      const cell = planText !== null && tableCell(planText, file, num, status);
      if (cell) {
        changes.push({ file: 'plan.md', field: `table-status:${short}`, from: cell.from, to: cell.to });
        planText = cell.text;
        put('plan.md', planText);
        if (!transitions.some((t) => t.phase === short)) transitions.push({ phase: short, to: status });
      }
    }
    const record = stateCopy && stateCopy.phases[key];
    if (record && typeof record === 'object' && counts.total > 0) {
      const wanted = { tasks_completed: counts.checked, tasks_total: counts.total };
      if (!KEPT.has(current)) wanted.status = effective[effective.length - 1];
      for (const [field, to] of Object.entries(wanted)) {
        if (record[field] === to) continue;
        changes.push({ file: '.plan-state.json', field: `phases.${key}.${field}`, from: record[field], to });
        record[field] = to;
      }
    }
  }

  const counted = effective.filter((s) => s !== 'abandoned');
  const complete = counted.length > 0 && counted.every((s) => s === 'completed');
  const moved = effective.some((s) => s && s !== 'pending');
  const planFm = planText !== null && frontmatterStatus(planText);
  if (planFm && moved && !PLAN_KEPT.has(norm(planFm.value))) {
    const target = complete ? 'completed' : 'in-progress';
    if (norm(planFm.value) !== norm(target)) {
      changes.push({ file: 'plan.md', field: 'status', from: planFm.value, to: target });
      planText = planFm.set(target);
      put('plan.md', planText);
    }
  }
  if (stateCopy && changes.some((c) => c.file === '.plan-state.json')) {
    // Same indent, line ending and final newline as the file had.
    const eol = stateRaw.includes('\r\n') ? '\r\n' : '\n';
    const indent = (stateRaw.match(/\n([ \t]+)"/) || [null, '  '])[1];
    const tail = /\n$/.test(stateRaw) ? '\n' : '';
    put('.plan-state.json', `${JSON.stringify(stateCopy, null, indent)}${tail}`.replace(/\n/g, eol));
  }
  if (write) for (const [name, text] of files) fs.writeFileSync(path.join(planDir, name), text);
  return { plan, dir: planDir, changes, transitions, complete };
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000, maxBuffer: 16 * 1024 * 1024 });
}

const PLAN_FILE = /^(?:plan|phase-.*)\.md$/;

/** True when a plan file is newer than the plan's `.plan-state.json` (or that file is missing). */
function newerThanState(dir) {
  let stateTime = -1;
  try { stateTime = fs.statSync(path.join(dir, '.plan-state.json')).mtimeMs; } catch { return true; }
  return fs.readdirSync(dir).some((f) => PLAN_FILE.test(f) && fs.statSync(path.join(dir, f)).mtimeMs > stateTime);
}

/** Plan dirs (names) under tasks/plans that changed, by git status or, where git cannot tell, by mtime. */
function changedPlanNames(root) {
  const base = path.join(root, PLANS_DIR);
  let names;
  try { names = fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory() && !SKIPPED_DIRS.has(d.name) && !d.name.startsWith('.')).map((d) => d.name); } catch { return []; }
  names = names.filter((n) => fs.existsSync(path.join(base, n, 'plan.md')));
  try {
    const prefix = git(root, ['rev-parse', '--show-prefix']).trim();
    const out = git(root, ['status', '--porcelain=v1', '-z', '-uall', '--ignored=matching', '--', PLANS_DIR]);
    const entries = out.split('\0');
    const changed = new Set();
    const ignored = [];
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      if (entry.length < 4) continue;
      const code = entry.slice(0, 2);
      const rel = entry.slice(3).startsWith(prefix) ? entry.slice(3 + prefix.length) : entry.slice(3);
      if (code[0] === 'R' || code[0] === 'C') i += 1;
      if (code === '!!') { ignored.push(rel); continue; }
      const m = rel.match(/^tasks\/plans\/([^/]+)\/([^/]+)$/);
      if (m && PLAN_FILE.test(m[2])) changed.add(m[1]);
    }
    const isIgnored = (n) => ignored.some((p) => `${PLANS_DIR}/${n}/`.startsWith(p.endsWith('/') ? p : `${p}/`) || p.startsWith(`${PLANS_DIR}/${n}/`));
    return names.filter((n) => changed.has(n) || (isIgnored(n) && newerThanState(path.join(base, n))));
  } catch {
    return names.filter((n) => newerThanState(path.join(base, n)));
  }
}

/** Sync every changed plan directly under tasks/plans (never archive/ or ceo-plans/). */
function syncChangedPlans(root, { write = true } = {}) {
  const results = [];
  for (const name of changedPlanNames(root)) {
    try { results.push(syncPlan(path.join(root, PLANS_DIR, name), { write })); } catch { /* one bad plan never stops the rest */ }
  }
  return results;
}

const archiveHint = (results) => results.filter((r) => r.complete).map((r) => `plan complete: run \`mewkit plan archive ${PLANS_DIR}/${r.plan}\``);

/** After a write: `plan state synced: <plan> phase-02 → completed · plan complete: …`, or ''. */
function summaryLine(results) {
  const synced = results.filter((r) => r.changes.length).map((r) => `${r.plan} ${r.transitions.length ? r.transitions.map((t) => `${t.phase} → ${t.to}`).join(', ') : 'task counts'}`);
  const parts = [...(synced.length ? [`plan state synced: ${synced.join('; ')}`] : []), ...archiveHint(results)];
  return parts.join(' · ');
}

/** Without a write: `plan state is behind the checkboxes: run \`mewkit plan sync …\``, or ''. */
function driftLine(results) {
  const behind = results.filter((r) => r.changes.length).map((r) => `\`mewkit plan sync ${PLANS_DIR}/${r.plan}\``);
  const parts = [...(behind.length ? [`plan state is behind the checkboxes: run ${behind.join(', ')}`] : []), ...archiveHint(results)];
  return parts.join(' · ');
}

module.exports = { syncPlan, syncChangedPlans, changedPlanNames, summaryLine, driftLine, countTodos };
