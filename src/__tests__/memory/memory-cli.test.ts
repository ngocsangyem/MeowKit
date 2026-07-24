// memory-cli.test.ts — Behavioral boundary tests for findMemoryDir.
// findMemoryDir resolves the project root (`.git`, or `package.json` + an existing
// `.meowkit/`) and returns `<root>/.meowkit/memory`. It NEVER keys off provider
// directories (`.claude/`/`.codex/`/`.cursor/`) — those are install targets, not
// state-discovery sentinels — and realpath-resolves startDir (macOS /var symlink).
// Contract owner: packages/mewkit/src/state/meowkit-root-resolver.ts.
// Legacy `.claude/memory` detection lives in detectLegacyMemory, not here.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { findMemoryDir } from '../../../packages/mewkit/src/commands/memory.js';

describe('findMemoryDir boundary', () => {
  let tmpDir: string;
  let root: string; // realpath-resolved so /var -> /private/var matches the impl

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'meow-memory-cli-'));
    root = realpathSync(tmpDir);
  });
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('returns <root>/.meowkit/memory at a git root (startDir is the root)', () => {
    mkdirSync(join(tmpDir, '.git'), { recursive: true });
    expect(findMemoryDir(tmpDir)).toBe(join(root, '.meowkit', 'memory'));
  });

  it('resolves up to the git root from a nested cwd', () => {
    mkdirSync(join(tmpDir, '.git'), { recursive: true });
    const nestedCwd = join(tmpDir, 'packages', 'foo');
    mkdirSync(nestedCwd, { recursive: true });
    expect(findMemoryDir(nestedCwd)).toBe(join(root, '.meowkit', 'memory'));
  });

  it('resolves a non-git root via package.json + an existing .meowkit/', () => {
    writeFileSync(join(tmpDir, 'package.json'), '{}');
    mkdirSync(join(tmpDir, '.meowkit'), { recursive: true });
    expect(findMemoryDir(tmpDir)).toBe(join(root, '.meowkit', 'memory'));
  });

  it('never keys off provider dirs — a lone .claude/ is not a project root', () => {
    mkdirSync(join(tmpDir, '.claude', 'memory'), { recursive: true });
    // no .git, no package.json + .meowkit → not a root → null
    expect(findMemoryDir(tmpDir)).toBeNull();
  });

  it('returns null when no project-root sentinel is present within the tree', () => {
    let deep = tmpDir;
    for (let i = 0; i < 6; i++) {
      deep = join(deep, `l${i}`);
      mkdirSync(deep);
    }
    expect(findMemoryDir(deep)).toBeNull();
  });
});
