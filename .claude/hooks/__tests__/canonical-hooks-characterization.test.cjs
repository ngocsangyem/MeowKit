// Characterization of the canonical read and ship guards as Claude Code runs them.
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

/** A throwaway git project. */
function project() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hook-char-')));
  spawnSync('git', ['init', '-q', root]);
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  return root;
}

// The golden records a machine with no `mewkit` on PATH, as on CI. A developer's installed
// CLI would run the real memory lint and add or drop lines, so directories holding one are
// left out; git and node stay reachable wherever they are installed.
const MEWKIT_NAMES = ['mewkit', 'mewkit.exe', 'mewkit.cmd'];
const HERMETIC_PATH = (process.env.PATH || '')
  .split(path.delimiter)
  .filter((dir) => dir && !MEWKIT_NAMES.some((name) => fs.existsSync(path.join(dir, name))))
  .join(path.delimiter);

function run(hook, root, stdin, env = {}) {
  const result = spawnSync(process.execPath, [path.join(HOOKS, hook)], {
    input: stdin,
    encoding: 'utf8',
    cwd: root,
    env: { PATH: HERMETIC_PATH, HOME: root, CLAUDE_PROJECT_DIR: root, ...env },
  });
  const scrub = (s) => (s || '').split(root).join('<ROOT>');
  return { exit: result.status, stdout: scrub(result.stdout), stderr: scrub(result.stderr) };
}

const bash = (command) => JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } });
const read = (file) => JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: file } });

const SCENARIOS = {
  'privacy: dotenv read blocks': () => run('privacy-block.cjs', project(), read('.env')),
  'privacy: ordinary read passes': () => run('privacy-block.cjs', project(), read('src/a.ts')),
  'privacy: loopback fetch blocks': () =>
    run('privacy-block.cjs', project(), bash('python3 fetch_as_markdown.py http://127.0.0.1:8080/x')),
  'privacy: garbage stdin blocks': () => run('privacy-block.cjs', project(), ''),
  'pre-ship: non-ship command passes': () => run('pre-ship.cjs', project(), bash('ls -la')),
  'pre-ship: commit with nothing to check passes': () => run('pre-ship.cjs', project(), bash('git commit -m x')),
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
