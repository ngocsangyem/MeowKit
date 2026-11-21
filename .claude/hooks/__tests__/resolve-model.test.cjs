// The resolution order for "which model is this session running?".
//
// The order is the point: the detection artifact is canonical and the
// environment is the LAST place to look, because the host does not export a
// model identifier to end-of-session hooks. An environment variable that could
// override a real artifact value would let a stale shell export rewrite what
// every record written afterwards claims the session ran on.
//
// The artifact is also writable by any process with filesystem access and its
// value flows into log records and text substitution, so the sanitiser is
// asserted on a value carrying shell metacharacters rather than on a clean one.
//
// Run with: node --test .claude/hooks/__tests__/

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { resolveModel, UNKNOWN } = require('../lib/resolve-model.cjs');

/** A throwaway project root, optionally carrying a detection artifact. */
function projectWith(artifactBody) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'resolve-model-'));
	if (artifactBody !== undefined) {
		const dir = path.join(root, '.meowkit', 'state');
		fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(path.join(dir, 'detected-model.json'), artifactBody);
	}
	return root;
}

/** Resolve against an explicit env, so the ambient one cannot decide a case. */
function resolve(root, env = {}) {
	return resolveModel({ root, env, warn: () => {} });
}

test('a well-formed artifact answers the question', () => {
	const root = projectWith('{"model_id":"claude-sonnet-4-6","tier":"STANDARD","density":"FULL"}');
	assert.equal(resolve(root), 'claude-sonnet-4-6');
});

test('the artifact wins over an environment hint', () => {
	const root = projectWith('{"model_id":"claude-sonnet-4-6"}');
	assert.equal(resolve(root, { MEOWKIT_MODEL_HINT: 'opus-4-7' }), 'claude-sonnet-4-6');
});

test('an absent artifact falls back to the environment hint', () => {
	const root = projectWith(undefined);
	assert.equal(resolve(root, { MEOWKIT_MODEL_HINT: 'opus-4-7' }), 'opus-4-7');
});

test('an absent artifact with no hint resolves to unknown', () => {
	const root = projectWith(undefined);
	assert.equal(resolve(root), UNKNOWN);
});

test('a partially written artifact is salvaged by reading the field textually', () => {
	// A truncated write is the realistic failure, not a random string: the
	// identifier is present and JSON.parse still throws.
	const root = projectWith('{"model_id":"claude-haiku-4-5","tier":');
	assert.equal(resolve(root), 'claude-haiku-4-5');
});

test('an artifact with no recoverable identifier resolves to unknown', () => {
	const root = projectWith('{ this is not json');
	assert.equal(resolve(root), UNKNOWN);
});

test('a literal unknown in the artifact falls through to the environment hint', () => {
	const root = projectWith('{"model_id":"unknown"}');
	assert.equal(resolve(root, { MEOWKIT_MODEL_HINT: 'haiku-4-5' }), 'haiku-4-5');
});

test('a literal unknown is reported rather than passed on silently', () => {
	const root = projectWith('{"model_id":"unknown"}');
	const warnings = [];
	resolveModel({ root, env: {}, warn: (message) => warnings.push(message) });
	assert.equal(warnings.length, 1);
	assert.match(warnings[0], /model detection at session start failed/);
});

test('the identifier is sanitised, so a crafted value cannot survive', () => {
	const root = projectWith('{"model_id":"claude;rm -rf /"}');
	assert.equal(resolve(root), 'clauderm-rf');
});

test('the environment chain is ordered hint, then host, then vendor', () => {
	const root = projectWith(undefined);
	assert.equal(resolve(root, { MEOWKIT_MODEL_HINT: 'a', CLAUDE_MODEL: 'b', ANTHROPIC_MODEL: 'c' }), 'a');
	assert.equal(resolve(root, { CLAUDE_MODEL: 'b', ANTHROPIC_MODEL: 'c' }), 'b');
	assert.equal(resolve(root, { CLAUDE_MODEL_ID: 'd', ANTHROPIC_MODEL: 'c' }), 'd');
	assert.equal(resolve(root, { ANTHROPIC_MODEL: 'c' }), 'c');
});

test('a pre-move artifact location is still read', () => {
	// An install made before the state taxonomy settled keeps resolving, so the
	// move cannot silently turn a detected session into an unknown one.
	for (const rel of ['session-state', path.join('.claude', 'session-state')]) {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'resolve-model-legacy-'));
		fs.mkdirSync(path.join(root, rel), { recursive: true });
		fs.writeFileSync(path.join(root, rel, 'detected-model.json'), '{"model_id":"claude-opus-4-6"}');
		assert.equal(resolve(root), 'claude-opus-4-6');
	}
});

test('the density script and the model detector return the same density for every model in the table', () => {
	const { execFileSync } = require('node:child_process');
	const { lookup, MODEL_TIERS } = require('../lib/density-lookup.cjs');
	const detector = require('../handlers/model-detector.cjs');
	const script = path.join(__dirname, '../../skills/autobuild/scripts/density-select.sh');
	const env = { PATH: process.env.PATH, HOME: os.tmpdir() };
	for (const id of [...Object.keys(MODEL_TIERS), 'claude-opus-5-5', 'claude-unknown-1']) {
		const expected = (lookup(id) || { density: 'FULL' }).density;
		const fromScript = execFileSync('bash', [script, '--model', id], { env, encoding: 'utf8' }).trim();
		const saved = {};
		const state = { save: (_name, data) => Object.assign(saved, data), load: () => null };
		detector({ model: id, root: projectWith(), env: {} }, state);
		assert.equal(fromScript, expected, `script, ${id}`);
		assert.equal(saved.density, expected, `detector, ${id}`);
	}
});

/** Run the session-start detector against an explicit env; returns [saved, stdout]. */
function detect(ctx) {
	const detector = require('../handlers/model-detector.cjs');
	const saved = {};
	const state = { save: (_name, data) => Object.assign(saved, data), load: () => null };
	const out = detector({ root: projectWith(), env: {}, ...ctx }, state);
	return [saved, out];
}

test('detection and resolution read the environment in the same order', () => {
	const env = { MEOWKIT_MODEL_HINT: 'claude-haiku-4-5', CLAUDE_MODEL: 'claude-opus-4-7', ANTHROPIC_MODEL: 'claude-sonnet-4-6' };
	const [saved] = detect({ env });
	assert.equal(saved.model_id, resolve(projectWith(undefined), env));
	assert.equal(saved.tier, 'TRIVIAL');
});

test('with no model on stdin, a vendor variable still identifies the model', () => {
	const [saved] = detect({ env: { ANTHROPIC_MODEL: 'claude-opus-5-5' } });
	assert.equal(saved.tier, 'COMPLEX');
	assert.equal(saved.confidence, 'env_ANTHROPIC_MODEL');
});

test('a Claude model name behind a non-Anthropic endpoint is not trusted', () => {
	const [saved, out] = detect({ model: 'claude-opus-4-7', env: { ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic' } });
	assert.equal(saved.tier, 'STANDARD');
	assert.equal(saved.density, 'FULL');
	assert.equal(saved.confidence, 'third_party_endpoint');
	assert.match(out, /api\.deepseek\.com/);
});

test('an Anthropic base URL keeps normal detection', () => {
	const [saved] = detect({ model: 'claude-opus-4-7', env: { ANTHROPIC_BASE_URL: 'https://api.anthropic.com' } });
	assert.equal(saved.tier, 'COMPLEX');
});

test('the cost estimate prices a tool result at the input rate', () => {
	const tracker = require('../handlers/budget-tracker.cjs');
	const store = {};
	const state = { load: (k) => store[k] ?? (k === 'detected-model' ? { tier: 'STANDARD' } : null), save: (k, v) => { store[k] = v; } };
	// 4,000,000 characters of tool output ≈ 1M tokens read back: $3 at the STANDARD input rate.
	tracker({ root: projectWith(), tool_input: '', tool_response: 'x'.repeat(4_000_000) }, state);
	assert.equal(store['budget-state'].estimated_input_tokens, 1_000_000);
	assert.equal(store['budget-state'].estimated_output_tokens, 0);
	assert.equal(store['budget-state'].estimated_cost_usd, 3);
});
