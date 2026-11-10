// The safety guards block when they cannot tell which project they guard.
//
// They used to take CLAUDE_PROJECT_DIR or the working directory and exit 0 when entering it
// failed, so a stale variable or a runtime that sets none let every write, read and ship
// through. These tests run the real hooks with no usable root and check the block, and pin
// the order the guard root is resolved in.
//
// Run with: node --test .claude/hooks/__tests__/

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const HOOKS = path.resolve(__dirname, '..');
const { resolveGuardRoot } = require('../lib/project-root.cjs');

const tempDir = (prefix) => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));

function run(hook, stdin, env, cwd) {
  return spawnSync(process.execPath, [path.join(HOOKS, hook)], {
    input: stdin,
    encoding: 'utf8',
    cwd,
    env: { PATH: process.env.PATH, HOME: cwd, ...env },
  });
}

const CASES = [
  ['gate-enforcement.cjs', { tool_name: 'Write', tool_input: { file_path: 'src/a.ts', content: 'x' } }, '@@GATE_BLOCK@@'],
  ['privacy-block.cjs', { tool_name: 'Read', tool_input: { file_path: 'src/a.ts' } }, '@@PRIVACY_BLOCK@@'],
  ['pre-ship.cjs', { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } }, '@@GATE_BLOCK@@'],
];

for (const [hook, payload, marker] of CASES) {
  test(`${hook} blocks when the project-dir variable names no directory`, () => {
    const cwd = tempDir('guard-root-');
    const stdin = JSON.stringify({ hook_event_name: 'PreToolUse', cwd, ...payload });
    const result = run(hook, stdin, { CLAUDE_PROJECT_DIR: path.join(cwd, 'gone') }, cwd);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, new RegExp(marker));
    assert.match(result.stderr, /cannot locate the project root/);
  });

  test(`${hook} blocks outside any project when no variable is set`, () => {
    const cwd = tempDir('guard-root-');
    const stdin = JSON.stringify({ hook_event_name: 'PreToolUse', cwd, ...payload });
    const result = run(hook, stdin, {}, cwd);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /cannot locate the project root/);
  });
}

test('the guard root comes from the first set variable, then the git top level, and nothing else', () => {
  const a = tempDir('guard-root-a-');
  const b = tempDir('guard-root-b-');
  assert.equal(resolveGuardRoot({ MEOWKIT_PROJECT_DIR: a, CLAUDE_PROJECT_DIR: b }, b), a);
  assert.equal(resolveGuardRoot({ CURSOR_PROJECT_DIR: b }, a), b);
  assert.equal(resolveGuardRoot({ CLAUDE_PROJECT_DIR: path.join(a, 'gone'), CURSOR_PROJECT_DIR: b }, a), null);

  const repo = tempDir('guard-root-git-');
  spawnSync('git', ['init', '-q', repo]);
  fs.mkdirSync(path.join(repo, 'src'));
  // Compare real paths: on Windows git reports the long form of an 8.3 temp directory.
  const gitRoot = resolveGuardRoot({}, path.join(repo, 'src'));
  assert.ok(gitRoot, 'a git top level resolves');
  assert.equal(fs.realpathSync.native(gitRoot), fs.realpathSync.native(repo));

  // A marker directory is not a root: outside git, with no variable, there is none.
  const marked = tempDir('guard-root-marker-');
  fs.mkdirSync(path.join(marked, '.meowkit'));
  assert.equal(resolveGuardRoot({}, marked), null);

  assert.equal(resolveGuardRoot({}, tempDir('guard-root-none-')), null);
});

// Allow rules (docs, tests, kit trees) describe files of THIS project. A target that resolves
// outside the root, or climbs out of an allowed tree with `..`, must face the plan check.
for (const [label, target] of [
  ['climbs out of docs with ..', 'docs/../src/a.ts'],
  ['is a kit file outside the project', path.join(os.homedir(), '.claude', 'hooks', 'evil.cjs')],
  ['is a test file outside the project', path.join(os.tmpdir(), 'evil.test.ts')],
  ['climbs above the root into a kit tree', '../outside/.claude/x.cjs'],
]) {
  test(`gate-enforcement.cjs blocks a write that ${label} when no plan exists`, () => {
    const root = tempDir('guard-root-confine-');
    spawnSync('git', ['init', '-q', root]);
    const stdin = JSON.stringify({ hook_event_name: 'PreToolUse', cwd: root, tool_name: 'Write', tool_input: { file_path: target, content: 'x' } });
    const result = run('gate-enforcement.cjs', stdin, { CLAUDE_PROJECT_DIR: root }, root);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /No approved plan found/);
  });
}
