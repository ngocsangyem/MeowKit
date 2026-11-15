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

/** Scan one file with the handler in-process; returns `{ exitCode, stderr }` or null. */
function scan(name, body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'post-write-'));
  fs.writeFileSync(path.join(dir, name), body);
  const r = require(hook)({ root: dir, hookInput: { filePath: path.join(dir, name) } }) || {};
  return { exitCode: r.exitCode || 0, stderr: r.stderr || '' };
}

test('post-write scans the extensions it used to skip', () => {
  for (const name of ['a.tsx', 'a.jsx', 'a.mjs', 'a.py', 'a.go']) {
    assert.equal(scan(name, 'token = "abcdef123456"\n').exitCode, 2, name);
  }
});

test('post-write catches a spaced secret assignment and a disabled RLS statement', () => {
  assert.match(scan('a.ts', 'const apiKey = "sk-live-abcdef";\n').stderr, /Hardcoded secret/);
  assert.match(scan('m.sql', 'ALTER TABLE users DISABLE ROW LEVEL SECURITY;\n').stderr, /RLS disabled/);
});

test('post-write leaves an unquoted spaced assignment alone', () => {
  assert.equal(scan('a.ts', 'const password = readPassword();\n').exitCode, 0);
});
