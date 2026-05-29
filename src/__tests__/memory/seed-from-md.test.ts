// seed-from-md.test.ts — MD→JSON seeder (Phase 1). The data-loss guard for
// Phase 2: confirms empty JSON stores are populated from topic markdown, the
// operation is idempotent + additive (never overwrites existing entries), and
// security format-doc templates are NOT seeded as findings.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { seedFromMd } from '../../../packages/mewkit/src/memory/seed-from-md.js';

let memDir: string;
const readJson = (name: string) => JSON.parse(readFileSync(join(memDir, name), 'utf-8'));

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), 'meow-seed-'));
  memDir = join(root, '.claude', 'memory');
  mkdirSync(memDir, { recursive: true });
});
afterEach(() => rmSync(join(memDir, '..', '..'), { recursive: true, force: true }));

describe('seedFromMd (Phase 1)', () => {
  it('populates an empty architecture-decisions.json from its markdown', () => {
    writeFileSync(
      join(memDir, 'architecture-decisions.json'),
      JSON.stringify({ version: '2.0.0', scope: 'architecture-decisions', consumer: 'mk:plan-creator', patterns: [], metadata: {} })
    );
    writeFileSync(
      join(memDir, 'architecture-decisions.md'),
      '# Architecture\n\n> intro\n\n## chose Zustand over Redux (2026-04-12)\nbody one\n\n## decision two (2026-05-01)\nbody two\n'
    );
    const results = seedFromMd(memDir);
    const arch = results.find((r) => r.file === 'architecture-decisions.json')!;
    expect(arch.added).toBe(2);
    const data = readJson('architecture-decisions.json');
    expect(data.patterns).toHaveLength(2);
    expect(data.patterns[0].lastSeen).toBe('2026-04-12');
    expect(data.patterns[0].context).toContain('body one');
  });

  it('is idempotent — a second run adds nothing', () => {
    writeFileSync(join(memDir, 'fixes.md'), '# Fixes\n\n## a fix (2026-01-01)\ndetail\n');
    const first = seedFromMd(memDir).find((r) => r.file === 'fixes.json')!;
    expect(first.added).toBe(1);
    const second = seedFromMd(memDir).find((r) => r.file === 'fixes.json')!;
    expect(second.added).toBe(0);
    expect(readJson('fixes.json').patterns).toHaveLength(1);
  });

  it('is additive — existing JSON entries are preserved, not overwritten', () => {
    writeFileSync(
      join(memDir, 'fixes.json'),
      JSON.stringify({
        version: '2.0.0',
        scope: 'fixes',
        consumer: 'mk:fix',
        patterns: [{ id: 'existing', pattern: 'keep me', frequency: 7 }],
        metadata: {},
      })
    );
    writeFileSync(join(memDir, 'fixes.md'), '# Fixes\n\n## new md fix (2026-02-02)\ndetail\n');
    seedFromMd(memDir);
    const data = readJson('fixes.json');
    const existing = data.patterns.find((p: { id: string }) => p.id === 'existing');
    expect(existing.frequency).toBe(7); // untouched
    expect(data.patterns.length).toBe(2); // original + seeded
  });

  it('prefers the migrated-id marker over a slug', () => {
    writeFileSync(
      join(memDir, 'review-patterns.md'),
      '# R\n\n## L001 cross-ref (2026-04-10)\n<!-- migrated-id: L001-review-xref -->\nsee fixes\n'
    );
    seedFromMd(memDir);
    expect(readJson('review-patterns.json').patterns[0].id).toBe('L001-review-xref');
  });

  it('creates a valid empty security-findings skeleton without seeding fenced templates', () => {
    writeFileSync(
      join(memDir, 'security-log.md'),
      '# Security Log\nFormat: [YYMMDD] [LEVEL]\n\n## Red Team Finding Format\n```\n[DATE] [SEVERITY] [SOURCE] [DESC]\n```\n'
    );
    seedFromMd(memDir);
    const data = readJson('security-findings.json');
    expect(data.scope).toBe('security-findings');
    expect(data.findings).toHaveLength(0); // fenced template + ## header are NOT findings
  });

  it('seeds real bracketed log lines as findings', () => {
    writeFileSync(
      join(memDir, 'security-log.md'),
      '# Security Log\n\n[260101-120000] [HIGH] hardcoded token in config.ts\n'
    );
    seedFromMd(memDir);
    const data = readJson('security-findings.json');
    expect(data.findings).toHaveLength(1);
    expect(data.findings[0].finding).toContain('hardcoded token');
    expect(data.findings[0].severity).toBe('HIGH');
  });

  it('security findings are idempotent across runs with multiple findings (regression: stable line-index ids)', () => {
    writeFileSync(
      join(memDir, 'security-log.md'),
      '# Security Log\n\n[260101] [HIGH] alpha leak\n[260102] [MED] beta misconfig\n[260103] [LOW] gamma warning\n'
    );
    seedFromMd(memDir);
    expect(readJson('security-findings.json').findings).toHaveLength(3);
    seedFromMd(memDir); // second run must add nothing
    expect(readJson('security-findings.json').findings).toHaveLength(3);
  });
});
