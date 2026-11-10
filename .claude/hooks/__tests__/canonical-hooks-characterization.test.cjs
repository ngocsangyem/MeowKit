// Characterization of the three canonical write/read/ship guards as Claude Code runs them.
//
// Each scenario runs the real hook in a child process against a throwaway git project and
// compares exit code, stdout and stderr with the golden file recorded from the hooks before
// their logic moved into shared decision modules. A refactor that changes what Claude Code
// sees fails here. Regenerate deliberately with UPDATE_GOLDEN=1 and review the diff.
//
// Run with: node --test .claude/hooks/__tests__/

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const HOOKS = path.resolve(__dirname, '..');
const GOLDEN = path.join(__dirname, 'fixtures', 'canonical-hooks-golden.json');
const { stamp } = require('../lib/approval-receipt.cjs');

/** A git project with optional plan state. */
function project({ plan = null, contract = false } = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hook-char-')));
  spawnSync('git', ['init', '-q', root]);
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  if (plan) {
    const dir = path.join(root, 'tasks', 'plans', '261110-demo');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'plan.md');
    fs.writeFileSync(file, '---\ntitle: demo\n---\n# Plan\n');
    if (plan === 'fresh' || plan === 'stale') stamp(file, 'tester', new Date('2026-11-10T00:00:00Z'));
    if (plan === 'stale') fs.appendFileSync(file, 'changed\n');
  }
  if (contract) {
    const dir = path.join(root, 'tasks', 'contracts');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '261110-demo-sprint-1.md'), '---\nstatus: signed\n---\n');
  }
  return root;
}

function run(hook, root, stdin, env = {}) {
  const result = spawnSync(process.execPath, [path.join(HOOKS, hook)], {
    input: stdin,
    encoding: 'utf8',
    cwd: root,
    env: { PATH: process.env.PATH, HOME: root, CLAUDE_PROJECT_DIR: root, ...env },
  });
  const scrub = (s) => (s || '').split(root).join('<ROOT>');
  return { exit: result.status, stdout: scrub(result.stdout), stderr: scrub(result.stderr) };
}

const write = (file) => JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: file, content: 'x' } });
const bash = (command) => JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } });
const read = (file) => JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: file } });

const SCENARIOS = {
  'gate: docs file passes': () => run('gate-enforcement.cjs', project(), write('docs/guide.md')),
  'gate: test file passes': () => run('gate-enforcement.cjs', project(), write('src/a.test.ts')),
  'gate: source without plan blocks': () => run('gate-enforcement.cjs', project(), write('src/a.ts')),
  'gate: plan without receipt blocks': () => run('gate-enforcement.cjs', project({ plan: 'unstamped' }), write('src/a.ts')),
  'gate: stale receipt blocks': () => run('gate-enforcement.cjs', project({ plan: 'stale' }), write('src/a.ts')),
  'gate: fresh receipt without contract blocks': () => run('gate-enforcement.cjs', project({ plan: 'fresh' }), write('src/a.ts')),
  'gate: fresh receipt and signed contract passes': () =>
    run('gate-enforcement.cjs', project({ plan: 'fresh', contract: true }), write('src/a.ts')),
  'gate: suspicious backup dir blocks': () => run('gate-enforcement.cjs', project(), write('src/backup/a.ts')),
  'gate: garbage stdin blocks': () => run('gate-enforcement.cjs', project(), 'not json'),
  'privacy: dotenv read blocks': () => run('privacy-block.cjs', project(), read('.env')),
  'privacy: ordinary read passes': () => run('privacy-block.cjs', project(), read('src/a.ts')),
  'privacy: loopback fetch blocks': () =>
    run('privacy-block.cjs', project(), bash('python3 fetch_as_markdown.py http://127.0.0.1:8080/x')),
  'privacy: garbage stdin blocks': () => run('privacy-block.cjs', project(), ''),
  'pre-ship: non-ship command passes': () => run('pre-ship.cjs', project(), bash('ls -la')),
  'pre-ship: commit without verdict blocks': () => run('pre-ship.cjs', project(), bash('git commit -m x')),
  'pre-ship: garbage stdin blocks': () => run('pre-ship.cjs', project(), '[]'),
};

const actual = Object.fromEntries(Object.entries(SCENARIOS).map(([name, scenario]) => [name, scenario()]));

if (process.env.UPDATE_GOLDEN === '1') {
  fs.mkdirSync(path.dirname(GOLDEN), { recursive: true });
  fs.writeFileSync(GOLDEN, `${JSON.stringify(actual, null, 2)}\n`);
}

const golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));

for (const name of Object.keys(SCENARIOS)) {
  test(name, () => {
    assert.deepEqual(actual[name], golden[name]);
  });
}
