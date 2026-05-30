// memory-schema.test.ts — Validates split JSON schema validity (M4, M5 closed).
// Tests that fixes.json, review-patterns.json, architecture-decisions.json have
// correct v2.0.0 schema, no semantic duplicates, and patterns.json is deprecated.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  SecurityFindingsSchema,
  ArchitectureDecisionsSchema,
} from '../../../packages/mewkit/src/memory/schemas.js';

let memoryDir: string;

interface PatternEntry {
  id: string;
  frequency?: number;
  [key: string]: unknown;
}

interface SplitSchema {
  version: string;
  scope: string;
  consumer: string;
  patterns: PatternEntry[];
  metadata?: Record<string, unknown>;
}

describe('Split schema validity (M4 closed)', () => {
  const files = ['fixes.json', 'review-patterns.json', 'architecture-decisions.json'];

  beforeEach(() => {
    memoryDir = mkdtempSync(join(tmpdir(), 'meow-memory-schema-'));
    writeFileSync(
      join(memoryDir, 'fixes.json'),
      JSON.stringify(
        {
          version: '2.0.0',
          scope: 'fixes',
          consumer: 'meow:fix',
          patterns: [
            {
              id: 'gnu-grep-bre-macos',
              type: 'failure',
              category: 'bug-class',
              frequency: 4,
            },
          ],
          metadata: {},
        },
        null,
        2
      )
    );
    writeFileSync(
      join(memoryDir, 'review-patterns.json'),
      JSON.stringify({ version: '2.0.0', scope: 'review-patterns', consumer: 'meow:review', patterns: [], metadata: {} })
    );
    writeFileSync(
      join(memoryDir, 'architecture-decisions.json'),
      JSON.stringify({
        version: '2.0.0',
        scope: 'architecture-decisions',
        consumer: 'meow:plan-creator',
        patterns: [],
        metadata: {},
      })
    );
    writeFileSync(join(memoryDir, 'patterns.json'), JSON.stringify({ deprecated: true }));
  });

  afterEach(() => rmSync(memoryDir, { recursive: true, force: true }));

  it.each(files)('%s has version 2.0.0 and required fields', (file) => {
    const data = JSON.parse(readFileSync(join(memoryDir, file), 'utf8')) as SplitSchema;
    expect(data.version).toBe('2.0.0');
    expect(data.scope).toBeTruthy();
    expect(data.consumer).toBeTruthy();
    expect(Array.isArray(data.patterns)).toBe(true);
  });

  it('fixes.json has no semantic duplicate entry (M5 closed)', () => {
    const data = JSON.parse(readFileSync(join(memoryDir, 'fixes.json'), 'utf8')) as SplitSchema;
    const ids = data.patterns.map((p) => p.id);
    // pattern-202604121231 was a duplicate of gnu-grep-bre-macos — must be removed
    expect(ids).not.toContain('pattern-202604121231');
    const gnu = data.patterns.find((p) => p.id === 'gnu-grep-bre-macos');
    expect(gnu).toBeDefined();
    expect(gnu!.frequency).toBe(4);
  });

  it('patterns.json is a deprecated stub', () => {
    const data = JSON.parse(readFileSync(join(memoryDir, 'patterns.json'), 'utf8')) as { deprecated?: boolean };
    expect(data.deprecated).toBe(true);
  });

  it('all split JSON files parse without error', () => {
    for (const file of files) {
      expect(
        () => JSON.parse(readFileSync(join(memoryDir, file), 'utf8')),
        `${file} should be valid JSON`
      ).not.toThrow();
    }
  });
});

describe('Zod store schemas', () => {
  it('SecurityFindingsSchema accepts the 4th-store narrative shape', () => {
    const ok = SecurityFindingsSchema.safeParse({
      version: '2.0.0',
      scope: 'security-findings',
      consumer: 'mk:cso,mk:review',
      findings: [{ id: 's1', finding: 'token in source', severity: 'high', status: 'fixed' }],
      metadata: {},
    });
    expect(ok.success).toBe(true);
  });

  it('SecurityFindingsSchema rejects the wrong scope literal', () => {
    const bad = SecurityFindingsSchema.safeParse({
      version: '2.0.0',
      scope: 'fixes',
      consumer: 'x',
      findings: [],
    });
    expect(bad.success).toBe(false);
  });

  it('ArchitectureDecisionsSchema keeps unknown additive fields (passthrough)', () => {
    const parsed = ArchitectureDecisionsSchema.safeParse({
      version: '2.0.0',
      scope: 'architecture-decisions',
      consumer: 'mk:plan-creator',
      patterns: [{ id: 'a1', source: 'seed-from-md', futureKey: true }],
    });
    expect(parsed.success).toBe(true);
  });
});
