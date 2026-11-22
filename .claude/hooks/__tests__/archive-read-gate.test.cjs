// Archived plans stay out of context: the shared privacy decision refuses reads, listings and
// searches aimed under tasks/plans/archive/ (and ceo-plans/archive/) on every runtime, while
// moving a plan there, `mewkit plan archive` and writes into it pass, and so does a search
// rooted outside the archive.
//
// Run with: node --test .claude/hooks/__tests__/

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '../../..');
const { decidePrivacy } = require('../lib/core/privacy.cjs');
const OVERLAYS = path.join(REPO, 'kit/overlays');
const { evaluateShellPolicy } = require(path.join(OVERLAYS, 'cursor/files/.cursor/hooks/lib/shell-guard-policy.cjs'));
const { evaluateToolPolicy } = require(path.join(OVERLAYS, 'cursor/files/.cursor/hooks/lib/tool-matcher-policy.cjs'));

const REASON = "'tasks/plans/archive/x/plan.md' is an archived plan. Archived plans are kept out of context; the shipped code is the source of truth.";

test('a read of an archived plan is refused with the marker, the reason and the ask-first line', () => {
  const r = decidePrivacy({ paths: ['tasks/plans/archive/x/plan.md'], toolName: 'Read' });
  assert.equal(r.exit, 2);
  assert.deepEqual(r.stderr, ['@@PRIVACY_BLOCK@@', REASON, 'Use AskUserQuestion to get explicit user approval before accessing.']);
  for (const p of ['/abs/proj/tasks/plans/archive/x', './tasks/plans/x/../archive/y.md', 'tasks\\plans\\ceo-plans\\archive\\a.md']) {
    assert.equal(decidePrivacy({ paths: [p] }).exit, 2, p);
  }
  for (const p of ['tasks/plans/archive-notes.md', 'tasks/plans/261122-x/plan.md', 'docs/archive/a.md']) {
    assert.equal(decidePrivacy({ paths: [p] }).exit, 0, p);
  }
});

test('writes into the archive pass; credential rules still apply to writes', () => {
  for (const tool of ['Edit', 'Write', 'MultiEdit', 'write_to_file', 'edit']) {
    assert.equal(decidePrivacy({ paths: ['tasks/plans/archive/x/plan.md'], toolName: tool }).exit, 0, tool);
  }
  assert.equal(decidePrivacy({ paths: ['.env'], toolName: 'Edit' }).exit, 2);
});

test('a symlink into the archive is refused by what it resolves to', () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'archive-link-')));
  fs.mkdirSync(path.join(root, 'tasks/plans/archive/x'), { recursive: true });
  fs.writeFileSync(path.join(root, 'tasks/plans/archive/x/plan.md'), 'x');
  fs.symlinkSync(path.join(root, 'tasks/plans/archive/x/plan.md'), path.join(root, 'old-plan.md'));
  assert.equal(decidePrivacy({ paths: [path.join(root, 'old-plan.md')], toolName: 'Read' }).exit, 2);
});

const BLOCKED = [
  'cat tasks/plans/archive/x/plan.md',
  'head -20 "tasks/plans/archive/x/phase-01-a.md"',
  'grep -rn status tasks/plans/archive/',
  'rg foo tasks/plans/ceo-plans/archive',
  'ls tasks/plans/archive',
  'find tasks/plans/archive -name "*.md"',
  'sed -n 1,5p tasks/plans/archive/x/plan.md',
  'git log && cat tasks/plans/archive/x/plan.md | head',
  'wc -l < tasks/plans/archive/x/plan.md',
];
const ALLOWED = [
  'mv tasks/plans/261122-x tasks/plans/archive/',
  'git mv tasks/plans/261122-x tasks/plans/archive/261122-x',
  'mkdir -p tasks/plans/archive',
  'cp -R tasks/plans/261122-x tasks/plans/archive/',
  'mewkit plan archive tasks/plans/261122-x',
  'grep -rn "status:" .',
  'grep -rn . --exclude-dir=archive',
  'grep -rn tasks/plans/archive docs/',
  'ls tasks/plans/',
  'echo done > tasks/plans/archive/x/notes.md',
];

test('shell: read, list and search commands aimed at the archive are refused; moves and writes pass', () => {
  for (const command of BLOCKED) assert.equal(decidePrivacy({ paths: [], command }).exit, 2, command);
  for (const command of ALLOWED) assert.equal(decidePrivacy({ paths: [], command }).exit, 0, command);
});

test('shell: the path-like words a runtime adds to paths do not refuse a move into the archive', () => {
  const command = 'mv tasks/plans/y tasks/plans/archive/';
  assert.equal(decidePrivacy({ paths: command.split(' ').slice(1), command, toolName: 'Bash' }).exit, 0);
});

function claudeCode(payload) {
  const r = spawnSync(process.execPath, [path.join(REPO, '.claude/hooks/privacy-block.cjs')], {
    cwd: REPO, input: JSON.stringify({ hook_event_name: 'PreToolUse', cwd: REPO, ...payload }), encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: os.tmpdir(), CLAUDE_PROJECT_DIR: REPO },
  });
  return r.status;
}

test('Claude Code: Read, Grep, Glob and Bash reads of the archive are refused; Edit and a root grep pass', () => {
  assert.equal(claudeCode({ tool_name: 'Read', tool_input: { file_path: 'tasks/plans/archive/x/plan.md' } }), 2);
  assert.equal(claudeCode({ tool_name: 'Grep', tool_input: { pattern: 'status', path: 'tasks/plans/archive' } }), 2);
  assert.equal(claudeCode({ tool_name: 'Glob', tool_input: { pattern: 'tasks/plans/archive/**/*.md' } }), 2);
  assert.equal(claudeCode({ tool_name: 'Bash', tool_input: { command: 'cat tasks/plans/archive/x/plan.md' } }), 2);
  assert.equal(claudeCode({ tool_name: 'Edit', tool_input: { file_path: 'tasks/plans/archive/x/plan.md', old_string: 'a', new_string: 'b' } }), 0);
  assert.equal(claudeCode({ tool_name: 'Grep', tool_input: { pattern: 'status', path: '.' } }), 0);
  assert.equal(claudeCode({ tool_name: 'Glob', tool_input: { pattern: '**/*.pem' } }), 0);
  assert.equal(claudeCode({ tool_name: 'Bash', tool_input: { command: 'mewkit plan archive tasks/plans/x' } }), 0);
});

test('Claude Code registers the privacy guard on Grep and Glob as well as Read', () => {
  const settings = JSON.parse(fs.readFileSync(path.join(REPO, '.claude/settings.json'), 'utf8'));
  const group = settings.hooks.PreToolUse.find((g) => g.hooks.some((h) => (h.args || []).some((a) => a.endsWith('privacy-block.cjs'))) && /\bRead\b/.test(g.matcher || ''));
  assert.deepEqual(group.matcher.split('|').sort(), ['Glob', 'Grep', 'Read']);
});

function shell(rel, input, args = []) {
  return spawnSync(process.execPath, [path.join(OVERLAYS, rel), ...args], { cwd: REPO, input, encoding: 'utf8', env: { PATH: process.env.PATH, HOME: os.tmpdir() } });
}

test('Codex: cat of the archive is denied, a move into it is not', () => {
  const run = (command) => shell('codex/files/.codex/hooks/privacy-block.cjs', JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command }, cwd: REPO }));
  assert.match(run('cat tasks/plans/archive/x/plan.md').stdout, /"permissionDecision":"deny".*archived plan/);
  assert.equal(run('mv tasks/plans/x tasks/plans/archive/').stdout, '');
});

test('Grok and Antigravity: a read tool on the archive is denied, a write tool is not', () => {
  const grok = (toolName, toolInput) => shell('grok/files/.grok/meowkit/hooks/privacy-block.cjs', JSON.stringify({ hookEventName: 'PreToolUse', toolName, toolInput, cwd: REPO }));
  assert.equal(grok('read_file', { path: 'tasks/plans/archive/x/plan.md' }).status, 2);
  assert.equal(grok('edit_file', { path: 'tasks/plans/archive/x/plan.md' }).status, 0);
  const ag = (name, args) => JSON.parse(shell('antigravity/files/.agents/meowkit-antigravity/hooks/privacy-block.cjs', JSON.stringify({ toolCall: { name, args } })).stdout).decision;
  assert.equal(ag('view_file', { AbsolutePath: path.join(REPO, 'tasks/plans/archive/x/plan.md') }), 'deny');
  assert.equal(ag('write_to_file', { TargetFile: path.join(REPO, 'tasks/plans/archive/x/plan.md') }), 'allow');
  assert.equal(ag('run_command', { CommandLine: 'ls tasks/plans/archive' }), 'deny');
});

test('Pi and OMP: the guard denies a read of the archive and allows a write', () => {
  const guard = (call) => JSON.parse(shell('agents/files/.agents/meowkit/hooks/guard.cjs', '', [JSON.stringify({ cwd: REPO, ...call })]).stdout);
  assert.equal(guard({ toolName: 'read', input: { path: 'tasks/plans/archive/x/plan.md' } }).block, true);
  assert.equal(guard({ toolName: 'write', input: { path: 'tasks/plans/archive/x/plan.md', content: 'x' } }).block, false);
});

test('Cursor: file reads, search tools and shell reads of the archive are denied', () => {
  const read = shell('cursor/files/.cursor/hooks/privacy-read-gate.cjs', JSON.stringify({ file_path: 'tasks/plans/archive/x/plan.md' }));
  assert.equal(JSON.parse(read.stdout).permission, 'deny');
  assert.equal(evaluateToolPolicy({ tool_name: 'grep', tool_input: { path: 'tasks/plans/archive' } }).permission, 'deny');
  assert.equal(evaluateToolPolicy({ tool_name: 'grep', tool_input: { path: 'src' } }).permission, 'allow');
  assert.equal(evaluateShellPolicy({ command: 'cat tasks/plans/archive/x/plan.md' }).blocked, true);
  assert.equal(evaluateShellPolicy({ command: 'mv tasks/plans/x tasks/plans/archive/' }).blocked, false);
});
