// The Antigravity guard entry scripts answer on stdout in the form Antigravity documents
// (https://antigravity.google/docs/hooks, "PreToolUse", read 2026-11-22), and every failure
// they can see is a deny: unreadable input, a missing runtime config, a library that will not
// load. Whether the host honours the answer is for a live run to show; these run the scripts.
//
// Run with: node --test .claude/hooks/__tests__/

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../../..');
const BUNDLE = path.join(ROOT, 'kit/overlays/antigravity/files');
const HOOKS = path.join(BUNDLE, '.agents/meowkit-antigravity/hooks');
const PRIVACY = path.join(HOOKS, 'privacy-block.cjs');
const PRE_SHIP = path.join(HOOKS, 'pre-ship.cjs');

/** Run `script` with `stdin`; the answer is its stdout read as JSON. */
function run(script, stdin, cwd = ROOT) {
  const out = spawnSync(process.execPath, [script], { input: stdin, cwd, encoding: 'utf8', timeout: 60_000 });
  let answer = null;
  try {
    answer = JSON.parse(out.stdout);
  } catch {
    answer = null;
  }
  return { status: out.status, answer, stdout: out.stdout, stderr: out.stderr };
}

/** A PreToolUse payload as the page's example spells it. */
function call(name, args) {
  return JSON.stringify({
    toolCall: { name, args },
    stepIdx: 0,
    conversationId: 'ec33ebf9-0cba-4100-8142-c61503f6c587',
    workspacePaths: [ROOT],
    modelName: 'test',
  });
}

/** A copy of the hooks folder, so one file can be taken away. */
function copyHooks() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-antigravity-hooks-'));
  fs.cpSync(HOOKS, dir, { recursive: true });
  return dir;
}

for (const [label, script] of [['privacy guard', PRIVACY], ['ship check', PRE_SHIP]]) {
  test(`${label}: unparseable input is denied through stdout JSON`, () => {
    for (const stdin of ['', 'not json', '[1,2]', 'null']) {
      const r = run(script, stdin);
      assert.equal(r.status, 0, `exit 0 carries the answer (${JSON.stringify(stdin)}): ${r.stderr}`);
      assert.equal(r.answer && r.answer.decision, 'deny', `${JSON.stringify(stdin)} -> ${r.stdout}`);
      assert.ok(r.answer.reason, 'a deny says why');
    }
  });

  test(`${label}: a library that will not load is denied through stdout JSON`, () => {
    const dir = copyHooks();
    try {
      fs.rmSync(path.join(dir, 'lib'), { recursive: true, force: true });
      const r = run(path.join(dir, path.basename(script)), call('run_command', { CommandLine: 'ls' }));
      assert.equal(r.status, 0, r.stderr);
      assert.equal(r.answer && r.answer.decision, 'deny', r.stdout);
      assert.match(r.answer.reason, /could not run/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('privacy guard: a credential file named in a documented argument is denied', () => {
  const reads = [
    call('view_file', { AbsolutePath: path.join(ROOT, '.env') }),
    call('write_to_file', { TargetFile: path.join(ROOT, 'config/credentials.json'), CodeContent: '{}' }),
    call('run_command', { CommandLine: 'cat .env', Cwd: ROOT }),
  ];
  for (const stdin of reads) {
    const r = run(PRIVACY, stdin);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.answer && r.answer.decision, 'deny', `${stdin} -> ${r.stdout}`);
    assert.doesNotMatch(r.answer.reason, /AskUserQuestion/, 'the reason uses words this runtime can act on');
  }
});

test('privacy guard: an ordinary read is allowed', () => {
  const r = run(PRIVACY, call('view_file', { AbsolutePath: path.join(ROOT, 'README.md') }));
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.answer, { decision: 'allow' });
});

test('privacy guard: a missing runtime config is denied', () => {
  const dir = copyHooks();
  try {
    fs.rmSync(path.join(dir, 'hook-runtime-config.json'));
    const r = run(path.join(dir, 'privacy-block.cjs'), call('view_file', { AbsolutePath: path.join(ROOT, 'README.md') }));
    assert.equal(r.answer && r.answer.decision, 'deny', r.stdout);
    assert.match(r.answer.reason, /hook-runtime-config\.json/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ship check: a command that does not ship is allowed', () => {
  const r = run(PRE_SHIP, call('run_command', { CommandLine: 'ls -la', Cwd: ROOT }));
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.answer, { decision: 'allow' });
});

test('ship check: a call with no command is allowed', () => {
  const r = run(PRE_SHIP, call('view_file', { AbsolutePath: path.join(ROOT, 'README.md') }));
  assert.deepEqual(r.answer, { decision: 'allow' });
});

test('hooks.json registers both guards on PreToolUse, each with an installed script and a timeout', () => {
  const doc = JSON.parse(fs.readFileSync(path.join(BUNDLE, '.agents/hooks.json'), 'utf8'));
  const seen = {};
  for (const [name, hook] of Object.entries(doc)) {
    assert.notEqual(hook.enabled, false, `${name} is disabled`);
    for (const group of hook.PreToolUse || []) {
      for (const handler of group.hooks) {
        assert.equal(handler.type, 'command');
        assert.ok(Number.isInteger(handler.timeout), `${name} sets its own timeout`);
        const script = handler.command.split(/\s+/)[1];
        assert.ok(fs.existsSync(path.join(BUNDLE, script)), `${script} is not in the bundle`);
        seen[path.basename(script)] = { matcher: group.matcher, timeout: handler.timeout };
      }
    }
  }
  assert.equal(seen['privacy-block.cjs'].matcher, '*', 'the privacy guard sees every tool');
  assert.equal(seen['pre-ship.cjs'].matcher, 'run_command');
  // The checks stop at their own 270 s deadline before the host's timeout can stop the hook.
  assert.ok(seen['pre-ship.cjs'].timeout * 1000 > require(path.join(HOOKS, 'lib/core/pre-ship.cjs')).DEADLINE_MS);
});
