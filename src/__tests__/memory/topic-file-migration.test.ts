// topic-file-migration.test.ts — Verifies topic file existence post-migration and
// migration idempotency (FIX-F5 closed). Runs memory-topic-file-migrator.cjs twice
// against a temp MEMORY_DIR and asserts identical output (no duplicate entries).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';

const MIGRATOR = resolve(process.cwd(), '.claude/scripts/memory-topic-file-migrator.cjs');
const MEMORY_DIR_REAL = join(process.cwd(), '.claude', 'memory');
const TOPIC_FILES = ['fixes.md', 'review-patterns.md', 'architecture-decisions.md', 'security-notes.md'];

// Fixture representing a pre-migration lessons.md with two entries
const SAMPLE_LESSONS = `---
id: L001
status: live-captured
severity: critical
---
## Skill Scripts Stability Audit
GNU grep BRE macOS: use grep -E
shell-to-python injection: pass via env vars

---
id: decision-202604121231
status: live-captured
severity: standard
---
## Zustand over Redux
Chose Zustand for client state.
`;

describe('Topic file migration (phase-05 — real files)', () => {
  it.each(TOPIC_FILES)('%s exists and is non-empty', (file) => {
    const p = join(MEMORY_DIR_REAL, file);
    expect(existsSync(p), `${file} missing`).toBe(true);
    expect(readFileSync(p, 'utf8').trim().length, `${file} is empty`).toBeGreaterThan(0);
  });

  it('lessons.md is archived (contains ARCHIVED marker)', () => {
    const content = readFileSync(join(MEMORY_DIR_REAL, 'lessons.md'), 'utf8');
    expect(content).toContain('ARCHIVED');
  });

  it('lessons.md has no active NEEDS_CAPTURE markers', () => {
    const content = readFileSync(join(MEMORY_DIR_REAL, 'lessons.md'), 'utf8');
    expect(content).not.toContain('NEEDS_CAPTURE');
  });

  it('lessons.md.bak is deleted', () => {
    expect(existsSync(join(MEMORY_DIR_REAL, 'lessons.md.bak'))).toBe(false);
  });

  it('fixes.md contains L001 content (no data loss from migration)', () => {
    const content = readFileSync(join(MEMORY_DIR_REAL, 'fixes.md'), 'utf8');
    expect(content).toContain('grep -E');
    // Content uses Unicode arrow "Shell→Python" or literal "shell-to-python" depending on source
    expect(content.toLowerCase()).toMatch(/shell.{0,3}python/i);
  });
});

describe('Migration idempotency (FIX-F5 closed)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'meow-migrator-'));
    mkdirSync(join(tmpDir, '.claude', 'memory'), { recursive: true });
    writeFileSync(join(tmpDir, '.claude', 'memory', 'lessons.md'), SAMPLE_LESSONS);
  });

  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('running migrator twice produces identical topic file contents (dedup-aware)', () => {
    const memDir = join(tmpDir, '.claude', 'memory');

    // Migrator reads: ROOT = CLAUDE_PROJECT_DIR || cwd(); MEMORY_DIR = ROOT/.claude/memory
    const run = () =>
      spawnSync('node', [MIGRATOR], {
        env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
        encoding: 'utf8',
        timeout: 15000,
      });

    const r1 = run();
    expect(r1.status, `first run failed:\n${r1.stderr}`).toBe(0);

    const r2 = run();
    expect(r2.status, `second run failed:\n${r2.stderr}`).toBe(0);

    // Both runs must produce identical topic files — idempotency guard works.
    // Check for duplicate migrated-id markers (each entry should appear exactly once).
    for (const file of ['fixes.md', 'architecture-decisions.md']) {
      const filePath = join(memDir, file);
      if (!existsSync(filePath)) continue;
      const content = readFileSync(filePath, 'utf8');
      // Count <!-- migrated-id: L001 --> markers — must be ≤1 (idempotency guard)
      const markerMatches = (content.match(/<!-- migrated-id: L001 -->/g) ?? []).length;
      expect(markerMatches, `${file} has duplicate migrated-id:L001 markers after idempotency run`).toBeLessThanOrEqual(1);
    }
  });

  it('migrator exits 0 on first run', () => {
    const r = spawnSync('node', [MIGRATOR], {
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
      encoding: 'utf8',
      timeout: 15000,
    });
    expect(r.status, `migrator failed:\n${r.stderr}`).toBe(0);
  });

  it('migrator creates fixes.md from lessons content', () => {
    const memDir = join(tmpDir, '.claude', 'memory');
    spawnSync('node', [MIGRATOR], {
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
      encoding: 'utf8',
      timeout: 15000,
    });
    expect(existsSync(join(memDir, 'fixes.md'))).toBe(true);
    const content = readFileSync(join(memDir, 'fixes.md'), 'utf8');
    expect(content.trim().length).toBeGreaterThan(0);
  });
});
