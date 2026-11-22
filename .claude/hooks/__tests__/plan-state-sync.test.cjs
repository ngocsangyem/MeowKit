// Plan state follows the checkboxes: the shared sync core, the stop hooks that run it on
// Claude Code, Codex and Cursor, and the read-only drift line the ship check prints on every
// runtime.
//
// The fixture copies the real plan formats: snake-case phase `status:`, a lower-case
// `- **Status:**` Overview line, a Phases table whose cell may carry a note, kebab-case plan
// `status:`, and `.plan-state.json` keyed by phase file name.
//
// Run with: node --test .claude/hooks/__tests__/

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '../../..');
const sync = require('../lib/core/plan-state-sync.cjs');
const stopHandler = require('../handlers/plan-state-sync.cjs');
const { decidePreShip } = require('../lib/core/pre-ship.cjs');

const tempDir = (prefix) => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe' }).toString().trim();
const read = (file) => fs.readFileSync(file, 'utf8');

function phase(num, slug, status, boxes) {
  const todos = boxes.map((done, i) => `- [${done ? 'x' : ' '}] Task ${i + 1}`).join('\n');
  return `---\nphase: ${num}\ntitle: "${slug}"\nstatus: ${status}\npriority: P1\n---\n\n# Phase ${num}: ${slug}\n\n## Overview\n\n- **Priority:** P1\n- **Status:** ${status}\n- **Effort:** ~1d\n\n## Requirements\n\n- [x] not a todo, outside the Todo List\n\n## Todo List\n\n${todos}\n\n## Success Criteria\n\n- Done.\n`;
}

/** A plan dir under `root/tasks/plans/<name>` with one phase per `[slug, status, boxes]`. */
function makePlan(root, name, phases, { planStatus = 'draft', cells } = {}) {
  const dir = path.join(root, 'tasks/plans', name);
  fs.mkdirSync(dir, { recursive: true });
  const rows = phases.map(([slug, status], i) => `| ${i + 1} | [${slug}](phase-0${i + 1}-${slug}.md) | ${cells ? cells[i] : 'Pending'} | ~1d | — |`);
  fs.writeFileSync(path.join(dir, 'plan.md'), `---\ntitle: "x"\ntype: feature\nstatus: ${planStatus}\n---\n\n# Plan\n\n## Phases\n\n| # | Phase | Status | Effort | Depends On |\n|---|-------|--------|--------|------------|\n${rows.join('\n')}\n\n## Notes\n\nstatus: pending stays as body text.\n`);
  const state = { version: '1.3', created: '20261121-1515', phases: {} };
  phases.forEach(([slug, status, boxes], i) => {
    fs.writeFileSync(path.join(dir, `phase-0${i + 1}-${slug}.md`), phase(i + 1, slug, status, boxes));
    state.phases[`phase-0${i + 1}-${slug}`] = { status: 'pending', tasks_completed: 0, tasks_total: boxes.length };
  });
  state.verification_tier = 'full';
  fs.writeFileSync(path.join(dir, '.plan-state.json'), `${JSON.stringify(state, null, 2)}\n`);
  return dir;
}

const snapshot = (dir) => Object.fromEntries(fs.readdirSync(dir).map((f) => [f, read(path.join(dir, f))]));

test('each phase follows its Todo List boxes, and every derived field is written', () => {
  const root = tempDir('plan-sync-');
  const dir = makePlan(root, '261121-x', [
    ['a', 'pending', [false, false]],
    ['b', 'pending', [true, false, false]],
    ['c', 'pending', [true, true]],
  ], { cells: ['Pending', 'Pending', 'In progress (rest waived)'] });
  const result = sync.syncPlan(dir);
  assert.deepEqual(result.transitions, [{ phase: 'phase-02', to: 'in_progress' }, { phase: 'phase-03', to: 'completed' }]);
  assert.equal(result.complete, false);
  const b = read(path.join(dir, 'phase-02-b.md'));
  assert.match(b, /^status: in_progress$/m);
  assert.match(b, /^- \*\*Status:\*\* in_progress$/m);
  const plan = read(path.join(dir, 'plan.md'));
  assert.match(plan, /^status: in-progress$/m);
  assert.match(plan, /\| 1 \| \[a\]\(phase-01-a\.md\) \| Pending \|/);
  assert.match(plan, /\| 2 \| \[b\]\(phase-02-b\.md\) \| In progress \|/);
  assert.match(plan, /\| 3 \| \[c\]\(phase-03-c\.md\) \| Completed \|/);
  assert.match(plan, /status: pending stays as body text\./);
  const state = JSON.parse(read(path.join(dir, '.plan-state.json')));
  assert.deepEqual(state.phases['phase-02-b'], { status: 'in_progress', tasks_completed: 1, tasks_total: 3 });
  assert.deepEqual(state.phases['phase-03-c'], { status: 'completed', tasks_completed: 2, tasks_total: 2 });
  assert.deepEqual(Object.keys(state), ['version', 'created', 'phases', 'verification_tier']);
  assert.equal(sync.summaryLine([result]), 'plan state synced: 261121-x phase-02 → in_progress, phase-03 → completed');
});

test('a second run changes nothing, and a cell already saying the status keeps its note', () => {
  const root = tempDir('plan-sync-');
  const dir = makePlan(root, 'p', [['a', 'in_progress', [true, false]]], { planStatus: 'in-progress', cells: ['In progress (rest waived)'] });
  const before = snapshot(dir);
  sync.syncPlan(dir);
  const once = snapshot(dir);
  assert.match(once['plan.md'], /In progress \(rest waived\)/);
  const again = sync.syncPlan(dir);
  assert.deepEqual(again.changes, []);
  assert.deepEqual(snapshot(dir), once);
  assert.equal(before['phase-01-a.md'], once['phase-01-a.md']);
});

test('abandoned, failed and active phases keep their status; a phase with no todos is left alone', () => {
  const root = tempDir('plan-sync-');
  const dir = makePlan(root, 'p', [
    ['a', 'abandoned', [false, false]],
    ['b', 'failed', [true, false]],
    ['c', 'active', [false]],
    ['d', 'pending', []],
  ]);
  const result = sync.syncPlan(dir);
  assert.match(read(path.join(dir, 'phase-01-a.md')), /^status: abandoned$/m);
  assert.match(read(path.join(dir, 'phase-02-b.md')), /^status: failed$/m);
  assert.match(read(path.join(dir, 'phase-03-c.md')), /^status: active$/m);
  assert.match(read(path.join(dir, 'phase-04-d.md')), /^status: pending$/m);
  assert.deepEqual(result.transitions, []);
  const state = JSON.parse(read(path.join(dir, '.plan-state.json')));
  assert.equal(state.phases['phase-01-a'].status, 'pending', 'a kept phase status is not rewritten in the cache');
  assert.equal(state.phases['phase-02-b'].tasks_completed, 1, 'counts are facts and follow the boxes');
});

test('a plan whose non-abandoned phases are all complete is completed and the line reminds to archive', () => {
  const root = tempDir('plan-sync-');
  const dir = makePlan(root, '261122-done', [['a', 'in_progress', [true, true]], ['b', 'abandoned', [false]]], { planStatus: 'in-progress' });
  const result = sync.syncPlan(dir);
  assert.equal(result.complete, true);
  assert.match(read(path.join(dir, 'plan.md')), /^status: completed$/m);
  assert.equal(
    sync.summaryLine([result]),
    'plan state synced: 261122-done phase-01 → completed · plan complete: run `mewkit plan archive tasks/plans/261122-done`',
  );
});

test('CRLF files keep CRLF, and a malformed .plan-state.json is left untouched', () => {
  const root = tempDir('plan-sync-');
  const dir = makePlan(root, 'p', [['a', 'pending', [true, false]]]);
  for (const f of ['phase-01-a.md', 'plan.md']) fs.writeFileSync(path.join(dir, f), read(path.join(dir, f)).replace(/\n/g, '\r\n'));
  fs.writeFileSync(path.join(dir, '.plan-state.json'), '{ not json');
  sync.syncPlan(dir);
  const phaseText = read(path.join(dir, 'phase-01-a.md'));
  assert.match(phaseText, /^status: in_progress\r$/m);
  assert.equal(phaseText.split('\n').every((l, i, a) => i === a.length - 1 || l.endsWith('\r')), true);
  assert.match(read(path.join(dir, 'plan.md')), /\| In progress \| ~1d \| — \|\r\n/);
  assert.equal(read(path.join(dir, '.plan-state.json')), '{ not json');
});

test('write:false reports the drift without writing, as one line', () => {
  const root = tempDir('plan-sync-');
  const dir = makePlan(root, 'p', [['a', 'pending', [true]]]);
  const before = snapshot(dir);
  const result = sync.syncPlan(dir, { write: false });
  assert.ok(result.changes.length > 0);
  assert.deepEqual(snapshot(dir), before);
  assert.equal(sync.driftLine([result]), 'plan state is behind the checkboxes: run `mewkit plan sync tasks/plans/p` · plan complete: run `mewkit plan archive tasks/plans/p`');
});

function repoWithPlans() {
  const root = tempDir('plan-sync-git-');
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'test');
  makePlan(root, 'clean', [['a', 'pending', [true, false]]]);
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'base');
  makePlan(root, 'edited', [['a', 'pending', [true, false]]]);
  makePlan(root, 'archive/old',[['a', 'pending', [true]]]);
  return root;
}

test('only plans git shows as changed are synced, and archive/ is never touched', () => {
  const root = repoWithPlans();
  const archived = snapshot(path.join(root, 'tasks/plans/archive/old'));
  const results = sync.syncChangedPlans(root);
  assert.deepEqual(results.map((r) => r.plan), ['edited']);
  assert.match(read(path.join(root, 'tasks/plans/clean/phase-01-a.md')), /^status: pending$/m);
  assert.deepEqual(snapshot(path.join(root, 'tasks/plans/archive/old')), archived);
});

test('the Claude Code stop handler syncs and answers with one systemMessage line, then stays quiet', () => {
  const root = repoWithPlans();
  const first = stopHandler({ root });
  assert.equal(first.feedback, true);
  assert.deepEqual(JSON.parse(first.stdout), { systemMessage: 'plan state synced: edited phase-01 → in_progress' });
  assert.equal(stopHandler({ root }), null);
  assert.equal(stopHandler({ root: tempDir('no-plans-') }), null);
});

test('the Codex stop hook syncs with the opt-in check off and adds the line as systemMessage', () => {
  const root = repoWithPlans();
  const shell = path.join(REPO, 'kit/overlays/codex/files/.codex/hooks/completion-check.cjs');
  const r = spawnSync(process.execPath, [shell], { cwd: root, input: JSON.stringify({ hook_event_name: 'Stop', cwd: root, session_id: 's' }), encoding: 'utf8', env: { PATH: process.env.PATH, HOME: root } });
  assert.equal(r.status, 0);
  assert.deepEqual(JSON.parse(r.stdout), { systemMessage: 'plan state synced: edited phase-01 → in_progress' });
  assert.match(read(path.join(root, 'tasks/plans/edited/phase-01-a.md')), /^status: in_progress$/m);
});

test('the Cursor stop hook syncs and writes the line to stderr without a follow-up', () => {
  const root = repoWithPlans();
  const shell = path.join(REPO, 'kit/overlays/cursor/files/.cursor/hooks/stop-followup.cjs');
  const r = spawnSync(process.execPath, [shell], { cwd: root, input: JSON.stringify({ status: 'completed', loop_count: 0 }), encoding: 'utf8', env: { PATH: process.env.PATH, HOME: root, CURSOR_PROJECT_DIR: root } });
  assert.equal(r.status, 0);
  assert.deepEqual(JSON.parse(r.stdout), {});
  assert.match(r.stderr, /plan state synced: edited phase-01 → in_progress/);
});

test('the ship check prints the drift line and its decision is the same as without the plan', () => {
  const make = (withPlan) => {
    const root = tempDir('plan-ship-');
    git(root, 'init', '-q');
    git(root, 'config', 'user.email', 'test@example.com');
    git(root, 'config', 'user.name', 'test');
    fs.writeFileSync(path.join(root, '.gitignore'), '.meowkit/\n');
    fs.writeFileSync(path.join(root, 'README.md'), 'x\n');
    git(root, 'add', '-A');
    git(root, 'commit', '-qm', 'base');
    if (withPlan) makePlan(root, 'p', [['a', 'pending', [true, false]]]);
    fs.writeFileSync(path.join(root, 'README.md'), 'y\n');
    git(root, 'add', 'README.md');
    return root;
  };
  const env = (root) => ({ HOME: root, PATH: process.env.PATH, CLAUDE_PROJECT_DIR: root });
  const plain = make(false);
  const drifted = make(true);
  const a = decidePreShip({ root: plain, command: 'git commit -m x', env: env(plain) });
  const b = decidePreShip({ root: drifted, command: 'git commit -m x', env: env(drifted) });
  assert.equal(b.exit, a.exit);
  assert.equal(b.outcome, a.outcome);
  assert.equal(b.stdout[0], 'plan state is behind the checkboxes: run `mewkit plan sync tasks/plans/p`');
  assert.deepEqual(b.stdout.slice(1), a.stdout);
  assert.match(read(path.join(drifted, 'tasks/plans/p/phase-01-a.md')), /^status: pending$/m, 'the ship check never writes');
  const notShip = decidePreShip({ root: drifted, command: 'git status', env: env(drifted) });
  assert.deepEqual(notShip.stdout, []);
});

test('the shared fixture syncs to the same bytes as `mewkit plan sync`', () => {
  // crates/mewkit-core/src/plan_doc/sync_tests.rs syncs the same `before/` and compares it with
  // the same `after/`, so the hook core and the binary cannot drift apart unnoticed.
  const fixture = path.join(REPO, 'crates/mewkit-core/tests/fixtures/plan-sync');
  const dir = tempDir('plan-sync-parity-');
  for (const f of fs.readdirSync(path.join(fixture, 'before'))) fs.copyFileSync(path.join(fixture, 'before', f), path.join(dir, f));
  sync.syncPlan(dir);
  for (const f of fs.readdirSync(path.join(fixture, 'after'))) {
    assert.equal(read(path.join(dir, f)), read(path.join(fixture, 'after', f)), `${f} differs after sync`);
  }
  assert.equal(sync.syncPlan(dir).changes.length, 0, 'a second run changes nothing');
});
