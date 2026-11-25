// The post-edit build check and the ship check run Node tools (tsc, eslint) only from the
// project's own node_modules/.bin. With no terminal, `npx <tool>` installs a missing package
// without asking — and the registry package named `tsc` is not TypeScript — so a project
// without the tool skips the check and nothing is fetched or run from PATH in its place.
//
// The PATH here leads with stubs named npx, tsc and eslint that log every call: a call to
// any of them is the failure this file exists to catch.
//
// Run with: node --test .claude/hooks/__tests__/

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const HANDLER = path.resolve(__dirname, '../handlers/build-verify.cjs');
const { runPreShipChecks } = require('../lib/preship-checks.cjs');

const skip = process.platform === 'win32' ? 'the stubs are sh scripts' : false;

function write(dir, rel, body, mode) {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), body, mode ? { mode } : undefined);
}

/** A project, a log, and a stub bin directory whose npx/tsc/eslint record that they ran. */
function setup() {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'node-tools-')));
  const project = path.join(dir, 'project');
  const log = path.join(dir, 'calls.log');
  fs.writeFileSync(log, '');
  for (const name of ['npx', 'tsc', 'eslint']) write(dir, `stub-bin/${name}`, `#!/bin/sh\necho "path-${name} $*" >> "${log}"\nexit 0\n`, 0o755);
  write(project, 'package.json', '{}\n');
  write(project, 'tsconfig.json', '{}\n');
  write(project, 'src/a.ts', 'export const a = 1;\n');
  write(project, 'src/b.js', 'module.exports = 1;\n');
  const env = { ...process.env, PATH: `${path.join(dir, 'stub-bin')}${path.delimiter}${process.env.PATH}`, CLAUDE_PROJECT_DIR: project };
  const calls = () => fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean);
  const localTool = (name, exit, message = '') => write(project, `node_modules/.bin/${name}`, `#!/bin/sh\necho "local-${name} $*" >> "${log}"\necho "${message}"\nexit ${exit}\n`, 0o755);
  return { project, env, calls, localTool };
}

function buildVerify(env, project, file) {
  const script = `const out = require(${JSON.stringify(HANDLER)})({ root: ${JSON.stringify(project)}, tool_input: { file_path: ${JSON.stringify(file)} } }, { load: () => null, save: () => {} });
process.stdout.write(JSON.stringify(out));`;
  const r = spawnSync(process.execPath, ['-e', script], { cwd: project, env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

test('build check: with no node_modules, a .ts and a .js edit run nothing and fetch nothing', { skip }, () => {
  const { project, env, calls } = setup();
  assert.equal(buildVerify(env, project, path.join(project, 'src/a.ts')), '');
  assert.equal(buildVerify(env, project, path.join(project, 'src/b.js')), '');
  assert.deepEqual(calls(), [], 'no npx, and no tsc or eslint from PATH');
});

test('build check: an installed local eslint runs, and its failure reaches the model', { skip }, () => {
  const { project, env, calls, localTool } = setup();
  localTool('eslint', 1, 'b.js: 1 problem');
  const out = buildVerify(env, project, path.join(project, 'src/b.js'));
  assert.equal(out.exitCode, 2);
  assert.match(out.stderr, /@@BUILD_VERIFY_ERROR@@[\s\S]*b\.js: 1 problem/);
  assert.deepEqual(calls(), [`local-eslint ${path.join(project, 'src/b.js')}`]);
});

function withPath(env, fn) {
  const saved = process.env.PATH;
  process.env.PATH = env.PATH;
  try { return fn(); } finally { process.env.PATH = saved; }
}

test('ship check: a tsconfig.json with no local typescript is a named SKIP, and npx is never run', { skip }, () => {
  const { project, env, calls } = setup();
  const r = withPath(env, () => runPreShipChecks(project, { files: ['src/a.ts'], rangeKnown: true }, { deadlineMs: 20000 }));
  assert.ok(r.stdout.includes('SKIP: typescript not installed locally'), r.stdout.join('\n'));
  assert.equal(r.outcome, 'passed');
  assert.deepEqual(calls(), []);
});

test('ship check: an installed local tsc is the one that runs', { skip }, () => {
  const { project, env, calls, localTool } = setup();
  localTool('tsc', 0);
  const r = withPath(env, () => runPreShipChecks(project, { files: ['src/a.ts'], rangeKnown: true }, { deadlineMs: 20000 }));
  assert.ok(r.stdout.includes('  PASS: tsc --noEmit'), r.stdout.join('\n'));
  assert.deepEqual(calls(), ['local-tsc --noEmit']);
});
