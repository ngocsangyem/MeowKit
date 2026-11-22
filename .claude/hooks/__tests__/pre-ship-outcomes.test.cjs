// The ship check's three outcomes, how each runtime answers them, and the trace record per run.
//
//   failed         a check ran and reported a problem: blocked outright
//   could_not_run  no verdict (a crash, a missing tool, the deadline): blocked, with a message
//                  naming the cause; Claude Code and Cursor hand it to the permission prompt
//                  (`ask`), Codex denies and points at the person's own terminal
//   passed         nothing to stop
//
// No command token or environment variable skips a check; one that looks like it tries is
// named as refused. Each ship decision appends exactly one `ship_check` trace record.
//
// Run with: node --test .claude/hooks/__tests__/

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '../../..');
const CC_SHELL = path.join(REPO, '.claude/hooks/pre-ship.cjs');
const CODEX_SHELL = path.join(REPO, 'kit/overlays/codex/files/.codex/hooks/pre-ship.cjs');
const CURSOR_SHELL = path.join(REPO, 'kit/overlays/cursor/files/.cursor/hooks/pre-ship.cjs');
const { decidePreShip } = require('../lib/core/pre-ship.cjs');

const tempDir = (prefix) => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe' }).toString().trim();

function write(dir, rel, body) {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), body);
}

/** A repository whose lint fails when the staged diff carries LINT_ERROR and sleeps on LINT_SLOW. */
function project() {
  const dir = tempDir('ship-outcome-');
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'test');
  write(dir, '.gitignore', '.meowkit/\n');
  write(dir, 'package.json', JSON.stringify({ scripts: { lint: 'node lint.cjs' } }));
  write(dir, 'lint.cjs', [
    "const s = require('child_process').execFileSync('git', ['diff', '--cached']).toString();",
    "if (s.includes('LINT_SLOW')) { const t = Date.now() + 5000; while (Date.now() < t); }",
    "process.exit(s.includes('LINT_ERROR') ? 1 : 0);",
    '',
  ].join('\n'));
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'base');
  return dir;
}

function stage(dir, body) {
  write(dir, 'src/change.js', body);
  git(dir, 'add', 'src/change.js');
}

/** The `ship_check` records in the project's trace log. */
function shipRecords(dir) {
  const file = path.join(dir, '.meowkit/telemetry/trace-log.jsonl');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.event === 'ship_check');
}

/** A PATH holding node and git only, so `npm` cannot be found. */
function pathWithoutNpm() {
  // Windows cannot symlink without privileges, and git.exe needs its sibling files, so there the
  // PATH is git's own directory, which holds no npm.
  if (process.platform === 'win32') return path.dirname(execFileSync('where', ['git']).toString().split(/\r?\n/)[0].trim());
  const bin = tempDir('ship-bin-');
  fs.symlinkSync(process.execPath, path.join(bin, 'node'));
  fs.symlinkSync(execFileSync('which', ['git']).toString().trim(), path.join(bin, 'git'));
  return bin;
}

/** A closed environment, so nothing the test host exports can change a decision. */
function baseEnv(dir, extra = {}) {
  return { ...windowsSystemEnv(), HOME: dir, PATH: process.env.PATH, CLAUDE_PROJECT_DIR: dir, ...extra };
}

/** Windows cannot start cmd.exe or npm without these; nothing on POSIX needs them. */
function windowsSystemEnv() {
  if (process.platform !== 'win32') return {};
  const keep = ["SystemRoot", "TEMP", "TMP", "USERPROFILE", "APPDATA"];
  return Object.fromEntries(keep.filter((k) => process.env[k]).map((k) => [k, process.env[k]]));
}

function runShell(shell, dir, payload, env) {
  const r = spawnSync(process.execPath, [shell], { cwd: dir, input: JSON.stringify(payload), env, encoding: 'utf8' });
  return { exit: r.status, stdout: r.stdout, stderr: r.stderr };
}

const ccPayload = (dir, command) => ({ session_id: 's', cwd: dir, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } });

function decision(stdout) {
  try {
    return JSON.parse(stdout.trim()).hookSpecificOutput || null;
  } catch {
    return null;
  }
}

test('a failed check denies (exit 2) and records one failed outcome', () => {
  const dir = project();
  stage(dir, '// LINT_ERROR\n');
  const r = runShell(CC_SHELL, dir, ccPayload(dir, 'git commit -m "secret-message-text"'), baseEnv(dir));
  assert.equal(r.exit, 2);
  assert.match(r.stderr, /PRE-SHIP BLOCKED: npm run lint/);
  assert.equal(decision(r.stdout), null, 'a failed check is not handed to the permission prompt');
  const records = shipRecords(dir);
  assert.equal(records.length, 1);
  assert.equal(records[0].data.outcome, 'failed');
  assert.equal(records[0].data.cause, 'check_failed');
  assert.doesNotMatch(JSON.stringify(records[0]), /secret-message-text|git commit/, 'no command text in the record');
});

test('a clean ship passes and records one passed outcome', () => {
  const dir = project();
  stage(dir, 'module.exports = 1;\n');
  const r = runShell(CC_SHELL, dir, ccPayload(dir, 'git commit -m x'), baseEnv(dir));
  assert.equal(r.exit, 0);
  assert.match(r.stdout, /PRE-SHIP PASS/);
  const records = shipRecords(dir);
  assert.deepEqual(records.map((x) => x.data), [{ outcome: 'passed', action: 'commit' }]);
});

test('a non-ship command runs nothing and records nothing', () => {
  const dir = project();
  const r = runShell(CC_SHELL, dir, ccPayload(dir, 'git status'), baseEnv(dir));
  assert.equal(r.exit, 0);
  assert.equal(r.stdout, '');
  assert.equal(shipRecords(dir).length, 0);
});

test('a missing tool cannot run: Claude Code asks the person, naming the tool', () => {
  const dir = project();
  stage(dir, 'module.exports = 1;\n');
  const r = runShell(CC_SHELL, dir, ccPayload(dir, 'git commit -m x'), baseEnv(dir, { PATH: pathWithoutNpm() }));
  assert.equal(r.exit, 0, 'the ask decision is JSON on exit 0');
  const d = decision(r.stdout);
  assert.equal(d.permissionDecision, 'ask');
  assert.match(d.permissionDecisionReason, /could not run/i);
  assert.match(d.permissionDecisionReason, /Not found: npm/);
  assert.doesNotMatch(d.permissionDecisionReason, /PRE-SHIP BLOCKED/, 'distinct from the failed-check message');
  const records = shipRecords(dir);
  assert.equal(records.length, 1);
  assert.deepEqual(records[0].data, { outcome: 'could_not_run', cause: 'missing_tool', action: 'commit' });
});

test('a missing tool cannot run: Codex denies and points at the person\'s own terminal', () => {
  const dir = project();
  stage(dir, 'module.exports = 1;\n');
  const payload = { cwd: dir, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m x' } };
  const r = runShell(CODEX_SHELL, dir, payload, baseEnv(dir, { PATH: pathWithoutNpm() }));
  const d = decision(r.stdout);
  assert.equal(d.permissionDecision, 'deny');
  assert.match(d.permissionDecisionReason, /COULD NOT RUN/);
  assert.match(d.permissionDecisionReason, /run the command in your own terminal/);
  assert.equal(shipRecords(dir).length, 1);
});

test('a missing tool cannot run: Cursor asks; a failed check denies', () => {
  const dir = project();
  stage(dir, 'module.exports = 1;\n');
  const ask = runShell(CURSOR_SHELL, dir, { command: 'git commit -m x', cwd: dir }, baseEnv(dir, { PATH: pathWithoutNpm() }));
  assert.equal(JSON.parse(ask.stdout).permission, 'ask');
  stage(dir, '// LINT_ERROR\n');
  const deny = runShell(CURSOR_SHELL, dir, { command: 'git commit -m y', cwd: dir }, baseEnv(dir));
  assert.equal(JSON.parse(deny.stdout).permission, 'deny');
});

test('the hooks kill switch does not stand the Cursor ship check down', () => {
  const dir = project();
  stage(dir, '// LINT_ERROR\n');
  const r = runShell(CURSOR_SHELL, dir, { command: 'git commit -m x', cwd: dir }, baseEnv(dir, { MEWKIT_CURSOR_HOOKS_KILL_SWITCH: '1' }));
  const out = JSON.parse(r.stdout);
  assert.equal(out.permission, 'deny');
  assert.match(out.agent_message, /Refused: MEWKIT_CURSOR_HOOKS_KILL_SWITCH \(environment\) does not skip/);
});

test('a check stopped at the deadline cannot run, and the message names the deadline', () => {
  const dir = project();
  stage(dir, '// LINT_SLOW\n');
  const result = decidePreShip({ root: dir, command: 'git commit -m x', env: { PATH: process.env.PATH, HOME: dir }, deadlineMs: 1000 });
  assert.equal(result.exit, 2);
  assert.equal(result.outcome, 'could_not_run');
  assert.equal(result.cause, 'timeout');
  assert.match(result.stderr.join('\n'), /deadline of 1 s/);
  assert.match(result.stdout.join('\n'), /DID NOT FINISH: npm run lint/);
  assert.deepEqual(shipRecords(dir).map((x) => x.data), [{ outcome: 'could_not_run', cause: 'timeout', action: 'commit' }]);
});

test('a crash in the decision cannot run: Claude Code asks, and one record is written', () => {
  const dir = project();
  stage(dir, 'module.exports = 1;\n');
  // A throwaway copy of the hook tree whose check block throws.
  const tree = tempDir('ship-crash-tree-');
  fs.cpSync(path.join(REPO, '.claude/hooks'), path.join(tree, '.claude/hooks'), { recursive: true });
  fs.appendFileSync(path.join(tree, '.claude/hooks/lib/preship-checks.cjs'), "\nmodule.exports.runPreShipChecks = () => { throw new Error('patched to throw'); };\n");
  const r = runShell(path.join(tree, '.claude/hooks/pre-ship.cjs'), dir, ccPayload(dir, 'git commit -m x'), baseEnv(dir));
  assert.equal(r.exit, 0);
  const d = decision(r.stdout);
  assert.equal(d.permissionDecision, 'ask');
  assert.match(d.permissionDecisionReason, /the ship check crashed \(patched to throw\)/);
  assert.deepEqual(shipRecords(dir).map((x) => x.data), [{ outcome: 'could_not_run', cause: 'crash', action: 'commit' }]);
});

test('a skip flag, a skip assignment and a skip variable are refused, and the check still blocks', () => {
  const dir = project();
  stage(dir, '// LINT_ERROR\n');
  const cases = [
    ['git commit --no-verify -m a', {}, /Refused: --no-verify does not skip/],
    ['git commit -n -m b', {}, /Refused: -n does not skip/],
    ['MEOWKIT_SKIP_SHIP_CHECK=1 git commit -m c', {}, /Refused: MEOWKIT_SKIP_SHIP_CHECK=1 does not skip/],
    ['git commit -m d', { MEOWKIT_SKIP_PRESHIP: '1' }, /Refused: MEOWKIT_SKIP_PRESHIP \(environment\) does not skip/],
    ['git commit -m e', { HUSKY: '0' }, /Refused: HUSKY \(environment\) does not skip/],
  ];
  for (const [command, extra, refusal] of cases) {
    const r = runShell(CC_SHELL, dir, ccPayload(dir, command), baseEnv(dir, extra));
    assert.equal(r.exit, 2, `${command} must still be blocked`);
    assert.match(r.stderr, /PRE-SHIP BLOCKED/);
    assert.match(r.stderr, refusal, command);
  }
  assert.equal(shipRecords(dir).length, cases.length, 'one record per run');
});

test('the hook registration blocks when the host cannot run or has to stop the hook', () => {
  const settings = JSON.parse(fs.readFileSync(path.join(REPO, '.claude/settings.json'), 'utf8'));
  const bash = settings.hooks.PreToolUse.find((g) => g.matcher === 'Bash');
  const ship = bash.hooks.find((h) => (h.args || []).some((a) => a.endsWith('/pre-ship.cjs')));
  assert.equal(ship.onFailure, 'block');
  const cursor = JSON.parse(fs.readFileSync(path.join(REPO, 'kit/overlays/cursor/files/.cursor/hooks.json'), 'utf8'));
  const cursorShip = cursor.hooks.beforeShellExecution.find((h) => h.command.endsWith('pre-ship.cjs'));
  assert.equal(cursorShip.failClosed, true);
});
