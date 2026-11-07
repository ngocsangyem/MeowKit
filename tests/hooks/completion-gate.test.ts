// completion-gate.test.ts — refusing to end a session without verification, and
// the cases where refusing would be wrong.
//
// This gate answers with a decision rather than a failing exit, and it is routed
// through a fail-open chain, so both halves need holding down: the block has to
// survive the chain, and the many "do not block" cases have to stay
// non-blocking. A gate that blocks a session it does not govern is the failure
// that gets it switched off.
//
// These assertions carry over from the shell regression test for the same hook.

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require_ = createRequire(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

type Result = { stdout?: string; stderr?: string; feedback?: boolean } | null;
type Handler = (ctx: { root: string; session_id?: string }) => Result;

function loadHandler(): Handler {
  const mod: unknown = require_(path.join(REPO_ROOT, '.claude/hooks/handlers/pre-completion-check.cjs'));
  if (typeof mod !== 'function') throw new Error('pre-completion-check.cjs does not export a handler');
  return mod as Handler;
}

const SLUG = 'demo-task';
const PLAN_DIR = `tasks/plans/261101-${SLUG}`;

function project(files: Record<string, string> = {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-completion-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return dir;
}

const VERIFICATION_REQUIRED = JSON.stringify({ required: true, slug: `261101-${SLUG}` });
const ACTIVE_PLAN = JSON.stringify({ path: PLAN_DIR });

const PASSING_VERDICT = ['# Verdict', '', 'Score: 9/10', '', '| Functionality | PASS |', '', 'Critical (0)', ''].join('\n');
const FAILING_SECURITY = ['# Security Verdict', '', 'Score: 4/10', '', '| Security | FAIL |', '', 'Critical (0)', ''].join('\n');
const SIGNED_CONTRACT = ['---', 'status: signed', '---', '', '# Contract', ''].join('\n');

const decision = (result: Result): { decision?: string; reason?: string } =>
  (result && result.stdout ? JSON.parse(result.stdout) : {});

describe('a session with no verification obligation may end', () => {
  const handler = loadHandler();

  it('allows a plan-only session with no requirement marker', () => {
    const root = project({ [`${PLAN_DIR}/plan.md`]: '# plan\n' });
    expect(handler({ root, session_id: 's1' })).toBeNull();
  });

  it('allows a session whose marker says verification is not required', () => {
    const root = project({ 'session-state/verification-required.json': JSON.stringify({ required: false }) });
    expect(handler({ root, session_id: 's2' })).toBeNull();
  });

  it('allows a session whose marker names no plan, and says why', () => {
    const root = project({ 'session-state/verification-required.json': JSON.stringify({ required: true }) });
    const result = handler({ root, session_id: 's3' });
    expect(result?.stdout ?? '').toBe('');
    expect(result?.stderr ?? '').toContain('active plan slug missing');
  });
});

describe('a session that owes verification is blocked until it has some', () => {
  const handler = loadHandler();

  const required = () => project({
    'session-state/verification-required.json': VERIFICATION_REQUIRED,
    'session-state/active-plan.json': ACTIVE_PLAN,
    [`${PLAN_DIR}/plan.md`]: '# plan\n',
  });

  it('blocks when no evidence exists, and counts the attempt', () => {
    const root = required();
    const result = handler({ root, session_id: 's4' });
    expect(decision(result).decision).toBe('block');
    expect(decision(result).reason).toContain('attempt 1/3');
    expect(result?.feedback, 'the decision must survive the chain').toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(root, 'session-state/precompletion-attempts.json'), 'utf8'))).toEqual({ [SLUG]: 1 });
  });

  it('gives up after the third attempt rather than looping forever', () => {
    const root = required();
    for (let i = 1; i <= 3; i += 1) {
      expect(decision(handler({ root, session_id: `s5-${i}` })).reason, `attempt ${i}`).toContain(`attempt ${i}/3`);
    }
    const past = handler({ root, session_id: 's5-4' });
    expect(past?.stdout ?? '', 'no further block').toBe('');
    expect(past?.stderr ?? '').toContain('Max PreCompletion re-entries reached');
    // The counter is cleared so the next session starts fresh rather than
    // inheriting an exhausted cap.
    expect(JSON.parse(fs.readFileSync(path.join(root, 'session-state/precompletion-attempts.json'), 'utf8'))).toEqual({});
  });

  it('allows the stop once an evaluator verdict exists, and clears the counter', () => {
    const root = required();
    handler({ root, session_id: 's6' });
    fs.mkdirSync(path.join(root, 'tasks/reviews'), { recursive: true });
    fs.writeFileSync(path.join(root, `tasks/reviews/261101-${SLUG}-evalverdict.md`), PASSING_VERDICT);

    expect(handler({ root, session_id: 's6' })).toBeNull();
    expect(JSON.parse(fs.readFileSync(path.join(root, 'session-state/precompletion-attempts.json'), 'utf8'))).toEqual({});
  });

  it('accepts a signed sprint contract as verification', () => {
    const root = required();
    fs.mkdirSync(path.join(root, 'tasks/contracts'), { recursive: true });
    fs.writeFileSync(path.join(root, `tasks/contracts/261101-${SLUG}-sprint-1.md`), SIGNED_CONTRACT);
    expect(handler({ root, session_id: 's7' })).toBeNull();
  });

  it('resolves the plan slug from a path-only pointer', () => {
    const root = project({
      'session-state/verification-required.json': JSON.stringify({ required: true }),
      'session-state/active-plan.json': ACTIVE_PLAN,
      [`${PLAN_DIR}/plan.md`]: '# plan\n',
    });
    const result = handler({ root, session_id: 's8' });
    expect(decision(result).reason, 'the slug came from the pointer path').toContain(PLAN_DIR);
  });
});

describe('a security block beats otherwise-valid evidence', () => {
  const handler = loadHandler();

  it('blocks even when an evaluator verdict is present', () => {
    const root = project({
      'session-state/verification-required.json': VERIFICATION_REQUIRED,
      'session-state/active-plan.json': ACTIVE_PLAN,
      [`${PLAN_DIR}/plan.md`]: '# plan\n',
      [`tasks/reviews/261101-${SLUG}-evalverdict.md`]: PASSING_VERDICT,
      [`tasks/reviews/261101-${SLUG}-security-verdict.md`]: FAILING_SECURITY,
    });
    const result = handler({ root, session_id: 's9' });
    expect(decision(result).decision).toBe('block');
    expect(decision(result).reason).toContain('Security verdict');
    // Nothing is counted against the attempt cap: a security finding is not a
    // missing artifact that three more tries would produce.
    expect(fs.existsSync(path.join(root, 'session-state/precompletion-attempts.json'))).toBe(false);
  });

  it('allows the stop once the security verdict passes', () => {
    const root = project({
      'session-state/verification-required.json': VERIFICATION_REQUIRED,
      'session-state/active-plan.json': ACTIVE_PLAN,
      [`${PLAN_DIR}/plan.md`]: '# plan\n',
      [`tasks/reviews/261101-${SLUG}-evalverdict.md`]: PASSING_VERDICT,
      [`tasks/reviews/261101-${SLUG}-security-verdict.md`]: PASSING_VERDICT.replace('# Verdict', '# Security Verdict'),
    });
    expect(handler({ root, session_id: 's10' })).toBeNull();
  });
});
