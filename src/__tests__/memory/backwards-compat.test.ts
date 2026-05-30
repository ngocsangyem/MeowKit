// backwards-compat.test.ts — Phase 7. A pre-migration project (legacy MD topic
// files, current v2.0.0 JSON, deprecated stubs) must keep working with the new
// readers/validators: validation WARNS (never hard-fails) on legacy state, the
// seeder recovers MD-only knowledge, and tombstones/absent files don't crash.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { validateMemory } from '../../../packages/mewkit/src/memory/validate.js';
import { seedFromMd } from '../../../packages/mewkit/src/memory/seed-from-md.js';
import { renderViews } from '../../../packages/mewkit/src/memory/render-views.js';

let memDir: string;
const v200 = (scope: string, patterns: unknown[]) => ({
  version: '2.0.0',
  scope,
  consumer: 'mk:test',
  patterns,
  metadata: { created: '2026-01-01', last_updated: '2026-01-01' },
});

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), 'meow-bc-'));
  memDir = join(root, '.claude', 'memory');
  mkdirSync(memDir, { recursive: true });
});
afterEach(() => rmSync(join(memDir, '..', '..'), { recursive: true, force: true }));

describe('backwards compatibility (Phase 7)', () => {
  it('current v2.0.0 stores validate with zero errors', () => {
    writeFileSync(join(memDir, 'fixes.json'), JSON.stringify(v200('fixes', [{ id: 'f1', pattern: 'p', context: 'c' }])));
    writeFileSync(join(memDir, 'review-patterns.json'), JSON.stringify(v200('review-patterns', [{ id: 'r1', pattern: 'p' }])));
    writeFileSync(join(memDir, 'architecture-decisions.json'), JSON.stringify(v200('architecture-decisions', [{ id: 'a1', pattern: 'p' }])));
    expect(validateMemory(memDir).errorCount).toBe(0);
  });

  it('a legacy project with only MD topic files never hard-fails — warns then seeds clean', () => {
    // No JSON stores at all (pre-migration). Validation must warn, not error.
    writeFileSync(join(memDir, 'fixes.md'), '# Fixes\n\n## a bug-class lesson (2026-01-01)\ndetail\n');
    writeFileSync(join(memDir, 'architecture-decisions.md'), '# AD\n\n## chose X (2026-01-02)\nwhy\n');
    const before = validateMemory(memDir);
    expect(before.errorCount).toBe(0);
    expect(before.warnCount).toBeGreaterThan(0);

    // Seeder recovers MD-only knowledge into JSON.
    seedFromMd(memDir);
    const after = validateMemory(memDir);
    expect(after.errorCount).toBe(0);
    const fixes = after.stores.find((s) => s.file === 'fixes.json')!;
    expect(fixes.entryCount).toBeGreaterThan(0);
  });

  it('a deprecated patterns.json stub on disk does not break validation', () => {
    writeFileSync(join(memDir, 'fixes.json'), JSON.stringify(v200('fixes', [{ id: 'f1', pattern: 'p' }])));
    writeFileSync(join(memDir, 'patterns.json'), JSON.stringify({ deprecated: true }));
    // patterns.json is not a curated store → ignored, no crash.
    expect(() => validateMemory(memDir)).not.toThrow();
    expect(validateMemory(memDir).errorCount).toBe(0);
  });

  it('render-views tolerates a mix of present and absent stores', () => {
    writeFileSync(join(memDir, 'fixes.json'), JSON.stringify(v200('fixes', [{ id: 'f1', pattern: 'p' }])));
    // review-patterns / architecture-decisions / security-findings absent.
    const results = renderViews(memDir);
    expect(() => results).not.toThrow();
    expect(existsSync(join(memDir, 'views', 'fixes.md'))).toBe(true);
    // Absent stores simply produce no view, no crash.
    expect(results.find((r) => r.file === 'fixes.json')).toBeTruthy();
    expect(results.find((r) => r.file === 'review-patterns.json')).toBeUndefined();
  });

  it('an empty memory dir (fresh install) validates without throwing', () => {
    const report = validateMemory(memDir);
    expect(report.errorCount).toBe(0); // all stores absent → warnings only
    expect(report.stores.every((s) => !s.exists)).toBe(true);
  });
});
