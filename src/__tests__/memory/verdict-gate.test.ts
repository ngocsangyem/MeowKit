// verdict-gate.test.ts — Phase 6.5 workflow proof-bundle gate. A valid
// PASS/PASS_WITH_RISK verdict passes; BLOCKED/invalid/missing blocks; a legacy
// markdown-only verdict is tolerated during the transition window.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { evaluateVerdictGate, VerdictSchema } from '../../../packages/mewkit/src/memory/verdict-schema.js';

let root: string;
let prevCwd: string;

const VALID = {
  schema_version: '1.0',
  slug: 'demo',
  gate: 'review',
  decision: 'PASS',
  dimensions: [{ name: 'Correctness', verdict: 'PASS' }],
  evidence_refs: ['tasks/reviews/demo-verdict.md'],
  created_at: '2026-05-30T00:00:00Z',
};

function writeVerdict(slug: string, obj: unknown): void {
  writeFileSync(join(root, 'tasks', 'reviews', `${slug}-verdict.json`), JSON.stringify(obj));
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'meow-verdict-'));
  mkdirSync(join(root, 'tasks', 'reviews'), { recursive: true });
  prevCwd = process.cwd();
  process.chdir(root); // gate resolves tasks/reviews/ relative to cwd
});
afterEach(() => {
  process.chdir(prevCwd);
  rmSync(root, { recursive: true, force: true });
});

describe('evaluateVerdictGate (Phase 6.5)', () => {
  it('passes a valid PASS verdict', () => {
    writeVerdict('demo', VALID);
    const r = evaluateVerdictGate('demo');
    expect(r.ok).toBe(true);
    expect(r.status).toBe('pass');
    expect(r.decision).toBe('PASS');
  });

  it('passes PASS_WITH_RISK', () => {
    writeVerdict('demo', { ...VALID, decision: 'PASS_WITH_RISK' });
    expect(evaluateVerdictGate('demo').ok).toBe(true);
  });

  it('blocks on BLOCKED', () => {
    writeVerdict('demo', { ...VALID, decision: 'BLOCKED' });
    const r = evaluateVerdictGate('demo');
    expect(r.ok).toBe(false);
    expect(r.status).toBe('blocked');
  });

  it('blocks on an invalid decision enum', () => {
    writeVerdict('demo', { ...VALID, decision: 'MAYBE' });
    const r = evaluateVerdictGate('demo');
    expect(r.ok).toBe(false);
    expect(r.status).toBe('invalid');
  });

  it('blocks on malformed JSON', () => {
    writeFileSync(join(root, 'tasks', 'reviews', 'demo-verdict.json'), '{ broken');
    const r = evaluateVerdictGate('demo');
    expect(r.ok).toBe(false);
    expect(r.status).toBe('invalid');
  });

  it('blocks when neither JSON nor markdown verdict exists', () => {
    const r = evaluateVerdictGate('ghost');
    expect(r.ok).toBe(false);
    expect(r.status).toBe('missing');
  });

  it('tolerates a legacy markdown-only verdict during transition', () => {
    writeFileSync(join(root, 'tasks', 'reviews', 'legacy-verdict.md'), '# verdict\nOverall: PASS\n');
    const r = evaluateVerdictGate('legacy');
    expect(r.ok).toBe(true);
    expect(r.status).toBe('legacy-md');
  });

  it('accepts an explicit path argument', () => {
    writeVerdict('demo', VALID);
    const r = evaluateVerdictGate('tasks/reviews/demo-verdict.json');
    expect(r.ok).toBe(true);
  });

  it('schema requires the load-bearing fields', () => {
    expect(VerdictSchema.safeParse({ decision: 'PASS' }).success).toBe(false);
    expect(VerdictSchema.safeParse(VALID).success).toBe(true);
  });
});
