// Post-write security scanning must remain active in every hook profile.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '../../..');
const hook = path.join(projectRoot, '.claude/hooks/post-write.sh');

function runScan(profile) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'post-write-'));
  const file = path.join(dir, 'src', 'unsafe.ts');
  const helper = path.join(dir, '.claude', 'hooks', 'lib', 'load-dotenv.sh');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.mkdirSync(path.dirname(helper), { recursive: true });
  fs.copyFileSync(
    path.join(projectRoot, '.claude', 'hooks', 'lib', 'load-dotenv.sh'),
    helper,
  );
  fs.writeFileSync(file, 'const token="secret";\n');

  return spawnSync('sh', [hook, file], {
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
