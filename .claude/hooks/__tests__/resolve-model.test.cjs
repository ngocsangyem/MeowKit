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
