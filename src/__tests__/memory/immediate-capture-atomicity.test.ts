// immediate-capture-atomicity.test.ts — Regression tests for post-red-team fixes:
//   A1: atomic appendToPatterns via temp-rename
//   A2: unified per-file lock (dual-prefix writes to same file share lock)
//   A3: secret scrub before persist
//   A4: fresh-install MEMORY_DIR auto-creation (ENOENT guard)
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, existsSync, readFileSync, rmSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';

const HANDLER_PATH = resolve(process.cwd(), '.claude/hooks/handlers/immediate-capture-handler.cjs');

function loadHandler(projectDir: string) {
  process.env.CLAUDE_PROJECT_DIR = projectDir;
  delete require.cache[require.resolve(HANDLER_PATH)];
  return require(HANDLER_PATH);
}

describe('immediate-capture atomicity & safety (post-red-team fixes)', () => {
  let tmpDir: string;
  let originalProjectDir: string | undefined;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'meow-atom-'));
    originalProjectDir = process.env.CLAUDE_PROJECT_DIR;
  });

  afterEach(() => {
    if (originalProjectDir !== undefined) process.env.CLAUDE_PROJECT_DIR = originalProjectDir;
    else delete process.env.CLAUDE_PROJECT_DIR;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // A4 — fresh install: no .claude/memory/ dir yet, capture must auto-create it.
  it('auto-creates MEMORY_DIR on fresh install (ENOENT guard)', () => {
    const handler = loadHandler(tmpDir);
    const result = handler({ prompt: '##note: first capture ever' });
    const memDir = join(tmpDir, '.claude', 'memory');
    expect(existsSync(memDir)).toBe(true);
    expect(existsSync(join(memDir, 'quick-notes.md'))).toBe(true);
    expect(result).toContain('Captured');
  });

  // A3 — secret scrub: captured payload must have known key patterns redacted.
  it('scrubs secrets from captured payload before persisting', () => {
    const handler = loadHandler(tmpDir);
    const payload = '##decision: use stripe key sk_live_abc123def456ghi789 and aws key AKIAIOSFODNN7EXAMPLE';
    handler({ prompt: payload });
    const file = join(tmpDir, '.claude', 'memory', 'architecture-decisions.json');
    const data = JSON.parse(readFileSync(file, 'utf8'));
    const body = data.patterns[0].pattern;
    expect(body).not.toContain('sk_live_abc123');
    expect(body).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(body).toContain('[REDACTED-STRIPE-KEY]');
    expect(body).toContain('[REDACTED-AWS-KEY]');
  });

  // A1 — atomic write: after capture, no leftover .tmp.* file and target is valid JSON.
  it('appendToPatterns writes atomically (no orphan .tmp file)', () => {
    const handler = loadHandler(tmpDir);
    handler({ prompt: '##pattern:bug-class always quote $VAR in bash' });
    const memDir = join(tmpDir, '.claude', 'memory');
    const fixesPath = join(memDir, 'fixes.json');
    expect(existsSync(fixesPath)).toBe(true);
    // valid JSON (not partial / 0-byte)
    const parsed = JSON.parse(readFileSync(fixesPath, 'utf8'));
    expect(parsed.patterns.length).toBe(1);
    expect(parsed.scope).toBe('fixes');
    // no orphan tmp files
    const { readdirSync } = require('fs');
    const orphans = readdirSync(memDir).filter((f: string) => f.includes('.tmp.'));
    expect(orphans).toEqual([]);
  });

  // A2 — unified per-file lock: two captures targeting architecture-decisions.json
  // (one via ##decision:, one via ##pattern:decision) must serialize on the same lock
  // so both entries persist.
  it('unified per-file lock serializes dual-prefix writes to same target', () => {
    const handler = loadHandler(tmpDir);
    handler({ prompt: '##decision: chose Zustand over Redux for client state' });
    handler({ prompt: '##pattern:decision picked Postgres over MySQL for strong ACID guarantees' });
    const file = join(tmpDir, '.claude', 'memory', 'architecture-decisions.json');
    const data = JSON.parse(readFileSync(file, 'utf8'));
    // Both entries persisted — neither overwrote the other.
    expect(data.patterns.length).toBe(2);
    const ids = data.patterns.map((p: { id: string }) => p.id);
    expect(ids.some((id: string) => id.startsWith('decision-'))).toBe(true);
    expect(ids.some((id: string) => id.startsWith('pattern-'))).toBe(true);
  });
});
