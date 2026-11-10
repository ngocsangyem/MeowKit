// injection-audit-parity.test.ts — the node audit scanner must decide, and say,
// exactly what the Python scanner it replaces decided and said.
//
// Every fixture was recorded by running the Python implementation; nothing here
// re-derives an expectation. Streams are compared whole, after one
// substitution — the throwaway project path, which is different on every run by
// construction — plus the security log's wall-clock stamp where a case writes
// one.
//
// The replay runs with an EMPTY PATH, so no interpreter is reachable. A port
// that still worked by shelling out to `python3` would fail here, which is the
// only way to test the claim that matters.

import { describe, expect, it } from 'vitest';

import { type Fixture, loadFixtures, replay } from './lib/port-replay-harness';

const fixtures = loadFixtures().filter((f) => f.group === 'injection-audit');

/** Severity classes the corpus must cover, so a thinned corpus fails loudly. */
const REQUIRED_COVERAGE: Array<[string, (f: Fixture) => boolean]> = [
	['a CRITICAL directory scan', (f) => f.invocation.kind === 'scan-dir' && f.expect.stdout.includes('CRITICAL: 1')],
	['a SUSPICIOUS directory scan', (f) => f.invocation.kind === 'scan-dir' && f.expect.stdout.includes('SUSPICIOUS: 1')],
	['a clean directory scan', (f) => f.expect.stdout.includes('CLEAN — no injection indicators found.')],
	['the kit-directory skip', (f) => f.setup === 'audit-kit-directory-skipped'],
	['a path outside the project root', (f) => f.expect.stdout.includes('BOUNDARY_VIOLATION')],
	['a directory invocation', (f) => f.invocation.kind === 'scan-dir'],
	['a single-path invocation', (f) => f.invocation.kind === 'scan-one'],
];

describe('injection-audit — recorded parity', () => {
	it('records at least 8 fixtures', () => {
		expect(fixtures.length).toBeGreaterThanOrEqual(8);
	});

	for (const [label, predicate] of REQUIRED_COVERAGE) {
		it(`covers ${label}`, () => {
			expect(fixtures.some(predicate), `no fixture covers ${label}`).toBe(true);
		});
	}

	for (const fixture of fixtures) {
		it(`${fixture.name} — ${fixture.setupDescription}`, () => {
			const got = replay(fixture);
			expect(got.stdout).toBe(fixture.expect.stdout);
			expect(got.stderr).toBe(fixture.expect.stderr);
			expect(got.exit).toBe(fixture.expect.exit);
			expect(got.signal).toBe(fixture.expect.signal);
			expect(got.sideEffects).toEqual(fixture.sideEffects);
		});
	}
});

describe('injection-audit — the security log', () => {
	const LOG = '.meowkit/telemetry/security-log.md';

	it('writes an entry for a critical finding and none for a clean scan', () => {
		const critical = fixtures.find((f) => f.name === 'audit-critical-identity-override');
		const clean = fixtures.find((f) => f.name === 'audit-clean-tree');
		if (!critical || !clean) throw new Error('the two log fixtures are missing from the corpus');

		expect(replay(critical).sideEffects[LOG]).toContain('[CRITICAL]');
		expect(replay(clean).sideEffects[LOG]).toBeNull();
	});

	it('never records a finding to the memory store', () => {
		// A description quotes the payload that matched, and the memory files are
		// committed and read back as DATA. The log destination is therefore part
		// of the safety property, not an implementation detail.
		for (const fixture of fixtures) {
			for (const rel of Object.keys(fixture.sideEffects)) {
				expect(rel.startsWith('.meowkit/memory/')).toBe(false);
			}
		}
	});
});
