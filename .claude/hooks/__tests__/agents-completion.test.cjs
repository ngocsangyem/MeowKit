// The completion script the Pi extension and the OMP hook module run: off unless opted in,
// a pass only from a result the runtime reported as a success, a block on an unverified edit
// at the end of a turn, at most twice, then a notice.
//
// Run with: node --test .claude/hooks/__tests__/

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '../../../kit/overlays/agents/files/.agents/meowkit/hooks/completion.cjs');

function repo({ optIn }) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mk-agents-cc-')));
  const git = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
  git('init', '-q');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a\n');
  if (optIn) {
    fs.mkdirSync(path.join(dir, '.meowkit'));
    fs.writeFileSync(path.join(dir, '.meowkit', 'config.yaml'), 'hooks:\n  pre-completion-check: true\n');
  }
  git('add', '-A');
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'c');
  return dir;
}

// A home with no config, and a root variable naming another tree: neither may decide anything.
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-agents-cc-home-'));
const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-agents-cc-else-'));

function call(cwd, payload) {
  const out = execFileSync('node', [SCRIPT, JSON.stringify({ cwd, ...payload })], {
    cwd: os.tmpdir(),
    env: { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_PROJECT_DIR: elsewhere, MEOWKIT_PROJECT_DIR: '' },
    encoding: 'utf8',
  });
  return JSON.parse(out);
}

test('without the opt-in nothing is recorded and the turn ends', () => {
  const dir = repo({ optIn: false });
  call(dir, { event: 'session_start', sessionId: 's' });
  fs.writeFileSync(path.join(dir, 'a.txt'), 'changed\n');
  assert.equal(call(dir, { event: 'agent_end', sessionId: 's' }).action, 'allow');
  assert.equal(fs.existsSync(path.join(dir, '.meowkit', 'state', 'completion-evidence.json')), false);
});

test('an unverified edit is blocked twice, then noticed; a failed run records nothing', () => {
  const dir = repo({ optIn: true });
  call(dir, { event: 'session_start', sessionId: 's' });
  assert.equal(call(dir, { event: 'agent_end', sessionId: 's' }).action, 'allow', 'nothing changed yet');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'changed\n');
  const first = call(dir, { event: 'agent_end', sessionId: 's' });
  assert.equal(first.action, 'block');
  assert.match(first.reason, /Files changed since the last passing/);
  call(dir, { event: 'tool_result', sessionId: 's', command: 'cargo test', passed: false });
  assert.equal(call(dir, { event: 'agent_end', sessionId: 's' }).action, 'block');
  assert.equal(call(dir, { event: 'agent_end', sessionId: 's' }).action, 'notice');
  assert.equal(call(dir, { event: 'agent_end', sessionId: 's' }).action, 'allow', 'one notice per tree');
});

test('a passing check on the edited tree lets the turn end; a non-check command does not count', () => {
  const dir = repo({ optIn: true });
  call(dir, { event: 'session_start', sessionId: 's2' });
  fs.writeFileSync(path.join(dir, 'a.txt'), 'changed\n');
  call(dir, { event: 'tool_result', sessionId: 's2', command: 'ls -la', passed: true });
  assert.equal(call(dir, { event: 'agent_end', sessionId: 's2' }).action, 'block');
  call(dir, { event: 'tool_result', sessionId: 's2', command: 'cargo test --workspace', passed: true });
  assert.equal(call(dir, { event: 'agent_end', sessionId: 's2' }).action, 'allow');
  assert.equal(call(dir, { event: 'agent_end', sessionId: 'other' }).action, 'allow', 'another session starts from its own baseline');
});

test('unreadable input lets the session go on', () => {
  const out = execFileSync('node', [SCRIPT, '{not json'], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(out), { action: 'allow' });
});
