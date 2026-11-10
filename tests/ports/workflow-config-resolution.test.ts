// The levels the recorded fixtures cannot reach.
//
// A fixture can only pin behaviour its subject had, and the recorded subject
// read ONE open-keyed runtime file. The committed project config and the user
// config are new levels, so they are asserted against the library directly —
// the same shape as the canonical-leg test the previous port left behind.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require_ = createRequire(import.meta.url);

const CORE_REL = '.claude/hooks/lib/workflow-config-core.cjs';
const STATE_REL = '.meowkit/state/workflow-state.json';

interface ConfigCore {
	CONFIG_ALIASES: Record<string, string>;
	configKeyFor: (key: string) => string;
	resolveKey: (key: string, options: { root: string; home: string; env?: NodeJS.ProcessEnv }) => { value: unknown; level: string; sourcePresent: boolean };
	statePath: (root: string) => string;
}

function loadCore(): ConfigCore {
	const loaded: unknown = require_(path.resolve(CORE_REL));
	if (typeof loaded !== 'object' || loaded === null) throw new Error(`${CORE_REL} did not export an object`);
	const mod = loaded as Record<string, unknown>;
	for (const name of ['CONFIG_ALIASES', 'configKeyFor', 'resolveKey', 'statePath']) {
		if (!(name in mod)) throw new Error(`${CORE_REL} exports no ${name}`);
	}
	return mod as unknown as ConfigCore;
}

describe('workflow-config — the resolution change', () => {
	// The fixtures can only exercise the state leg, because an open-keyed
	// runtime file is the only source the recorded subject ever had. The config
	// levels are asserted here against the library directly.
	const core = loadCore();

	function project(): { root: string; home: string } {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-wfcfg-'));
		const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-wfhome-'));
		fs.cpSync(path.resolve('.claude/hooks/handlers.json'), path.join(root, '.claude/hooks/handlers.json'), { recursive: true, force: true, errorOnExist: false, dereference: true, mode: 0 });
		return { root, home };
	}

	function write(file: string, body: string): void {
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, body);
	}

	it('resolves state over project over user over default', () => {
		const { root, home } = project();
		write(path.join(home, '.meowkit/config.yaml'), 'workflow:\n  telemetry: anonymous\n');
		expect(core.resolveKey('telemetry', { root, home })).toMatchObject({ value: 'anonymous', level: 'user' });

		write(path.join(root, '.meowkit/config.yaml'), 'workflow:\n  telemetry: community\n');
		expect(core.resolveKey('telemetry', { root, home })).toMatchObject({ value: 'community', level: 'project' });

		write(path.join(root, STATE_REL), '{"telemetry":"off"}');
		expect(core.resolveKey('telemetry', { root, home })).toMatchObject({ value: 'off', level: 'state' });

		expect(core.resolveKey('nothing.set.here', { root, home })).toMatchObject({ level: 'default', sourcePresent: true });
		fs.rmSync(root, { recursive: true, force: true });
		fs.rmSync(home, { recursive: true, force: true });
	});

	it('answers from the config even for a key the preambles spell the old way', () => {
		const { root, home } = project();
		write(path.join(root, '.meowkit/config.yaml'), 'workflow:\n  proactive: false\n');
		expect(core.resolveKey('proactive', { root, home })).toMatchObject({ value: false, level: 'project' });
		fs.rmSync(root, { recursive: true, force: true });
		fs.rmSync(home, { recursive: true, force: true });
	});

	it('every alias target is a real config key, so an alias cannot outlive its key', () => {
		const keys: unknown = require_(path.resolve('.claude/hooks/lib/config-keys.cjs'));
		const scalars = (keys as { SCALAR_KEYS: Record<string, unknown> }).SCALAR_KEYS;
		for (const target of Object.values(core.CONFIG_ALIASES)) {
			expect(Object.keys(scalars)).toContain(target);
		}
	});

	it('an invalid project config leaves the reader answering rather than throwing', () => {
		const { root, home } = project();
		write(path.join(root, '.meowkit/config.yaml'), 'workflow:\n\ttelemetry: off\n');
		expect(core.resolveKey('telemetry', { root, home })).toMatchObject({ level: 'default', sourcePresent: true });
		fs.rmSync(root, { recursive: true, force: true });
		fs.rmSync(home, { recursive: true, force: true });
	});

	it('reads neither environment override, because both are gone', () => {
		// Two variables used to point this at another file. Neither was set
		// anywhere in the tree, and a second way to aim a config reader is a
		// second way for two callers to disagree about what the config says.
		const source = fs.readFileSync(CORE_REL, 'utf8');
		expect(source).not.toContain('WORKFLOW_CONFIG');
		expect(source).not.toContain('MEOWKIT_CONFIG');
	});

	it('names the committed config nowhere as a write target', () => {
		const source = fs.readFileSync(CORE_REL, 'utf8');
		expect(source).not.toContain('config.json');
		expect(source).toContain('workflow-state.json');
	});
});
