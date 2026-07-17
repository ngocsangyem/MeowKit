// Gate 2 ship-boundary enforcement — regression fixtures for lib/gate2-check.sh.
//
// These assert the EXIT CODE, not the message. Per this repo's hook contract
// (gate-enforcement.sh:121-122) exit 2 stops the tool call and exit 1 is
// advisory — a check that prints "BLOCKED" and exits 1 does not block. Asserting
// on stderr text would pass for exactly that bug, so every blocking case here
// asserts `status === 2`.
//
// Each case runs in a throwaway git repo. The hook reads real git state, so a
// fixture that stubbed git would prove nothing about the shipped behavior.
//
// Run with: node --test .claude/hooks/__tests__/

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const CHECK = path.join(PROJECT_ROOT, '.claude/hooks/lib/gate2-check.sh');

/**
 * Build an isolated git repo carrying the pieces the check reads.
 *
 * `files`      → written AND staged. This is what a plain `git commit -m` ships;
 *                git never commits untracked files, so an unstaged fixture would
 *                test a commit that could not happen.
 * `committed`  → part of the baseline commit (already tracked).
 * `unstaged`   → written but not staged, for the `git commit -a`/`-am` path.
 */
function makeRepo({ files = {}, activePlan, verdicts = {}, committed = {}, unstaged = {}, bindRevision = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate2-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });

  git('init', '-q');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');

  // Mirror the real repo: session-state is transient and gitignored, so
  // `git add .` never stages it. Without this the fixture's own scaffolding
  // reads as untracked ship-capable files and every case blocks.
  write(dir, '.gitignore', 'session-state/\n');

  // Real validators — the check delegates to them rather than re-parsing.
  // Committed as baseline because they are tracked files in a real install.
  copyIn(dir, '.claude/skills/cook/scripts/validate-gate-2.sh');
  copyIn(dir, '.claude/scripts/validate-workflow-evidence.cjs');

  // Baseline commit so HEAD exists and diffs have something to compare against.
  write(dir, 'README.md', '# baseline\n');
  for (const [rel, body] of Object.entries(committed)) write(dir, rel, body);
  git('add', '-A');
  git('commit', '-qm', 'baseline');

  if (activePlan !== undefined) {
    write(dir, 'session-state/active-plan.json', JSON.stringify({ path: activePlan }));
  }
  // The Gate 2 revision binding requires the verdict to name current HEAD. Bind it
  // here so a "passing" fixture actually reaches (and passes) that check; tests that
  // exercise the binding itself pass bindRevision:false and assert the block.
  const head = git('rev-parse', '--short', 'HEAD').toString().trim();
  for (const [name, body] of Object.entries(verdicts)) {
    const withRev = bindRevision && !new RegExp(`\\b${head}`).test(body)
      ? `${body}\nRevision: ${head}\n`
      : body;
    write(dir, `tasks/reviews/${name}`, withRev);
  }

  // Staged changes = what the pending commit would ship.
  for (const [rel, body] of Object.entries(files)) write(dir, rel, body);
  if (Object.keys(files).length > 0) git('add', ...Object.keys(files));

  for (const [rel, body] of Object.entries(unstaged)) write(dir, rel, body);

  return dir;
}

function write(dir, rel, body) {
  const abs = path.join(dir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
}

function copyIn(dir, rel) {
  const src = path.join(PROJECT_ROOT, rel);
  if (!fs.existsSync(src)) return;
  const dst = path.join(dir, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  fs.chmodSync(dst, 0o755);
}

/** Run the check as the hook runs it. Returns {status, stderr, stdout}. */
function runCheck(dir, command, env = {}) {
  const r = spawnSync('sh', [CHECK, command], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir, ...env },
  });
  return { status: r.status, stderr: r.stderr || '', stdout: r.stdout || '' };
}

const PASSING_VERDICT = [
  '# Review Verdict',
  '',
  'Correctness: PASS',
  'Security: PASS',
  'Maintainability: PASS',
  'Performance: PASS',
  'Testing: PASS',
  '',
  'Score: 9/10',
].join('\n');

const FAILING_VERDICT = PASSING_VERDICT.replace('Security: PASS', 'Security: FAIL');

// --- 1. Missing verdict blocks a source commit ------------------------------
test('missing verdict blocks a ship-capable commit with exit 2', () => {
  const dir = makeRepo({
    activePlan: 'tasks/plans/260715-1200-demo',
    files: { 'src/app.ts': 'export const x = 1;\n' },
  });
  const r = runCheck(dir, 'git commit -m "feat: add x"');
  assert.equal(r.status, 2, 'must HARD block (exit 2); exit 1 would let the commit proceed');
  assert.match(r.stderr, /@@GATE_BLOCK@@/);
});

// --- 2. FAIL dimension blocks ----------------------------------------------
test('verdict with a FAIL dimension blocks with exit 2', () => {
  const dir = makeRepo({
    activePlan: 'tasks/plans/260715-1200-demo',
    verdicts: { '260715-demo-verdict.md': FAILING_VERDICT },
    files: { 'src/app.ts': 'export const x = 1;\n' },
  });
  const r = runCheck(dir, 'git commit -m "feat: add x"');
  assert.equal(r.status, 2);
});

// --- 3. Docs-only commit is an explicit N/A, not a block --------------------
test('docs-only commit passes as explicit N/A', () => {
  const dir = makeRepo({
    activePlan: 'tasks/plans/260715-1200-demo',
    files: { 'docs/guide.md': '# guide\n', 'README.md': '# hi\n' },
  });
  const r = runCheck(dir, 'git commit -m "docs: update"');
  assert.equal(r.status, 0, 'docs-only must not be blocked');
  assert.match(r.stdout, /N\/A/, 'must state N/A explicitly rather than skipping silently');
});

// --- 4. Mixed commit (1 source + 9 docs) is ship-capable --------------------
test('mixed commit with a single source file is ship-capable and blocks', () => {
  const files = { 'src/app.ts': 'export const x = 1;\n' };
  for (let i = 0; i < 9; i++) files[`docs/d${i}.md`] = `# doc ${i}\n`;
  const dir = makeRepo({ activePlan: 'tasks/plans/260715-1200-demo', files });
  const r = runCheck(dir, 'git commit -m "chore: mixed"');
  assert.equal(r.status, 2, 'one source file among nine docs still ships code');
});

// --- 5. `git commit -am` (nothing staged at PreToolUse) ---------------------
test('git commit -am with source changes is ship-capable', () => {
  // -a stages at commit time, so at PreToolUse the --cached diff is EMPTY.
  // Without the HEAD fallback this misreads as "no changes" and sails through.
  const dir = makeRepo({
    activePlan: 'tasks/plans/260715-1200-demo',
    committed: { 'src/app.ts': 'export const x = 1;\n' },
    unstaged: { 'src/app.ts': 'export const x = 2;\n' },
  });
  const r = runCheck(dir, 'git commit -am "fix: bump"');
  assert.equal(r.status, 2, 'unstaged source edit must still be seen at PreToolUse time');
});

// --- 5b. `git add . && git commit` — the staging happens AFTER the hook ------
test('git add . && git commit sees a brand-new untracked source file', () => {
  // The whole compound command arrives as one tool call, so at PreToolUse the
  // add has not run yet: nothing is staged and no diff shows an untracked file.
  // A new source file is the most common thing a feature commit adds — if the
  // classifier cannot see it, the gate is decorative for the common case.
  const dir = makeRepo({ activePlan: 'tasks/plans/260715-1200-demo' });
  write(dir, 'src/new-feature.ts', 'export const x = 1;\n'); // untracked, unstaged
  const r = runCheck(dir, 'git add . && git commit -m "feat: new"');
  assert.equal(r.status, 2, 'new untracked source file must not ship ungated');
});

test('git add . && git commit stays N/A for a brand-new docs file', () => {
  // The mirror case: seeing untracked files must not turn every docs commit
  // into a block, or the N/A path is worthless and people disable the hook.
  const dir = makeRepo({ activePlan: 'tasks/plans/260715-1200-demo' });
  write(dir, 'docs/new-guide.md', '# guide\n');
  const r = runCheck(dir, 'git add . && git commit -m "docs: guide"');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /N\/A/);
});

test('plain git commit ignores unrelated untracked files', () => {
  // No `git add` in the command => only the index ships. Untracked scratch must
  // not block an otherwise-clean docs commit, or the check cries wolf.
  const dir = makeRepo({
    activePlan: 'tasks/plans/260715-1200-demo',
    files: { 'docs/guide.md': '# guide\n' },
  });
  write(dir, 'scratch-experiment.ts', 'junk\n'); // untracked, NOT being committed
  const r = runCheck(dir, 'git commit -m "docs: guide"');
  assert.equal(r.status, 0, 'untracked scratch is not part of a plain commit');
});

// --- 6. Fast profile cannot bypass -----------------------------------------
test('MEOW_HOOK_PROFILE=fast still blocks', () => {
  const dir = makeRepo({
    activePlan: 'tasks/plans/260715-1200-demo',
    files: { 'src/app.ts': 'export const x = 1;\n' },
  });
  const r = runCheck(dir, 'git commit -m "feat: x"', { MEOW_HOOK_PROFILE: 'fast' });
  assert.equal(r.status, 2, 'gate-rules.md: Gate 2 has no exceptions, even fast mode');
});

// --- 7. Evidence/verdict disagreement blocks -------------------------------
test('incomplete workflow evidence blocks even with a passing verdict', () => {
  const dir = makeRepo({
    activePlan: 'tasks/plans/260715-1200-demo',
    verdicts: { '260715-demo-verdict.md': PASSING_VERDICT },
    files: { 'src/app.ts': 'export const x = 1;\n' },
  });
  // Present but hollow: the index exists and claims nothing it should carry.
  write(dir, 'tasks/plans/260715-1200-demo/reports/evidence/workflow-evidence.json',
    JSON.stringify({ skill: 'mk:cook', mode: 'auto' }));
  const r = runCheck(dir, 'git commit -m "feat: x"');
  assert.equal(r.status, 2, 'a hollow evidence index must not pass as agreement');
});

// --- 8. Ambiguous verdict resolution fails closed --------------------------
test('two verdicts for one plan slug fail closed', () => {
  const dir = makeRepo({
    activePlan: 'tasks/plans/260715-1200-demo',
    verdicts: {
      '260715-demo-verdict.md': PASSING_VERDICT,
      '260714-demo-verdict.md': PASSING_VERDICT,
    },
    files: { 'src/app.ts': 'export const x = 1;\n' },
  });
  const r = runCheck(dir, 'git commit -m "feat: x"');
  assert.equal(r.status, 2, 'must refuse to guess rather than let one verdict win');
  assert.match(r.stderr, /Ambiguous/);
});

// --- Supporting cases ------------------------------------------------------

test('missing active-plan pointer fails closed on a ship-capable change', () => {
  const dir = makeRepo({ files: { 'src/app.ts': 'export const x = 1;\n' } });
  const r = runCheck(dir, 'git commit -m "feat: x"');
  assert.equal(r.status, 2, 'no pointer means no way to know which verdict applies');
});

test('a passing verdict bound to the shipped revision allows the commit', () => {
  const dir = makeRepo({
    activePlan: 'tasks/plans/260715-1200-demo',
    verdicts: { '260715-demo-verdict.md': PASSING_VERDICT },
    files: { 'src/app.ts': 'export const x = 1;\n' },
    bindRevision: true,
  });
  const r = runCheck(dir, 'git commit -m "feat: x"');
  assert.equal(r.status, 0);
});

// --- Revision binding (anti-accidental) ------------------------------------
test('a passing verdict that names NO revision blocks with exit 2', () => {
  // Without a revision the verdict cannot be tied to the code — a stale verdict
  // from an earlier state would look identical. This is the WARN→BLOCK upgrade.
  const dir = makeRepo({
    activePlan: 'tasks/plans/260715-1200-demo',
    verdicts: { '260715-demo-verdict.md': PASSING_VERDICT },
    files: { 'src/app.ts': 'export const x = 1;\n' },
  });
  const r = runCheck(dir, 'git commit -m "feat: x"');
  assert.equal(r.status, 2, 'a verdict with no revision must not authorize a ship');
  assert.match(r.stderr, /revision under review/);
});

test('a passing verdict naming a DIFFERENT revision blocks with exit 2', () => {
  const dir = makeRepo({
    activePlan: 'tasks/plans/260715-1200-demo',
    verdicts: { '260715-demo-verdict.md': `${PASSING_VERDICT}\nRevision: deadbeef0000\n` },
    files: { 'src/app.ts': 'export const x = 1;\n' },
  });
  const r = runCheck(dir, 'git commit -m "feat: x"');
  assert.equal(r.status, 2, 'a stale revision must not authorize a ship');
  assert.match(r.stderr, /revision under review/);
});

test('a security BLOCK prevents shipping despite a passing reviewer verdict', () => {
  const dir = makeRepo({
    activePlan: 'tasks/plans/260715-1200-demo',
    verdicts: {
      '260715-demo-verdict.md': PASSING_VERDICT,
      '260715-demo-security-verdict.md': [
        '# Security Verdict',
        '',
        '| Rule | Verdict | Evidence |',
        '| --- | --- | --- |',
        '| R7 | FAIL | Prompt injection does not halt |',
      ].join('\n'),
    },
    files: { 'src/app.ts': 'export const x = 1;\n' },
  });
  const r = runCheck(dir, 'git commit -m "feat: add x"');
  assert.equal(r.status, 2, 'a reviewer PASS must not override a security BLOCK');
  assert.match(r.stderr, /Security verdict/);
});

test('a pass never claims the human approved anything', () => {
  const dir = makeRepo({
    activePlan: 'tasks/plans/260715-1200-demo',
    verdicts: { '260715-demo-verdict.md': PASSING_VERDICT },
    files: { 'src/app.ts': 'export const x = 1;\n' },
    bindRevision: true,
  });
  const out = runCheck(dir, 'git commit -m "feat: x"').stdout;
  assert.match(out, /UNPROVEN/, 'the pass must name what it did NOT establish');
  assert.doesNotMatch(out, /human approved|approved by (a )?human/i);
});

test('non-git commands are none of this check\'s business', () => {
  const dir = makeRepo({ files: { 'src/app.ts': 'x\n' } });
  assert.equal(runCheck(dir, 'ls -la').status, 0);
  assert.equal(runCheck(dir, 'npm test').status, 0);
});

test('.claude markdown is ship-capable, unlike other markdown', () => {
  // The `.md`-is-no-ship rule is scoped "outside .claude" — these files ARE the
  // product. A rule that exempted them would exempt the whole kit.
  const dir = makeRepo({
    activePlan: 'tasks/plans/260715-1200-demo',
    files: { '.claude/rules/gate-rules.md': '# rules\n' },
  });
  assert.equal(runCheck(dir, 'git commit -m "chore: rules"').status, 2);
});

test('push with no upstream fails closed rather than guessing the range', () => {
  const dir = makeRepo({ activePlan: 'tasks/plans/260715-1200-demo' });
  const r = runCheck(dir, 'git push');
  assert.equal(r.status, 2, 'an unknown commit range cannot be classified');
});

// --- Wiring: the check must actually be reachable from the live hook --------
// A perfect checker that pre-ship.sh never calls, or calls below the profile
// early-exit, enforces nothing. These assert the wiring, not the checker.

const PRE_SHIP = path.join(PROJECT_ROOT, '.claude/hooks/pre-ship.sh');

test('pre-ship.sh invokes the Gate 2 check ABOVE the fast-profile early-exit', () => {
  const body = fs.readFileSync(PRE_SHIP, 'utf8');
  const checkAt = body.indexOf('gate2-check.sh');
  const fastExitAt = body.indexOf('fast) exit 0');
  assert.ok(checkAt > -1, 'pre-ship.sh no longer calls gate2-check.sh — Gate 2 unenforced');
  assert.ok(fastExitAt > -1, 'fast-profile early-exit vanished — test needs updating');
  assert.ok(
    checkAt < fastExitAt,
    'Gate 2 check sits BELOW the fast-profile exit — MEOW_HOOK_PROFILE=fast would bypass it',
  );
});

test('pre-ship.sh propagates the Gate 2 block as exit 2, not exit 1', () => {
  const body = fs.readFileSync(PRE_SHIP, 'utf8');
  assert.match(
    body,
    /"\$GATE2_CHECK"\s+"\$COMMAND"\s*\|\|\s*exit 2/,
    'must exit 2: exit 1 is advisory and the commit would proceed anyway',
  );
});

test('sourcing a missing hook lib cannot abort the script before Gate 2 runs', () => {
  // `.` is a POSIX special builtin: sourcing a MISSING file kills the shell, and
  // `2>/dev/null || true` does NOT catch it. An aborted hook exits non-2, which
  // is advisory — so a missing lib would silently disable Gate 2 entirely.
  const body = fs.readFileSync(PRE_SHIP, 'utf8');
  const sources = body.split('\n').filter((l) => /^\s*\.\s+"/.test(l));
  assert.ok(sources.length > 0, 'expected pre-ship.sh to source at least one lib');
  for (const line of sources) {
    const idx = body.indexOf(line);
    const preceding = body.slice(Math.max(0, idx - 240), idx);
    assert.match(preceding, /if \[ -f /,
      `unguarded source would abort the hook if the lib is absent: ${line.trim()}`);
  }
});

test('pre-ship.sh FAILS CLOSED (exit 2) on a ship command when the checker is absent', () => {
  // A missing checker at a ship boundary must not silently downgrade to "no Gate 2".
  // Run the real hook with the gate2-check lib deleted from an otherwise-real install.
  const dir = makeRepo({ activePlan: 'tasks/plans/260715-1200-demo', files: { 'src/app.ts': 'export const x = 1;\n' } });
  copyIn(dir, '.claude/hooks/pre-ship.sh');
  copyIn(dir, '.claude/hooks/lib/load-dotenv.sh');
  copyIn(dir, '.claude/hooks/lib/read-hook-input.sh');
  // Deliberately do NOT copy gate2-check.sh — simulate the broken install.
  const r = spawnSync('sh', [path.join(dir, '.claude/hooks/pre-ship.sh'), 'git commit -m "feat: x"'], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
  });
  assert.equal(r.status, 2, 'a ship with no enforceable Gate 2 must be blocked, not waved through');
  assert.match(r.stderr, /cannot be enforced|@@GATE_BLOCK@@/);
});

test('end-to-end: pre-ship.sh blocks a ship-capable commit under the fast profile', () => {
  // The full live path — hook entrypoint, not the helper in isolation.
  const dir = makeRepo({
    activePlan: 'tasks/plans/260715-1200-demo',
    files: { 'src/app.ts': 'export const x = 1;\n' },
  });
  copyIn(dir, '.claude/hooks/pre-ship.sh');
  copyIn(dir, '.claude/hooks/lib/gate2-check.sh');
  // A real install has these; without them the hook would abort at its own
  // source lines and never reach the gate.
  copyIn(dir, '.claude/hooks/lib/load-dotenv.sh');
  copyIn(dir, '.claude/hooks/lib/read-hook-input.sh');
  const r = spawnSync('sh', [path.join(dir, '.claude/hooks/pre-ship.sh'), 'git commit -m "feat: x"'], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir, MEOW_HOOK_PROFILE: 'fast' },
  });
  assert.equal(r.status, 2, 'fast profile must not bypass Gate 2 through the real hook');
});
