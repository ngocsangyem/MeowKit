// workflow-config-parity.test.ts — the node config CLI must answer exactly what
// the bash+Python one it replaces answered, except where a decision changed the
// answer on purpose.
//
// Every fixture was recorded by running the old implementation. The replay runs
// with an EMPTY PATH, so the `python3` the recorded implementation shelled out
// to twice is not reachable at all.
//
// THREE divergences, all deliberate, all listed by name rather than normalized
// away in silence:
//
//   1. The SEED MOVED (every fixture whose setup writes one).
//      The recorded implementation both read and WROTE one runtime JSON file.
//      The project config is now committed, human-owned and a closed key
//      surface, so the reader resolves session state -> project config -> user
//      config -> default, and the fixtures seed session state. stdout, stderr
//      and the exit status are compared whole and unchanged: the same questions
//      of the same data give the same answers. The recorded side-effect path is
//      asserted ABSENT — nothing reads or writes it any more — and the state
//      file is asserted instead.
//
//   2. `set` WRITES SESSION STATE (the six `config-set-*` fixtures).
//      A committed file an agent rewrites mid-run puts a settings change into
//      the user's diff, which is also how a weakening reaches a pull request.
//      So `set` writes `.meowkit/state/workflow-state.json`. Values, types,
//      nesting, the two-space indentation and the missing trailing newline are
//      all compared against the recording; only the file differs.
//
//   3. `config-set-no-config` now EXITS 0 instead of 1.
//      The recorded refusal existed so that recording telemetry could not
//      conjure a config file the user never chose. Session state is kit-owned
//      and creating it IS the write, so refusing would leave `set` with nothing
//      it could ever do on a fresh project. This is the one fixture whose
//      decision changed, and it is the only one.
//
// `set` also gained two stderr lines naming where it wrote and where the same
// preference becomes durable, so stderr is compared for the `get`/`has`/usage
// fixtures and asserted by content for `set`.


import { describe, expect, it } from 'vitest';

import { loadFixtures, replay } from './lib/port-replay-harness';

const LEGACY_REL = '.claude/meowkit.config.json';
const STATE_REL = '.meowkit/state/workflow-state.json';

const fixtures = loadFixtures().filter((f) => f.group === 'workflow-config');

/** Divergence 3 — the one fixture whose decision changed. */
const CREATES_STATE = 'config-set-no-config';

const isSet = (args: readonly string[]): boolean => args[0] === 'set';

describe('workflow-config — recorded parity', () => {
	it('covers get, has and set', () => {
		for (const sub of ['get', 'has', 'set']) {
			expect(fixtures.some((f) => f.invocation.kind === 'config' && f.invocation.args[0] === sub)).toBe(true);
		}
	});

	for (const fixture of fixtures) {
		it(`${fixture.name} — ${fixture.setupDescription}`, () => {
			const got = replay(fixture, [STATE_REL]);
			const expected = fixture.expect;
			const args = fixture.invocation.kind === 'config' ? fixture.invocation.args : [];

			expect(got.stdout).toBe(expected.stdout);
			expect(got.exit).toBe(fixture.name === CREATES_STATE ? 0 : expected.exit);
			expect(got.signal).toBe(expected.signal);

			if (isSet(args)) {
				// Divergence 2: the write target is named, and the message points
				// at the committed file a durable choice belongs in.
				expect(got.stderr).toContain(STATE_REL);
				expect(got.stderr).toContain('session state');
				expect(got.stderr).toContain('.meowkit/config.yaml');
				expect(got.stderr).not.toContain('at Object.<anonymous>');
			} else {
				expect(got.stderr).toBe(expected.stderr);
			}

			// Divergence 1: the recorded path is dead, and the state file carries
			// what the recording carried.
			expect(got.sideEffects[LEGACY_REL]).toBe(null);
			const recorded = expected.stdout === '' ? null : expected.stdout;
			if (isSet(args)) {
				const state: unknown = JSON.parse(got.sideEffects[STATE_REL] ?? 'null');
				expect(state).not.toBe(null);
				expect(got.sideEffects[STATE_REL]?.endsWith('\n')).toBe(false);
				expect(got.sideEffects[STATE_REL]).toContain('\n  "');
			} else if (recorded !== null && fixture.sideEffects[LEGACY_REL] !== null) {
				// A get/has fixture must leave its source untouched: a reader
				// that rewrote what it read would be the previous design.
				expect(got.sideEffects[STATE_REL]).toBe(fixture.sideEffects[LEGACY_REL]);
			}
		});
	}

	it('the set fixtures write the values, types and nesting the recording holds', () => {
		for (const fixture of fixtures.filter((f) => f.invocation.kind === 'config' && isSet(f.invocation.args))) {
			const got = replay(fixture, [STATE_REL]);
			const state = JSON.parse(got.sideEffects[STATE_REL] ?? 'null') as Record<string, unknown>;
			const args = fixture.invocation.kind === 'config' ? fixture.invocation.args : [];
			const [, key, raw] = args;
			const recordedFile = fixture.sideEffects[LEGACY_REL];
			if (recordedFile === null || recordedFile === undefined) {
				// The fresh-project leg: only the key just set is there.
				expect(state).toEqual({ [key as string]: raw === 'true' ? true : raw });
				continue;
			}
			const recorded = JSON.parse(recordedFile) as Record<string, unknown>;
			expect(state).toEqual(recorded);
		}
	});
});
