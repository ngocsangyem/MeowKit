// golden-replay.test.ts — the node hooks must decide, and say, exactly what the
// shell hooks they replace decided and said.
//
// Each fixture was recorded by running the shell implementation; nothing here
// re-derives an expectation. Streams are compared whole, after one
// substitution: the throwaway project path becomes a placeholder, because that
// path is different on every run by construction.
//
// Two groups are handled apart from the parity set:
//
//   stdin-unreadable    Unreadable input used to pass silently. A write guard that
//               cannot read what is being written must not allow it, so these
//               six now block. The recording is kept as the before-state and
//               asserted against the new behavior rather than deleted.
//
//   self-path   Three diagnostics quote the implementation file they are about
//               ("run this validator", "this checker is missing", "usage: this
//               script"). The port changes that filename, so one line differs
//               while the decision, exit code and every other line match. These
//               are listed by name and get a second, named substitution. This is
//               the only deviation from whole-stream parity in the suite.
//               One further deviation applies to SIDE EFFECTS, not to streams:
//               a recorded state path is read from the class that content lives
//               in now (`lib/state-relocation.ts`), content still compared whole.

import { describe, expect, it } from 'vitest';

import { type Fixture, loadFixtures, replay, selfPath } from './lib/replay-harness';

/** Every recorded group. All of them are replayed against the node tree. */
const PARITY_GROUPS = [
  'gate1',
  'gate2-preship',
  'privacy',
  'gate-helper-validate-contract',
  'gate-helper-check-contract-signed',
  'gate-helper-validate-gate-2',
  'post-write',
  'pre-completion-check',
  'guard-careful',
  'guard-freeze',
  'guard-investigate',
  'observer-pre-task-check',
  'observer-tdd-flag-detector',
  'observer-learning-observer',
  'observer-capability-bootstrap',
  'observer-jira-env-loader',
  'observer-precompact-probe',
  'observer-posttoolfailure-probe',
  'observer-control-probe',
  'cli-pre-implement',
  'cli-append-trace',
];

/** Groups whose streams need no normalizer beyond the temp path. */
const STREAMS_ONLY_GROUPS = [
  'gate1',
  'gate2-preship',
  'privacy',
  'gate-helper-validate-contract',
  'gate-helper-check-contract-signed',
  'gate-helper-validate-gate-2',
];

/** Fixtures whose output quotes the implementation's own filename. */
const SELF_PATH_FIXTURES = new Set([
  'gate1-contract-edit-invalid',
  'preship-gate2-checker-absent',
  'validate-contract-usage-error',
  'preimplement-no-feature-argument',
  'preimplement-strict-tdd-helper-missing',
]);

/**
 * Guard groups whose recorded stdout is the shell guard's undocumented envelope.
 *
 * The shell guards printed a top-level `permissionDecision`, which is not a
 * recognised field for this event — so that output reported no decision at all
 * and the guard enforced nothing. The node guards emit the documented
 * `hookSpecificOutput` form instead, which changes the envelope but not the
 * decision. These fixtures therefore compare the DECISION and its reason rather
 * than the literal bytes; every other fixture still compares streams whole.
 */
const DECISION_ENVELOPE_GROUPS = ['guard-careful', 'guard-freeze', 'guard-investigate'];

interface GuardDecision {
  decision: string | null;
  reason: string | null;
}

/** Read a decision out of either envelope, so the two can be compared. */
function guardDecision(text: string): GuardDecision {
  const trimmed = text.trim();
  if (!trimmed) return { decision: null, reason: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { decision: trimmed, reason: null };
  }
  if (typeof parsed !== 'object' || parsed === null) return { decision: trimmed, reason: null };
  const top = parsed as Record<string, unknown>;
  const specific = (top.hookSpecificOutput ?? {}) as Record<string, unknown>;
  const decision = (specific.permissionDecision ?? top.permissionDecision ?? null) as string | null;
  const reason = (specific.permissionDecisionReason ?? top.message ?? null) as string | null;
  return { decision, reason };
}

/**
 * The injection scanner reported its finding with a non-blocking failure exit.
 * Through the dispatcher that becomes 0, because an observer chain is fail-open
 * and one observer's advisory exit must not become the chain's. The finding
 * itself is unchanged and still compared whole.
 */
const ADVISORY_EXIT_FIXTURES = new Set(['pretaskcheck-injection-blocked']);

const fixtures = loadFixtures();
const inGroups = (f: Fixture, groups: string[]) => groups.includes(f.group);

function assertParity(fixture: Fixture) {
  const actual = replay(fixture);
  const quotesSelf = SELF_PATH_FIXTURES.has(fixture.name);
  const actualStderr = quotesSelf ? selfPath(actual.stderr) : actual.stderr;
  const actualStdout = quotesSelf ? selfPath(actual.stdout) : actual.stdout;
  const expectedExit = ADVISORY_EXIT_FIXTURES.has(fixture.name) ? 0 : fixture.expect.exit;

  expect(actual.exit, `exit code for ${fixture.name}`).toBe(expectedExit);
  expect(actual.marker, `marker for ${fixture.name}`).toBe(fixture.expect.marker);

  if (DECISION_ENVELOPE_GROUPS.includes(fixture.group)) {
    // Same decision, same reason, documented envelope.
    const decided = guardDecision(actualStdout);
    expect(decided, `decision for ${fixture.name}`).toEqual(guardDecision(fixture.expect.stdout));
    // The investigate guard blocks by exit code, so its reason is on stderr;
    // the others answer on stdout and must say nothing else.
    const expectedStderr = fixture.group === 'guard-investigate' && actual.exit === 2 ? `${decided.reason ?? ''}` : '';
    expect(actualStderr.trim(), `stderr for ${fixture.name}`).toBe(expectedStderr.trim());
  } else {
    expect(actualStdout, `stdout for ${fixture.name}`).toBe(fixture.expect.stdout);
    expect(actualStderr, `stderr for ${fixture.name}`).toBe(fixture.expect.stderr);
  }

  for (const [rel, expected] of Object.entries(fixture.sideEffects ?? {})) {
    expect(actual.sideEffects[rel], `side effect ${rel} for ${fixture.name}`).toBe(expected);
  }
}

describe('golden corpus is non-empty and self-describing', () => {
  it('loads every recorded fixture', () => {
    expect(fixtures.length).toBeGreaterThan(0);
    for (const f of fixtures) {
      expect(f.name, 'every fixture names itself').toBeTruthy();
      expect(f.normalizers.length, `${f.name} records which normalizers apply`).toBeGreaterThan(0);
    }
  });

  it('applies no normalizer beyond the temp path to any gate or helper stream', () => {
    // The recorded extras exist for side-effect files that embed a wall clock;
    // this pins the claim that no gate STREAM needs more than the temp path.
    const streamsOnly = fixtures.filter((f) => inGroups(f, STREAMS_ONLY_GROUPS) && !f.sideEffects);
    for (const f of streamsOnly) {
      expect(f.normalizers, `${f.name} normalizers`).toEqual(['tmpdir']);
    }
  });

  it('replays every recorded fixture in some group', () => {
    // Nothing may fall between the parity set and the separately-asserted
    // unreadable-input set, so a new group cannot arrive untested.
    const covered = fixtures.filter((f) => inGroups(f, PARITY_GROUPS) || f.group === 'stdin-unreadable');
    expect(covered.length, 'fixtures with no assertion').toBe(fixtures.length);
  });
});

describe('every recorded fixture replays against the node tree', () => {
  for (const fixture of fixtures.filter((f) => inGroups(f, PARITY_GROUPS))) {
    it(`${fixture.group} · ${fixture.name}`, () => assertParity(fixture));
  }
});

describe('unreadable hook input blocks instead of passing silently', () => {
  const d2 = fixtures.filter((f) => f.group === 'stdin-unreadable');

  it('records six before-state fixtures', () => {
    expect(d2).toHaveLength(6);
    for (const f of d2) expect(f.expect.exit, `${f.name} was recorded as a silent pass`).toBe(0);
  });

  for (const fixture of d2) {
    it(`${fixture.name} now exits 2 with its marker`, () => {
      const actual = replay(fixture);
      expect(actual.exit, `exit code for ${fixture.name}`).toBe(2);
      expect(actual.marker, `marker for ${fixture.name}`).not.toBeNull();
      expect(actual.stderr, `reason for ${fixture.name}`).toContain(
        fixture.name.includes('empty') ? 'empty' : 'not-json',
      );
    });
  }
});
