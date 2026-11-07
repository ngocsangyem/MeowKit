// dispatcher.test.ts — the observer chain is fail-open, and the two handlers
// whose output means something still get heard.
//
// Fail-open is the hard part to test, because the failure mode looks like
// success: a dispatcher that silently ran nothing also exits 0. So every
// failure case here pairs "the broken one was reported" with "the healthy one
// still ran", which is the pair that distinguishes working fail-open from a
// dispatcher that gave up.
//
// Each case gets a throwaway tree with a registry written for it, so a failure
// mode can be built without shipping anything that can produce it.

import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readRegistry } from './lib/dispatch-replay';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** A handler that proves it ran, so "the others still ran" is observable. */
const HEALTHY = `'use strict';
module.exports = () => 'healthy-ran\\n';
`;

const THROWING = `'use strict';
module.exports = () => { throw new Error('handler exploded'); };
`;

const SYNTAX_ERROR = `'use strict';
module.exports = () => { this is not javascript (
`;

const BLOCKING_WRITE_SCAN = `'use strict';
module.exports = () => ({ stderr: 'BLOCK — finding\\n', exitCode: 2, feedback: true });
`;

const BLOCKING_DECISION = `'use strict';
module.exports = () => ({ stdout: JSON.stringify({ decision: 'block', reason: 'no evidence' }) + '\\n', feedback: true });
`;

interface Handler {
  name: string;
  source: string;
}

function tree(handlers: Handler[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-dispatch-'));
  fs.cpSync(path.join(REPO_ROOT, '.claude/hooks/dispatch.cjs'), path.join(dir, '.claude/hooks/dispatch.cjs'));
  fs.cpSync(path.join(REPO_ROOT, '.claude/hooks/lib'), path.join(dir, '.claude/hooks/lib'), { recursive: true });
  const handlersDir = path.join(dir, '.claude/hooks/handlers');
  fs.mkdirSync(handlersDir, { recursive: true });

  const entries = handlers.map((h) => {
    // An empty source means "registered but absent", which is a different
    // failure from a file that exists and cannot be parsed.
    if (h.source) fs.writeFileSync(path.join(handlersDir, `${h.name}.cjs`), h.source);
    return { event: 'PostToolUse', matcher: 'Edit|Write', handler: `./handlers/${h.name}.cjs`, toggleKey: h.name };
  });
  fs.writeFileSync(path.join(dir, '.claude/hooks/handlers.json'), JSON.stringify({ schema: 2, handlers: entries }, null, 2));
  return dir;
}

function dispatch(dir: string, event = 'PostToolUse', matcher = 'Edit|Write') {
  const r = spawnSync(process.execPath, [path.join(dir, '.claude/hooks/dispatch.cjs'), event, matcher], {
    cwd: dir,
    input: JSON.stringify({ session_id: 'dispatch-test', tool_name: 'Edit', tool_input: { file_path: 'src/a.ts' } }),
    env: { CLAUDE_PROJECT_DIR: dir, HOME: dir, PATH: process.env.PATH ?? '' },
    encoding: 'utf8',
  });
  return { exit: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

describe('a broken observer does not stop the others', () => {
  const cases: Array<{ label: string; broken: Handler; reported: RegExp }> = [
    { label: 'one throws', broken: { name: 'boom', source: THROWING }, reported: /handler exploded/ },
    { label: 'one has a syntax error', broken: { name: 'unparseable', source: SYNTAX_ERROR }, reported: /unparseable\.cjs error/ },
    { label: 'one is missing', broken: { name: 'absent', source: '' }, reported: /absent\.cjs error/ },
  ];

  for (const { label, broken, reported } of cases) {
    it(`${label}: it is reported, the healthy one runs, and the chain exits 0`, () => {
      const dir = tree([broken, { name: 'healthy', source: HEALTHY }]);
      const r = dispatch(dir);
      expect(r.stderr, 'the failure is reported').toMatch(reported);
      expect(r.stdout, 'the healthy handler still ran').toContain('healthy-ran');
      expect(r.exit, 'an observer fault is not the chain\'s fault').toBe(0);
    });
  }

  it('reports a missing registry and stands aside', () => {
    const dir = tree([{ name: 'healthy', source: HEALTHY }]);
    fs.rmSync(path.join(dir, '.claude/hooks/handlers.json'));
    const r = dispatch(dir);
    expect(r.stderr).toMatch(/cannot read .*handlers\.json/);
    expect(r.exit).toBe(0);
  });

  it('reports an invalid registry rather than running half of it', () => {
    const dir = tree([{ name: 'healthy', source: HEALTHY }]);
    fs.writeFileSync(
      path.join(dir, '.claude/hooks/handlers.json'),
      JSON.stringify({ schema: 2, handlers: [{ event: 'PostToolUse', handler: './handlers/healthy.cjs' }] }),
    );
    const r = dispatch(dir);
    expect(r.stderr).toMatch(/missing toggleKey/);
    expect(r.stdout).toBe('');
    expect(r.exit).toBe(0);
  });
});

describe('the two handlers whose output means something are passed through', () => {
  it('a blocked write pattern fails the result, after the others run', () => {
    const dir = tree([{ name: 'scan', source: BLOCKING_WRITE_SCAN }, { name: 'healthy', source: HEALTHY }]);
    const r = dispatch(dir);
    expect(r.exit, 'the finding fails the tool result').toBe(2);
    expect(r.stderr, 'the finding reaches the model').toContain('BLOCK — finding');
    expect(r.stdout, 'the other observer was not cut short').toContain('healthy-ran');
  });

  it('a block decision reaches stdout, after the others run', () => {
    const dir = tree([{ name: 'completion', source: BLOCKING_DECISION }, { name: 'healthy', source: HEALTHY }]);
    const r = dispatch(dir);
    expect(r.exit, 'a decision is not an error').toBe(0);
    expect(r.stdout).toContain('"decision":"block"');
    expect(r.stdout).toContain('healthy-ran');
    // Advisory output first, so a decision is the last thing the host reads.
    expect(r.stdout.indexOf('healthy-ran')).toBeLessThan(r.stdout.indexOf('"decision"'));
  });

  it('a feedback handler that crashes stays fail-open like any other', () => {
    const dir = tree([{ name: 'completion', source: THROWING }, { name: 'healthy', source: HEALTHY }]);
    const r = dispatch(dir);
    expect(r.exit).toBe(0);
    expect(r.stdout).toContain('healthy-ran');
  });
});

describe('the shipped registry', () => {
  const registry = readRegistry();

  it('gives every entry an event, a handler and a toggle key', () => {
    expect(registry.handlers.length).toBeGreaterThan(0);
    for (const entry of registry.handlers) {
      expect(entry.event, 'event').toBeTruthy();
      expect(entry.handler, `handler for ${entry.event}`).toBeTruthy();
      expect(entry.toggleKey, `toggleKey for ${entry.handler}`).toBeTruthy();
    }
  });

  it('carries a matcher exactly where the event is scoped to a tool', () => {
    for (const entry of registry.handlers) {
      const scoped = entry.event === 'PreToolUse' || entry.event === 'PostToolUse';
      expect(Boolean(entry.matcher), `${entry.event} ${entry.handler} matcher`).toBe(scoped);
    }
  });

  it('names a file that exists for every entry', () => {
    for (const entry of registry.handlers) {
      const abs = path.join(REPO_ROOT, '.claude/hooks', entry.handler);
      expect(fs.existsSync(abs), `${entry.handler} exists`).toBe(true);
    }
  });

  it('keeps every handler that was already registered', () => {
    const existing = [
      'auto-checkpoint', 'budget-tracker', 'build-verify', 'checkpoint-writer', 'loop-detection',
      'model-detector', 'orientation-ritual', 'review-evidence-tag', 'safety-sentinel-inject',
    ];
    const registered = new Set(registry.handlers.map((h) => path.basename(h.handler, '.cjs')));
    for (const name of existing) expect(registered.has(name), `${name} is still registered`).toBe(true);
  });

  it('registers no write guard', () => {
    // The guards are fail-closed and registered on their own. One of them in
    // here would inherit this chain's fail-open contract.
    for (const entry of registry.handlers) {
      expect(entry.handler, 'a write guard in the observer registry').not.toMatch(
        /gate-enforcement|privacy-block|pre-ship/,
      );
    }
  });
});
