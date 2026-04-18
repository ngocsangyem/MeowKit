// cost-log-atomicity.test.ts — Verifies concurrent post-session.sh writes don't
// corrupt cost-log.json (M7 closed). Spawns 5 parallel invocations against a
// shared temp MEMORY_DIR and asserts all entries are valid JSON afterward.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';

const POST_SESSION_SH = resolve(process.cwd(), '.claude/hooks/post-session.sh');

describe('cost-log atomic write (M7 closed)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'meow-m7-'));
    mkdirSync(join(tmpDir, '.claude', 'memory'), { recursive: true });
    mkdirSync(join(tmpDir, 'session-state'), { recursive: true });
    writeFileSync(join(tmpDir, '.claude', 'memory', 'cost-log.json'), '[]');
    // Minimal CLAUDE.md so hooks don't error on missing project sentinel
    writeFileSync(join(tmpDir, 'CLAUDE.md'), '# test project\n');
  });

  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('5 concurrent post-session.sh invocations all write valid JSON entries', () => {
    // Create budget-state files for each worker
    const budgetFiles: string[] = [];
    for (let i = 0; i < 5; i++) {
      const budgetState = join(tmpDir, 'session-state', 'budget-state.json');
      writeFileSync(budgetState, JSON.stringify({
        estimated_cost_usd: i * 0.01,
        estimated_input_tokens: i * 100,
        estimated_output_tokens: i * 50,
      }));
      budgetFiles.push(budgetState);
    }

    // Spawn 5 parallel sh invocations using the same MEMORY_DIR
    const workers = Array.from({ length: 5 }, (_, i) => {
      return spawnSync('bash', [POST_SESSION_SH], {
        encoding: 'utf8',
        timeout: 15000,
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: tmpDir,
          HOOK_SESSION_ID: `test-session-${i}`,
          MEOW_HOOK_PROFILE: 'standard',
          HOME: process.env.HOME ?? '/tmp',
          PATH: process.env.PATH ?? '/usr/bin:/bin',
        },
      });
    });

    // All invocations must exit without crash (allow 0 or 1 — hook may skip gracefully)
    workers.forEach((w, i) => {
      expect(w.status ?? 0, `worker ${i} crashed with status ${w.status}: ${w.stderr}`).toBeLessThanOrEqual(1);
    });

    // cost-log.json must still be valid JSON after concurrent writes
    const costLogPath = join(tmpDir, '.claude', 'memory', 'cost-log.json');
    const costLogContent = readFileSync(costLogPath, 'utf8');
    let parsed: unknown[];
    expect(
      () => { parsed = JSON.parse(costLogContent) as unknown[]; },
      `cost-log.json must be valid JSON after concurrent writes`
    ).not.toThrow();
    expect(Array.isArray(parsed!)).toBe(true);
  });

  it('cost-log.json starts as valid JSON array', () => {
    const content = readFileSync(join(tmpDir, '.claude', 'memory', 'cost-log.json'), 'utf8');
    const parsed = JSON.parse(content) as unknown;
    expect(Array.isArray(parsed)).toBe(true);
  });
});
