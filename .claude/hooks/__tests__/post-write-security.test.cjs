// Post-write security scanning must remain active in every hook profile.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '../../..');
const hook = path.join(projectRoot, '.claude/hooks/handlers/post-write.cjs');

function runScan(profile) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'post-write-'));
  const file = path.join(dir, 'src', 'unsafe.ts');
  const helper = path.join(dir, '.claude', 'hooks', 'lib', 'load-dotenv.cjs');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.mkdirSync(path.dirname(helper), { recursive: true });
  fs.copyFileSync(
    path.join(projectRoot, '.claude', 'hooks', 'lib', 'load-dotenv.cjs'),
    helper,
  );
  fs.writeFileSync(file, 'const token="secret";\n');

  const driver = [
    `const handler = require(${JSON.stringify(hook)});`,
    'const r = handler({ root: process.cwd(), hookInput: { filePath: process.argv[1] } }) || {};',
    'if (r.stdout) process.stdout.write(r.stdout);',
    'if (r.stderr) process.stderr.write(r.stderr);',
    'process.exit(r.exitCode || 0);',
  ].join('\n');
  return spawnSync(process.execPath, ['-e', driver, file], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir, MEOW_HOOK_PROFILE: profile },
  });
}

test('post-write blocks a hardcoded secret in the fast profile', () => {
  const result = runScan('fast');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Hardcoded secret/);
});
