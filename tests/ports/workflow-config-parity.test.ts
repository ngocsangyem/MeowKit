// workflow-config-parity.test.ts — the node config CLI must answer exactly what
// the bash+Python one it replaces answered.
//
// Every fixture was recorded by running the old implementation. The replay runs
// with an EMPTY PATH, so the `python3` the recorded implementation shelled out
// to twice is not reachable at all.
//
// ONE fixture diverges, by design, and it is listed by name rather than
// normalized away in silence:
//
//   config-set-no-config   The diagnostic names the config file it could not
//                          find. The old implementation only knew the pre-move
//                          location; this one resolves canonical-first, so when
//                          NO config exists it names the path it would create.
//                          The decision, the exit status and stdout are
//                          identical — one filename in one stderr line differs,
//                          and it differs in the direction the resolver change
//                          intends.
//
// Everything else is compared whole.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

import { loadFixtures, replay } from './lib/port-replay-harness';

const require_ = createRequire(import.meta.url);

const CORE_REL = '.claude/scripts/lib/workflow-config-core.cjs';

interface ConfigCore {
	resolveConfigPath: (root?: string) => string;
}

function loadCore(): ConfigCore {
	const loaded: unknown = require_(path.resolve(CORE_REL));
	if (typeof loaded !== 'object' || loaded === null) throw new Error(`${CORE_REL} did not export an object`);
	const fn = (loaded as Record<string, unknown>).resolveConfigPath;
	if (typeof fn !== 'function') throw new Error(`${CORE_REL} exports no resolveConfigPath`);
	return { resolveConfigPath: fn as ConfigCore['resolveConfigPath'] };
}

const fixtures = loadFixtures().filter((f) => f.group === 'workflow-config');

/** The fixture whose stderr quotes the resolved config path. */
const RESOLVED_PATH_FIXTURES = new Set(['config-set-no-config']);

const CANONICAL = '.meowkit/config.json';
const LEGACY = '.claude/meowkit.config.json';

/** Collapse whichever config path a message names, for the listed fixtures only. */
function collapseConfigPath(text: string): string {
	return text.split(CANONICAL).join('{{CONFIG}}').split(LEGACY).join('{{CONFIG}}');
}

describe('workflow-config — recorded parity', () => {
	it('covers get, has and set', () => {
		for (const sub of ['get', 'has', 'set']) {
			expect(fixtures.some((f) => f.invocation.kind === 'config' && f.invocation.args[0] === sub)).toBe(true);
		}
	});

	for (const fixture of fixtures) {
		it(`${fixture.name} — ${fixture.setupDescription}`, () => {
			const got = replay(fixture);
			const expected = fixture.expect;
			const lenient = RESOLVED_PATH_FIXTURES.has(fixture.name);

			expect(got.stdout).toBe(expected.stdout);
			expect(lenient ? collapseConfigPath(got.stderr) : got.stderr).toBe(lenient ? collapseConfigPath(expected.stderr) : expected.stderr);
			expect(got.exit).toBe(expected.exit);
			expect(got.signal).toBe(expected.signal);
			expect(got.sideEffects).toEqual(fixture.sideEffects);
		});
	}
});

describe('workflow-config — the resolver change', () => {
	// The fixtures can only exercise the fallback leg, because the pre-move
	// location is the only one their subject ever read. The canonical leg is
	// asserted here against the library directly.
	const core = loadCore();

	it('prefers the canonical path when both exist', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-cfg-'));

		fs.mkdirSync(path.join(root, '.meowkit'), { recursive: true });
		fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
		fs.writeFileSync(path.join(root, '.meowkit/config.json'), '{"who":"canonical"}');
		fs.writeFileSync(path.join(root, '.claude/meowkit.config.json'), '{"who":"legacy"}');
		expect(core.resolveConfigPath(root)).toBe(path.join(root, '.meowkit/config.json'));

		fs.rmSync(path.join(root, '.meowkit/config.json'));
		expect(core.resolveConfigPath(root)).toBe(path.join(root, '.claude/meowkit.config.json'));

		fs.rmSync(path.join(root, '.claude/meowkit.config.json'));
		expect(core.resolveConfigPath(root)).toBe(path.join(root, '.meowkit/config.json'));

		fs.rmSync(root, { recursive: true, force: true });
	});

	it('reads neither environment override, because both are gone', () => {
		// Two variables used to point this at another file. Neither was set
		// anywhere in the tree, and a second way to aim a config reader is a
		// second way for two callers to disagree about what the config says.
		const source = fs.readFileSync(CORE_REL, 'utf8');
		expect(source).not.toContain('WORKFLOW_CONFIG');
		expect(source).not.toContain('MEOWKIT_CONFIG');
	});
});
