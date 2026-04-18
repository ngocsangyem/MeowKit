// memory-cli.test.ts — Behavioral boundary tests for findMemoryDir (H2 closed).
// Imports findMemoryDir from memory.ts and tests against temp dir trees with
// mixed sentinel presence — does NOT string-grep source code.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { findMemoryDir } from '../../../packages/mewkit/src/commands/memory.js';

describe('findMemoryDir boundary (H2 closed)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'meow-memory-cli-'));
  });
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('finds .claude/memory when present in startDir', () => {
    const memDir = join(tmpDir, '.claude', 'memory');
    mkdirSync(memDir, { recursive: true });
    const result = findMemoryDir(tmpDir);
    expect(result).toBe(memDir);
  });

  it('finds .claude/memory when present in parent', () => {
    const memDir = join(tmpDir, '.claude', 'memory');
    mkdirSync(memDir, { recursive: true });
    const nestedCwd = join(tmpDir, 'packages', 'foo');
    mkdirSync(nestedCwd, { recursive: true });
    const result = findMemoryDir(nestedCwd);
    expect(result).toBe(memDir);
  });

  it('stops walk at CLAUDE.md sentinel — does not escape project root', () => {
    // CLAUDE.md at root but no .claude/memory
    writeFileSync(join(tmpDir, 'CLAUDE.md'), '# project root');
    // Nested cwd 2 levels deep, still inside root
    const nestedCwd = join(tmpDir, 'packages', 'foo');
    mkdirSync(nestedCwd, { recursive: true });
    // Result must be null — sentinel found, no memory dir → stop
    const result = findMemoryDir(nestedCwd);
    expect(result).toBeNull();
  });

  it('stops walk at .claude/settings.json sentinel', () => {
    mkdirSync(join(tmpDir, '.claude'), { recursive: true });
    writeFileSync(join(tmpDir, '.claude', 'settings.json'), '{}');
    const nestedCwd = join(tmpDir, 'src', 'foo');
    mkdirSync(nestedCwd, { recursive: true });
    const result = findMemoryDir(nestedCwd);
    expect(result).toBeNull();
  });

  it('returns null when no memory dir found within 5 levels', () => {
    // No CLAUDE.md, no .claude/memory — pure empty tree 6 levels deep
    let deep = tmpDir;
    for (let i = 0; i < 6; i++) {
      deep = join(deep, `l${i}`);
      mkdirSync(deep);
    }
    const result = findMemoryDir(deep);
    expect(result).toBeNull();
  });

  it('returns null at filesystem root (no memory dir)', () => {
    // Walk from a path that is already at a known empty boundary
    // Using tmpDir with no .claude/memory and sentinel at root to stop early
    writeFileSync(join(tmpDir, 'CLAUDE.md'), '# sentinel');
    const result = findMemoryDir(tmpDir);
    // depth=0 check: memory dir not found, sentinel at depth 0 is not enough to stop
    // (sentinel check is skipped at depth=0 per implementation), so keeps walking up.
    // Result depends on whether parent dirs have memory — in tmp, they won't, returns null.
    expect(result).toBeNull();
  });
});
