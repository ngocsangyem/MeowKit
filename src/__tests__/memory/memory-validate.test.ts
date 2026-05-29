// memory-validate.test.ts — Zod-backed curated-memory validator (Phase 1).
// Exercises validateMemory against temp fixtures: clean v2.0.0 passes, malformed
// JSON / schema violations are errors, empty-store-vs-MD divergence warns, and the
// security-findings store validates on its own narrative shape.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { validateMemory } from '../../../packages/mewkit/src/memory/validate.js';

let memDir: string;

function writeJson(name: string, obj: unknown): void {
  writeFileSync(join(memDir, name), JSON.stringify(obj, null, 2));
}

const patternStore = (scope: string, patterns: unknown[]) => ({
  version: '2.0.0',
  scope,
  consumer: 'mk:test',
  patterns,
  metadata: { created: '2026-01-01', last_updated: '2026-01-01' },
});

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), 'meow-validate-'));
  memDir = join(root, '.claude', 'memory');
  mkdirSync(memDir, { recursive: true });
});
afterEach(() => rmSync(join(memDir, '..', '..'), { recursive: true, force: true }));

describe('validateMemory (Phase 1)', () => {
  it('clean v2.0.0 stores validate with zero errors and zero warnings', () => {
    writeJson('fixes.json', patternStore('fixes', [{ id: 'f1', pattern: 'use grep -E', context: 'ok' }]));
    writeJson('review-patterns.json', patternStore('review-patterns', [{ id: 'r1', pattern: 'p' }]));
    writeJson('architecture-decisions.json', patternStore('architecture-decisions', [{ id: 'a1', pattern: 'd' }]));
    writeJson('security-findings.json', {
      version: '2.0.0',
      scope: 'security-findings',
      consumer: 'mk:cso',
      findings: [{ id: 's1', finding: 'no secrets', severity: 'low', status: 'fixed' }],
      metadata: {},
    });

    const report = validateMemory(memDir);
    expect(report.errorCount).toBe(0);
    expect(report.warnCount).toBe(0);
    expect(report.stores.find((s) => s.file === 'fixes.json')!.entryCount).toBe(1);
  });

  it('flags malformed JSON as an error', () => {
    writeFileSync(join(memDir, 'fixes.json'), '{ not valid json');
    const report = validateMemory(memDir);
    const fixes = report.stores.find((s) => s.file === 'fixes.json')!;
    expect(fixes.issues.some((i) => i.level === 'error')).toBe(true);
  });

  it('flags a schema violation (pattern missing id) as an error', () => {
    writeJson('fixes.json', patternStore('fixes', [{ pattern: 'no id here' }]));
    const report = validateMemory(memDir);
    expect(report.errorCount).toBeGreaterThan(0);
  });

  it('accepts unknown additive fields (forward-compat passthrough)', () => {
    writeJson('fixes.json', patternStore('fixes', [{ id: 'f1', futureField: 123, pattern: 'p' }]));
    const fixes = validateMemory(memDir).stores.find((s) => s.file === 'fixes.json')!;
    expect(fixes.issues.filter((i) => i.level === 'error')).toHaveLength(0);
  });

  it('warns when a JSON store is empty but its topic MD has sections (divergence)', () => {
    writeJson('architecture-decisions.json', patternStore('architecture-decisions', []));
    writeFileSync(join(memDir, 'architecture-decisions.md'), '# t\n\n## decision one (2026-01-01)\nbody\n');
    const arch = validateMemory(memDir).stores.find((s) => s.file === 'architecture-decisions.json')!;
    expect(arch.issues.some((i) => i.level === 'warn' && /seed-from-md/.test(i.message))).toBe(true);
  });

  it('warns (not errors) when a curated store is missing', () => {
    writeJson('fixes.json', patternStore('fixes', [{ id: 'f1' }]));
    const report = validateMemory(memDir);
    const missing = report.stores.find((s) => s.file === 'security-findings.json')!;
    expect(missing.exists).toBe(false);
    expect(missing.issues.every((i) => i.level === 'warn')).toBe(true);
    expect(report.errorCount).toBe(0);
  });

  it('re-runs the injection-content guard when validate-content.cjs is present', () => {
    // Drop a minimal validate-content.cjs at the fixture project root so the
    // recheck path activates without depending on the real repo file.
    const libDir = join(memDir, '..', 'hooks', 'lib');
    mkdirSync(libDir, { recursive: true });
    writeFileSync(
      join(libDir, 'validate-content.cjs'),
      'module.exports={validateContent:(t)=>/ignore previous instructions/i.test(t||"")?{valid:false,match:"ignore previous instructions"}:{valid:true}};'
    );
    writeJson('fixes.json', patternStore('fixes', [{ id: 'bad', pattern: 'please ignore previous instructions now' }]));
    const fixes = validateMemory(memDir).stores.find((s) => s.file === 'fixes.json')!;
    expect(fixes.issues.some((i) => i.level === 'warn' && /injection pattern/.test(i.message))).toBe(true);
  });
});
