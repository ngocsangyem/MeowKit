// Which `mewkit host` commands the completion check credits: a foreground `host run` as its
// inner command, and `host jobs wait` only for a done(0) job that ran on the current tree,
// credited with the class the job recorded.
//
// Run with: node --test .claude/hooks/__tests__/

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const check = require('../lib/core/completion-check.cjs');

test('a foreground host run counts as its inner command; background or piped does not', () => {
  assert.equal(check.classifyCommand('mewkit host run -- cargo test --workspace'), 'test');
  assert.equal(check.classifyCommand('mewkit host run --priority low --wait 2m -- npm run lint'), 'lint');
  assert.equal(check.classifyCommand('/usr/local/bin/mewkit host run -- cargo build'), 'build');
  assert.equal(check.classifyCommand('cd crates && mewkit host run -- cargo clippy'), 'lint');
  assert.equal(check.classifyCommand('mewkit host run --background -- cargo test'), null);
  assert.equal(check.classifyCommand('mewkit host run -- cargo test | tail'), null);
  assert.equal(check.classifyCommand('mewkit host run -- ls'), null);
  assert.equal(check.classifyCommand('mk host run -- cargo test'), 'test', 'the short binary name');
  assert.equal(check.classifyCommand('mkdir host run -- cargo test'), null);
  assert.equal(check.classifyCommand('mewkit host jobs wait 261128-1-abc'), null, 'the text names no runner');
});

function repo() {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mk-hostev-')));
  const run = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
  run('init', '-q');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a\n');
  run('add', '-A');
  run('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'c');
  return dir;
}

function job(home, id, { exit, cancelled = false, cls = 'test', digest, ran = digest, worktree }) {
  const dir = path.join(home, '.meowkit', 'host', 'jobs', id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ id, cmd_class: cls, tree_digest: digest, ran_tree_digest: ran, worktree, cmd_hash: 'h', exe_base: 'cargo' }));
  if (exit !== undefined) fs.writeFileSync(path.join(dir, 'exit'), String(exit));
  if (cancelled) fs.writeFileSync(path.join(dir, 'cancelled'), '1');
}

test('jobs wait counts only a done(0) job on the current tree, with the class it recorded', () => {
  const root = repo();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-hostev-home-'));
  const stateFile = path.join(root, '.meowkit', 'state', 'evidence.json');
  const digest = check.treeDigest(root);
  const mk = (id, o) => job(home, id, { worktree: root, ...o });
  const pass = (id) => check.recordPass({ root, stateFile, sessionId: 's', command: `mewkit host jobs wait ${id}`, home });
  mk('ok', { exit: 0, cls: 'lint', digest });
  mk('failed', { exit: 1, digest });
  mk('running', { digest });
  mk('cancelled', { exit: 130, cancelled: true, digest });
  mk('cancelled0', { exit: 0, cancelled: true, digest });
  mk('noclass', { exit: 0, cls: null, digest });
  mk('old-tree', { exit: 0, digest: 'f'.repeat(64) });
  mk('other-worktree', { exit: 0, digest, worktree: '/elsewhere/clone' });
  mk('ran-elsewhere', { exit: 0, digest, ran: 'e'.repeat(64) });
  mk('tree-moved', { exit: 0, digest, ran: null });
  assert.equal(pass('ok'), 'lint');
  for (const id of ['failed', 'running', 'cancelled', 'cancelled0', 'noclass', 'old-tree', 'ran-elsewhere', 'other-worktree', 'tree-moved', 'missing']) assert.equal(pass(id), null, id);
  // Built from parts: the kit's reference checker resolves two command levels only, so a
  // literal `--timeout` after `jobs wait` would read to it as a `jobs` flag.
  const wait = ['host', 'jobs', 'wait'].join(' ');
  for (const command of [`mk ${wait} ok`, `mewkit ${wait} --timeout 2m ok`, `mewkit ${wait} ok --timeout=30s`, `/opt/bin/mk.exe ${wait} ok`]) {
    assert.equal(check.recordPass({ root, stateFile, sessionId: 's', command, home }), 'lint', command);
  }
  assert.equal(check.recordPass({ root, stateFile, sessionId: 's', command: 'mewkit host jobs wait ../../etc', home }), null);
  fs.writeFileSync(path.join(root, 'a.txt'), 'changed\n');
  assert.equal(pass('ok'), null, 'the tree changed since the job ran');
});
