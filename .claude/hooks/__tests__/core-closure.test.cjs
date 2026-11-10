// The library each shared safety behaviour loads is exactly what core-closure.json lists, and
// every non-Claude bundle carries an exact copy of the shared files.
//
// The closure is what an emitter ships beside a runtime's shells. A `require` added outside
// the list would ship a hook that crashes on load — which a blocking hook turns into a block
// of every call — so the computed graph must equal the list, not merely fit inside it.
//
// Run with: node --test .claude/hooks/__tests__/

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HOOKS = path.resolve(__dirname, '..');
const LIB = path.join(HOOKS, 'lib');
const ROOT = path.resolve(HOOKS, '../..');
const closure = JSON.parse(fs.readFileSync(path.join(HOOKS, 'core-closure.json'), 'utf8'));
const { bundleCopies } = require(path.join(ROOT, 'scripts/sync-hook-core.cjs'));

const LOCAL_REQUIRE = /require\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g;
const SPAWNED_LIB = /['"]\.claude\/hooks\/lib\/([\w./-]+\.cjs)['"]/g;

/** Every local file reachable by `require` from `entry`, and the lib scripts they name. */
function graph(entry) {
  const files = new Set();
  const spawned = new Set();
  const stack = [entry];
  while (stack.length) {
    const file = stack.pop();
    if (files.has(file)) continue;
    files.add(file);
    const source = fs.readFileSync(file, 'utf8');
    for (const [, rel] of source.matchAll(LOCAL_REQUIRE)) {
      const target = path.resolve(path.dirname(file), rel);
      stack.push(path.extname(target) ? target : `${target}.cjs`);
    }
    for (const [, rel] of source.matchAll(SPAWNED_LIB)) spawned.add(rel);
  }
  const inLib = [...files].filter((f) => f.startsWith(`${LIB}${path.sep}`)).map((f) => path.relative(LIB, f).split(path.sep).join('/'));
  // A lib path named in a string that is also required (a message naming the checker) is
  // already in `lib`; only the rest are run as child processes.
  return { lib: inLib.sort(), spawned: [...spawned].filter((f) => !inLib.includes(f)).sort() };
}

for (const [name, entry] of Object.entries(closure.behaviours)) {
  test(`${name}: the listed closure is exactly what ${entry.shell} loads`, () => {
    const actual = graph(path.join(HOOKS, entry.shell));
    assert.deepEqual(actual.lib, [...entry.lib].sort(), 'run the graph and update core-closure.json `lib`');
    assert.deepEqual(actual.spawned, [...entry.spawned].sort(), 'update core-closure.json `spawned`');
  });
}

test('the bundled set is the shared behaviours plus the runtime adapter, nothing else', () => {
  const shared = new Set(['hook-runtime.cjs']);
  for (const name of ['plan-gate', 'privacy']) {
    for (const file of closure.behaviours[name].lib) if (file !== 'parse-stdin.cjs') shared.add(file);
  }
  for (const file of graph(path.join(LIB, 'hook-runtime.cjs')).lib) shared.add(file);
  assert.deepEqual([...closure.bundled].sort(), [...shared].sort());
});

test('every bundle carries a byte-identical copy of each bundled file', () => {
  const stale = bundleCopies(ROOT).filter((c) => c.state !== 'same').map((c) => `${c.state}: ${c.dir}/${c.file}`);
  assert.deepEqual(stale, [], 'run: node scripts/sync-hook-core.cjs');
});

test('every shell in a bundle resolves each local require to a file in that bundle', () => {
  for (const dir of closure.bundleLibDirs) {
    const hooksDir = path.join(ROOT, dir, '..');
    for (const shell of fs.readdirSync(hooksDir).filter((f) => f.endsWith('.cjs'))) {
      const stack = [path.join(hooksDir, shell)];
      const seen = new Set();
      while (stack.length) {
        const file = stack.pop();
        if (seen.has(file)) continue;
        seen.add(file);
        assert.ok(fs.existsSync(file), `${path.relative(ROOT, file)} is required but missing`);
        for (const [, rel] of fs.readFileSync(file, 'utf8').matchAll(LOCAL_REQUIRE)) {
          const target = path.resolve(path.dirname(file), rel);
          stack.push(path.extname(target) ? target : `${target}.cjs`);
        }
      }
    }
  }
});
