// port-replay-harness.ts — run a recorded fixture against the node ports.
//
// The fixture stores a setup *id* and an abstract invocation, not a command
// line, so both come from the same committed case modules the recorder used.
// Reusing them is the point: if the replay built its own tree, a divergence
// between the two trees would read as a behavior difference in the code under
// test.
//
// Nothing here spawns a shell or an interpreter. The entrypoint is this node
// binary running a `.cjs` file, which is the whole claim being tested.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require_ = createRequire(import.meta.url);

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '../../..');
export const GOLDEN_DIR = path.join(REPO_ROOT, 'tests/ports/golden');

/**
 * The kit directories a port under test reaches into. `.claude/hooks/lib` is
 * here because the config reader lives there: the dependency-free YAML subset
 * reader and the key rules are one implementation, and a second copy under
 * `scripts/` would be a second answer to "what does this config say".
 */
const TREE = ['.claude/hooks/lib', '.claude/hooks/handlers.json'];

export type Invocation = { kind: 'scan-dir'; args: string[] } | { kind: 'scan-one'; target: string } | { kind: 'config'; args: string[] };

export interface Fixture {
	name: string;
	group: string;
	invocation: Invocation;
	setup: string;
	setupDescription: string;
	normalizers: string[];
	expect: { exit: number; signal: string | null; stdout: string; stderr: string };
	sideEffects: Record<string, string | null>;
}

interface CorpusCase {
	name: string;
	setup: (ctx: { projectDir: string; caseRoot: string; home: string }) => void;
}

const CASE_MODULES = [
	'port-corpus-cases-injection-audit',
	'port-corpus-cases-injection-audit-paths',
	'port-corpus-cases-workflow-config',
];

function isCorpusCase(value: unknown): value is CorpusCase {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	return typeof v.name === 'string' && typeof v.setup === 'function';
}

function loadCases(): CorpusCase[] {
	const out: CorpusCase[] = [];
	for (const mod of CASE_MODULES) {
		const loaded: unknown = require_(path.join(REPO_ROOT, 'scripts/lib', `${mod}.cjs`));
		if (!Array.isArray(loaded)) throw new Error(`${mod}.cjs did not export an array of cases`);
		for (const entry of loaded) {
			if (!isCorpusCase(entry)) throw new Error(`${mod}.cjs exported an entry with no name or setup`);
			out.push(entry);
		}
	}
	return out;
}

const CASES = loadCases();

function caseFor(name: string): CorpusCase {
	const found = CASES.find((c) => c.name === name);
	if (!found) throw new Error(`no committed case definition for fixture: ${name}`);
	return found;
}

export function loadFixtures(): Fixture[] {
	return fs
		.readdirSync(GOLDEN_DIR)
		.filter((f) => f.endsWith('.json') && f !== 'index.json')
		.sort()
		.map((f) => JSON.parse(fs.readFileSync(path.join(GOLDEN_DIR, f), 'utf8')) as Fixture);
}

/**
 * The recorder's pinned environment, minus PATH.
 *
 * PATH is replaced with a directory that is EMPTY on purpose: the ports must
 * work where no interpreter exists, so the replay removes every interpreter
 * from reach rather than trusting that none is called. `process.execPath` is an
 * absolute path, so node itself still starts.
 */
function replayEnv(home: string, emptyBin: string): Record<string, string> {
	const mod: unknown = require_(path.join(REPO_ROOT, 'scripts/lib/hook-corpus-env.cjs'));
	const fn = (mod as Record<string, unknown>).pinnedEnv;
	if (typeof fn !== 'function') throw new Error('hook-corpus-env.cjs exports no pinnedEnv');
	const base = (fn as (h: string) => Record<string, string>)(home);
	return { ...base, PATH: emptyBin };
}

/** Map an abstract invocation onto the node implementation. */
function commandFor(projectDir: string, invocation: Invocation): string[] {
	if (invocation.kind === 'config') return [path.join(projectDir, '.claude/hooks/lib/workflow-config'), ...invocation.args];
	const auditor = path.join(projectDir, '.claude/hooks/lib/injection-audit.cjs');
	if (invocation.kind === 'scan-dir') return [auditor, ...invocation.args];
	return [auditor, '--file', invocation.target];
}

function applyNormalizers(text: string, names: string[], ctx: { projectDir: string; home: string }): string {
	let out = text;
	for (const name of names) {
		if (name === 'tmpdir') out = out.split(ctx.projectDir).join('{{TMP}}');
		else if (name === 'homedir') out = out.split(ctx.home).join('{{HOME}}');
		else if (name === 'logStamp') out = out.replace(/\d{6}-\d{6}/g, '{{STAMP}}');
		else throw new Error(`unknown normalizer: ${name}`);
	}
	return out;
}

export interface Replayed {
	exit: number;
	signal: string | null;
	stdout: string;
	stderr: string;
	sideEffects: Record<string, string | null>;
}

/**
 * Build this fixture's tree, run the node port, and return normalized streams.
 *
 * `extraPaths` reads files the recording does not name. A port that writes
 * somewhere new has to be asserted somewhere, and a caller that can only read
 * the recorded paths would have to take the new one on trust.
 */
export function replay(fixture: Fixture, extraPaths: readonly string[] = []): Replayed {
	const caseRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-portreplay-'));
	const projectDir = path.join(caseRoot, 'project');
	const home = path.join(projectDir, 'home');
	const emptyBin = path.join(caseRoot, 'empty-bin');
	fs.mkdirSync(home, { recursive: true });
	fs.mkdirSync(emptyBin, { recursive: true });
	for (const rel of TREE) {
		fs.mkdirSync(path.dirname(path.join(projectDir, rel)), { recursive: true });
		fs.cpSync(path.join(REPO_ROOT, rel), path.join(projectDir, rel), { recursive: true });
	}

	const ctx = { projectDir, caseRoot, home };
	caseFor(fixture.setup).setup(ctx);

	const [script, ...args] = commandFor(projectDir, fixture.invocation);
	const result = spawnSync(process.execPath, [script, ...args], {
		cwd: projectDir,
		input: '',
		env: replayEnv(home, emptyBin),
		encoding: 'utf8',
		maxBuffer: 32 * 1024 * 1024,
	});

	const norm = (v: string | null) => applyNormalizers(v ?? '', fixture.normalizers, ctx);
	const sideEffects: Record<string, string | null> = {};
	for (const rel of [...Object.keys(fixture.sideEffects), ...extraPaths]) {
		try {
			sideEffects[rel] = norm(fs.readFileSync(path.join(projectDir, rel), 'utf8'));
		} catch {
			sideEffects[rel] = null;
		}
	}

	fs.rmSync(caseRoot, { recursive: true, force: true });

	return {
		exit: result.status === null ? -1 : result.status,
		signal: result.signal ?? null,
		stdout: norm(result.stdout),
		stderr: norm(result.stderr),
		sideEffects,
	};
}
