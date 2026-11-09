// sentinel-pipeline.test.ts — the per-session "already verified" marker, end to
// end: the producer that writes it, the re-arm that invalidates it, and the
// reader that decides whether the next turn may skip re-reading the rules.
//
// Both halves have to be tested together. The reader's job is to withhold the
// skip whenever the marker cannot be trusted, and the producer's job is to make
// the marker untrustworthy at the moment compaction drops the rules from
// context. Testing either alone passes while the pair is broken.
//
// State is one append-only log, keyed by session id, with the latest matching
// line winning. These assertions carry over from the shell integration test that
// covered the same pipeline.

import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require_ = createRequire(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LOG_REL = '.meowkit/state/session-sentinels.jsonl';

const SAFETY_MARKER = 'Safety baseline: verified';
const PHASE_MARKER = 'Phase-zero rules: verified';

type Injector = (ctx: { session_id: string }) => Promise<string | null> | string | null;

function loadInjector(): Injector {
  const mod: unknown = require_(path.join(REPO_ROOT, '.claude/hooks/handlers/safety-sentinel-inject.cjs'));
  if (typeof mod !== 'function') throw new Error('safety-sentinel-inject.cjs does not export a handler');
  return mod as Injector;
}

function project(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-sentinel-'));
  fs.mkdirSync(path.join(dir, '.meowkit/state'), { recursive: true });
  fs.writeFileSync(path.join(dir, LOG_REL), '');
  fs.cpSync(path.join(REPO_ROOT, '.claude/hooks/handlers/precompact-probe.cjs'), path.join(dir, '.claude/hooks/handlers/precompact-probe.cjs'));
  fs.cpSync(path.join(REPO_ROOT, '.claude/hooks/lib'), path.join(dir, '.claude/hooks/lib'), { recursive: true });
  return dir;
}

const append = (root: string, line: string) => fs.appendFileSync(path.join(root, LOG_REL), `${line}\n`);

const writeVerified = (root: string, sid: string, safety: boolean, phaseZero: boolean, ts = '2026-05-16T00:00:00Z') =>
  append(root, JSON.stringify({ session_id: sid, safety, phase_zero: phaseZero, ts }));

const writeRearm = (root: string, sid: string, ts = '2026-05-16T00:00:00Z') =>
  append(root, JSON.stringify({ session_id: sid, event: 'precompact_rearm', ts }));

/** Run the reader with the project root and bypass switch the host would supply. */
async function read(root: string, sid: string, skip = 'on'): Promise<string> {
  const previousRoot = process.env.CLAUDE_PROJECT_DIR;
  const previousSkip = process.env.MEOWKIT_SKIP_SAFETY_SENTINEL;
  process.env.CLAUDE_PROJECT_DIR = root;
  process.env.MEOWKIT_SKIP_SAFETY_SENTINEL = skip;
  try {
    return (await loadInjector()({ session_id: sid })) || '';
  } finally {
    if (previousRoot === undefined) delete process.env.CLAUDE_PROJECT_DIR; else process.env.CLAUDE_PROJECT_DIR = previousRoot;
    if (previousSkip === undefined) delete process.env.MEOWKIT_SKIP_SAFETY_SENTINEL; else process.env.MEOWKIT_SKIP_SAFETY_SENTINEL = previousSkip;
  }
}

/** Run the real producer with a synthesised payload, as the host would. */
function runPrecompact(root: string, sid: string) {
  const runner = path.join(root, 'run-probe.cjs');
  fs.writeFileSync(
    runner,
    "require('./.claude/hooks/handlers/precompact-probe.cjs')({ root: process.env.CLAUDE_PROJECT_DIR, session_id: process.argv[2] });\n",
  );
  const r = spawnSync(process.execPath, [runner, sid], {
    cwd: root,
    env: { CLAUDE_PROJECT_DIR: root, HOME: root, PATH: process.env.PATH ?? '' },
    encoding: 'utf8',
  });
  return r.status ?? -1;
}

describe('the cached-skip marker is withheld whenever it cannot be trusted', () => {
  it('emits nothing on the first turn, when no marker exists yet', async () => {
    const root = project();
    expect(await read(root, 'sess-1')).toBe('');
  });

  it('emits both markers once this session recorded both verifications', async () => {
    const root = project();
    writeVerified(root, 'sess-2', true, true);
    const out = await read(root, 'sess-2');
    expect(out).toContain(SAFETY_MARKER);
    expect(out).toContain(PHASE_MARKER);
  });

  it('emits only the marker that was actually verified', async () => {
    const root = project();
    writeVerified(root, 'sess-3', true, false);
    const out = await read(root, 'sess-3');
    expect(out).toContain(SAFETY_MARKER);
    expect(out).not.toContain(PHASE_MARKER);
  });

  it('ignores a marker belonging to another session', async () => {
    const root = project();
    writeVerified(root, 'other-session', true, true);
    expect(await read(root, 'sess-4')).toBe('');
  });

  it('emits nothing when the skip is switched off, even with a matching marker', async () => {
    const root = project();
    writeVerified(root, 'sess-5', true, true);
    expect(await read(root, 'sess-5', 'off')).toBe('');
  });

  it('emits nothing for an empty session id', async () => {
    const root = project();
    writeVerified(root, 'sess-6', true, true);
    expect(await read(root, '')).toBe('');
  });

  it('skips a corrupt line and still finds the good one', async () => {
    const root = project();
    append(root, '{not json at all');
    writeVerified(root, 'sess-7', true, true);
    const out = await read(root, 'sess-7');
    expect(out).toContain(SAFETY_MARKER);
  });

  it('lets the latest line win for a repeated session id', async () => {
    const root = project();
    writeVerified(root, 'sess-8', false, false, '2026-05-16T00:00:00Z');
    writeVerified(root, 'sess-8', true, true, '2026-05-16T00:00:01Z');
    const out = await read(root, 'sess-8');
    expect(out).toContain(SAFETY_MARKER);
    expect(out).toContain(PHASE_MARKER);
  });
});

describe('a re-arm invalidates the marker, and a fresh verification restores it', () => {
  it('withholds the skip after a re-arm, and restores it after a newer verification', async () => {
    const root = project();
    writeVerified(root, 'sess-9', true, true, '2026-05-16T00:00:00Z');
    expect(await read(root, 'sess-9'), 'verified before the re-arm').toContain(SAFETY_MARKER);

    expect(runPrecompact(root, 'sess-9'), 'the producer exits cleanly').toBe(0);
    expect(fs.readFileSync(path.join(root, LOG_REL), 'utf8')).toContain('"event":"precompact_rearm"');

    expect(await read(root, 'sess-9'), 'the re-arm post-dates the verification').toBe('');

    writeVerified(root, 'sess-9', true, true, '2099-01-01T00:00:00Z');
    const restored = await read(root, 'sess-9');
    expect(restored).toContain(SAFETY_MARKER);
    expect(restored).toContain(PHASE_MARKER);
  });

  it('breaks a same-timestamp tie by file position', async () => {
    const root = project();
    writeVerified(root, 'sess-10', true, true, '2026-05-16T00:00:00Z');
    writeRearm(root, 'sess-10', '2026-05-16T00:00:00Z');
    expect(await read(root, 'sess-10'), 'the re-arm is later in the file').toBe('');

    writeVerified(root, 'sess-10', true, true, '2026-05-16T00:00:00Z');
    expect(await read(root, 'sess-10'), 'the verification is now later').toContain(SAFETY_MARKER);
  });
});

describe('the re-arm producer never writes a record it cannot key', () => {
  it('exits cleanly and writes nothing for an empty session id', () => {
    const root = project();
    expect(runPrecompact(root, '')).toBe(0);
    expect(fs.readFileSync(path.join(root, LOG_REL), 'utf8')).toBe('');
  });

  it('writes a keyed re-arm record for a real session id', () => {
    const root = project();
    expect(runPrecompact(root, 'sess-11')).toBe(0);
    expect(fs.readFileSync(path.join(root, LOG_REL), 'utf8')).toContain('"session_id":"sess-11","event":"precompact_rearm"');
  });
});
