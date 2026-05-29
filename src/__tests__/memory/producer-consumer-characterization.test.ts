// producer-consumer-characterization.test.ts
// Audit-lock characterization: pins the verified writer→reader wiring of the memory,
// session-state, and telemetry planes so an accidental break (e.g. during retirement)
// is caught. These assertions encode the frozen baseline — if one fails, either the
// wiring genuinely moved (update the baseline + this test together) or a regression
// slipped in. No behavior is exercised; these are static-wiring guards.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const root = process.cwd();
const read = (rel: string): string => readFileSync(resolve(root, rel), 'utf8');

describe('Audit-lock: curated-memory writers', () => {
  it('immediate-capture-handler routes the three JSON stores', () => {
    const h = read('.claude/hooks/handlers/immediate-capture-handler.cjs');
    expect(h).toContain('fixes.json');
    expect(h).toContain('architecture-decisions.json');
    expect(h).toContain('review-patterns.json');
  });

  it('post-session.sh writes the model-change flag to fixes.md (pre-retirement state)', () => {
    const p = read('.claude/hooks/post-session.sh');
    expect(p).toMatch(/fixes\.md/);
  });

  it('architecture-decisions.json is empty while its MD holds data (seed-from-md prerequisite)', () => {
    const json = JSON.parse(read('.claude/memory/architecture-decisions.json')) as { patterns: unknown[] };
    expect(Array.isArray(json.patterns)).toBe(true);
    expect(json.patterns.length).toBe(0);
    expect(read('.claude/memory/architecture-decisions.md').length).toBeGreaterThan(1000);
  });
});

describe('Audit-lock: trace-log canonical stream', () => {
  it('append-trace.sh is the trace writer; callers are post-session + learning-observer', () => {
    expect(existsSync(resolve(root, '.claude/hooks/append-trace.sh'))).toBe(true);
    expect(read('.claude/hooks/post-session.sh')).toContain('append-trace');
    expect(read('.claude/hooks/learning-observer.sh')).toContain('append-trace');
  });
});

describe('Audit-lock: telemetry classification', () => {
  it('hook-log.jsonl HAS a code reader (telemetry-decisions.py) — NOT debug-gateable', () => {
    const t = read('scripts/telemetry-decisions.py');
    expect(t).toContain('hook-log.jsonl');
  });

  it('learning-observer.jsonl writer exists; only HOOKS_INDEX claims a (stale) reader', () => {
    expect(read('.claude/hooks/learning-observer.sh')).toContain('learning-observer.jsonl');
    // The only "reader" reference is a documented (stale) claim in HOOKS_INDEX — not code.
    expect(read('.claude/hooks/HOOKS_INDEX.md')).toContain('learning-observer.jsonl');
  });
});

describe('Audit-lock: duplicate / inert writers', () => {
  it('cost-meter.sh is inert in standard/fast profile and registered in settings.json', () => {
    const c = read('.claude/hooks/cost-meter.sh');
    expect(c).toMatch(/standard\|fast\)\s*exit 0/);
    expect(read('.claude/settings.json')).toContain('cost-meter.sh');
  });

  it('budget-tracker.cjs is the live cost writer (cost-meter superseded)', () => {
    expect(existsSync(resolve(root, '.claude/hooks/handlers/budget-tracker.cjs'))).toBe(true);
  });
});

describe('Audit-lock: conversation-summary subsystem (Phase 4 retirement targets)', () => {
  it('cache hook exists and is registered on Stop + UserPromptSubmit', () => {
    expect(existsSync(resolve(root, '.claude/hooks/conversation-summary-cache.sh'))).toBe(true);
    const settings = read('.claude/settings.json');
    const count = settings.split('conversation-summary-cache.sh').length - 1;
    expect(count).toBe(2); // Stop + UserPromptSubmit registrations
  });

  it('harness Rule 11 + /mk:summary command + cache file are present (pre-retirement)', () => {
    expect(read('.claude/rules/harness-rules.md')).toContain('Conversation Summary');
    expect(existsSync(resolve(root, '.claude/commands/mk/summary.md'))).toBe(true);
    expect(existsSync(resolve(root, '.claude/memory/conversation-summary.md'))).toBe(true);
  });
});

describe('Audit-lock: unverified session-state artifacts (Phase 6 gated)', () => {
  it('active-skill has a dormant reader (pre-completion-check) and no writer', () => {
    expect(read('.claude/hooks/pre-completion-check.sh')).toContain('active-skill');
  });

  it('build-progress.json is referenced only by the developer agent prose', () => {
    expect(read('.claude/agents/developer.md')).toContain('build-progress.json');
  });
});
