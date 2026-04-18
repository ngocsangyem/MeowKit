// memory-prune.test.ts — Stub tests for meow:memory --prune behaviour.
// These tests cover the grep-based prune approach (replacing memory-parser.cjs).
// NOTE: Full --prune rewrite is pending; extend this file when meow:memory --prune stabilises.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const MEMORY_DIR = join(process.cwd(), '.claude', 'memory');

describe('memory-prune stub (grep-based — memory-parser.cjs deleted)', () => {
  it('memory-parser.cjs is deleted (no stale parser dependency)', () => {
    const parserPath = join(process.cwd(), '.claude/hooks/handlers/memory-parser.cjs');
    expect(existsSync(parserPath), 'memory-parser.cjs should be deleted').toBe(false);
  });

  it('memory-filter.cjs is deleted', () => {
    const filterPath = join(process.cwd(), '.claude/hooks/handlers/memory-filter.cjs');
    expect(existsSync(filterPath), 'memory-filter.cjs should be deleted').toBe(false);
  });

  it('memory-loader.cjs is deleted', () => {
    const loaderPath = join(process.cwd(), '.claude/hooks/handlers/memory-loader.cjs');
    expect(existsSync(loaderPath), 'memory-loader.cjs should be deleted').toBe(false);
  });

  it('memory-injector.cjs is deleted', () => {
    const injectorPath = join(process.cwd(), '.claude/hooks/handlers/memory-injector.cjs');
    expect(existsSync(injectorPath), 'memory-injector.cjs should be deleted').toBe(false);
  });

  it('immediate-capture-handler.cjs still exists (surviving handler)', () => {
    const handlerPath = join(process.cwd(), '.claude/hooks/handlers/immediate-capture-handler.cjs');
    expect(existsSync(handlerPath), 'immediate-capture-handler.cjs should exist').toBe(true);
  });

  it('topic files contain no NEEDS_CAPTURE markers (pipeline deleted)', () => {
    const topicFiles = ['fixes.md', 'review-patterns.md', 'architecture-decisions.md', 'security-notes.md'];
    for (const file of topicFiles) {
      const p = join(MEMORY_DIR, file);
      if (!existsSync(p)) continue;
      const content = readFileSync(p, 'utf8');
      expect(content, `${file} should not contain NEEDS_CAPTURE`).not.toContain('NEEDS_CAPTURE');
    }
  });

  // Placeholder: extend when meow:memory --prune rewrite stabilises
  it.todo('--prune archives topic file entries older than 90 days');
  it.todo('--prune preserves critical-severity entries regardless of age');
  it.todo('--prune moves archived entries to topic-file-archive.md');
});
