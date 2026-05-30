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

  it('post-session.sh emits the model-change flag as a trace event, not a fixes.md write', () => {
    const p = read('.claude/hooks/post-session.sh');
    expect(p).toContain('dead_weight_audit_needed');
    // The model-change flag no longer appends to the curated fixes store.
    expect(p).not.toMatch(/cat >> "\$MEMORY_DIR\/fixes\.md"/);
  });

  // NOTE: the seed-from-md → architecture-decisions.json population is covered by
  // seed-from-md.test.ts with tmp fixtures. It is NOT asserted here because
  // `.claude/memory/*` is gitignored (machine-local), so the live store is absent in
  // a fresh checkout / CI. Characterization here pins committed wiring only.
});

describe('Audit-lock: trace-log canonical stream', () => {
  it('append-trace.sh is the trace writer; callers are post-session + learning-observer', () => {
    expect(existsSync(resolve(root, '.claude/hooks/append-trace.sh'))).toBe(true);
    expect(read('.claude/hooks/post-session.sh')).toContain('append-trace');
    expect(read('.claude/hooks/learning-observer.sh')).toContain('append-trace');
  });
});

describe('Audit-lock: telemetry classification', () => {
  it('hook-log.jsonl HAS a code reader (telemetry-decisions.py) and is NOT debug-gated', () => {
    expect(read('scripts/telemetry-decisions.py')).toContain('hook-log.jsonl');
    // hook-logger.sh must keep writing unconditionally (its reader needs the data).
    expect(read('.claude/hooks/lib/hook-logger.sh')).not.toContain('MEOWKIT_HOOK_DEBUG');
  });

  it('learning-observer churn record is debug-gated; file_edited trace stays unconditional', () => {
    const obs = read('.claude/hooks/learning-observer.sh');
    // The churn printf is guarded by MEOWKIT_HOOK_DEBUG.
    expect(obs).toMatch(/MEOWKIT_HOOK_DEBUG[\s\S]*"type":"churn"/);
    // The canonical file_edited trace emission is NOT behind the debug gate.
    expect(obs).toContain('append-trace.sh');
    expect(obs).toContain('file_edited');
  });

  it('trace-log.jsonl is documented as the single canonical event stream', () => {
    const idx = read('.claude/hooks/HOOKS_INDEX.md');
    expect(idx).toContain('trace-log.jsonl');
    expect(idx).toMatch(/canonical.*event stream/i);
  });
});

describe('inert cost-meter retired; budget-tracker is the live writer', () => {
  it('cost-meter.sh is deleted and de-registered from settings.json', () => {
    expect(existsSync(resolve(root, '.claude/hooks/cost-meter.sh'))).toBe(false);
    expect(read('.claude/settings.json')).not.toContain('cost-meter.sh');
  });

  it('the live per-Bash cost path (dispatch.cjs Bash -> budget-tracker.cjs) is intact', () => {
    expect(read('.claude/settings.json')).toMatch(/dispatch\.cjs\\" PostToolUse Bash/);
    expect(existsSync(resolve(root, '.claude/hooks/handlers/budget-tracker.cjs'))).toBe(true);
  });
});

describe('conversation-summary subsystem fully removed', () => {
  it('cache hook + command + cache file are deleted', () => {
    expect(existsSync(resolve(root, '.claude/hooks/conversation-summary-cache.sh'))).toBe(false);
    expect(existsSync(resolve(root, '.claude/commands/mk/summary.md'))).toBe(false);
    expect(existsSync(resolve(root, '.claude/memory/conversation-summary.md'))).toBe(false);
  });

  it('no settings.json registration, env default, or env-example var remains', () => {
    expect(read('.claude/settings.json')).not.toContain('conversation-summary-cache.sh');
    expect(read('.claude/settings.json')).not.toContain('MEOWKIT_SUMMARY');
    expect(read('.claude/.env.example')).not.toContain('MEOWKIT_SUMMARY');
  });

  it('Stop + UserPromptSubmit still dispatch via dispatch.cjs (other hooks intact)', () => {
    const settings = read('.claude/settings.json');
    // settings.json escapes the inner quote, so match dispatch.cjs + the event name.
    expect(settings).toMatch(/dispatch\.cjs\\" Stop/);
    expect(settings).toMatch(/dispatch\.cjs\\" UserPromptSubmit/);
  });

  it('harness Rule 11 is gone and project-context-loader no longer clears a summary cache', () => {
    expect(read('.claude/rules/harness-rules.md')).not.toContain('## Rule 11');
    expect(read('.claude/hooks/project-context-loader.sh')).not.toContain('conversation-summary');
  });
});

describe('session-state retirement outcomes', () => {
  it('the dead active-skill reader has been removed from pre-completion-check', () => {
    expect(read('.claude/hooks/pre-completion-check.sh')).not.toContain('active-skill');
  });

  it('build-progress.json is kept (live harness-resume feature in the developer agent)', () => {
    // The re-scan proved a live agent-prose producer/consumer, so it is NOT retired.
    expect(read('.claude/agents/developer.md')).toContain('build-progress.json');
  });
});
