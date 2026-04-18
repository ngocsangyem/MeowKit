// memory-schema.test.ts — Validates split JSON schema validity (M4, M5 closed).
// Tests that fixes.json, review-patterns.json, architecture-decisions.json have
// correct v2.0.0 schema, no semantic duplicates, and patterns.json is deprecated.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const MEMORY_DIR = join(process.cwd(), '.claude', 'memory');

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

  it.each(files)('%s has version 2.0.0 and required fields', (file) => {
    const data = JSON.parse(readFileSync(join(MEMORY_DIR, file), 'utf8')) as SplitSchema;
    expect(data.version).toBe('2.0.0');
    expect(data.scope).toBeTruthy();
    expect(data.consumer).toBeTruthy();
    expect(Array.isArray(data.patterns)).toBe(true);
  });

  it('fixes.json has no semantic duplicate entry (M5 closed)', () => {
    const data = JSON.parse(readFileSync(join(MEMORY_DIR, 'fixes.json'), 'utf8')) as SplitSchema;
    const ids = data.patterns.map((p) => p.id);
    // pattern-202604121231 was a duplicate of gnu-grep-bre-macos — must be removed
    expect(ids).not.toContain('pattern-202604121231');
    const gnu = data.patterns.find((p) => p.id === 'gnu-grep-bre-macos');
    expect(gnu).toBeDefined();
    expect(gnu!.frequency).toBe(4);
  });

  it('patterns.json is a deprecated stub', () => {
    const data = JSON.parse(readFileSync(join(MEMORY_DIR, 'patterns.json'), 'utf8')) as { deprecated?: boolean };
    expect(data.deprecated).toBe(true);
  });

  it('all split JSON files parse without error', () => {
    for (const file of files) {
      expect(
        () => JSON.parse(readFileSync(join(MEMORY_DIR, file), 'utf8')),
        `${file} should be valid JSON`
      ).not.toThrow();
    }
  });
});
