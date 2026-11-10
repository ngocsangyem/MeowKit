// producer-consumer-characterization.test.ts
// Audit-lock characterization: pins the verified writer→reader wiring of the
// session-state and telemetry planes so an accidental break (e.g. during retirement)
// is caught. These assertions encode the frozen baseline — if one fails, either the
// wiring genuinely moved (update the baseline + this test together) or a regression
// slipped in. No behavior is exercised; these are static-wiring guards.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const root = process.cwd();
const read = (rel: string): string => readFileSync(resolve(root, rel), 'utf8');

describe('Audit-lock: trace-log canonical stream', () => {
  it('append-trace.cjs is the trace writer; callers are post-session + learning-observer', () => {
    expect(existsSync(resolve(root, '.claude/hooks/append-trace.cjs'))).toBe(true);
    expect(read('.claude/hooks/handlers/post-session.cjs')).toContain('appendTrace');
    expect(read('.claude/hooks/handlers/learning-observer.cjs')).toContain('appendTrace');
  });
});

describe('Audit-lock: telemetry classification', () => {
  it('hook-log.jsonl HAS a code reader (telemetry-decisions.py) and is NOT debug-gated', () => {
    expect(read('scripts/telemetry-decisions.py')).toContain('hook-log.jsonl');
    // hook-logger.cjs must keep writing unconditionally (its reader needs the data).
    expect(read('.claude/hooks/lib/hook-logger.cjs')).not.toContain('MEOWKIT_HOOK_DEBUG');
  });

  it('learning-observer churn record is debug-gated; file_edited trace stays unconditional', () => {
    const obs = read('.claude/hooks/handlers/learning-observer.cjs');
    // The churn printf is guarded by MEOWKIT_HOOK_DEBUG.
    expect(obs).toMatch(/MEOWKIT_HOOK_DEBUG[\s\S]*"type":"churn"/);
    // The canonical file_edited trace emission is NOT behind the debug gate.
    expect(obs).toContain('trace-log.cjs');
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
    expect(read('.claude/settings.json')).toMatch(/dispatch\.cjs",\s*"PostToolUse",\s*"Bash"/);
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
    expect(read('.meowkit/.env.example')).not.toContain('MEOWKIT_SUMMARY');
  });

  it('Stop + UserPromptSubmit still dispatch via dispatch.cjs (other hooks intact)', () => {
    const settings = read('.claude/settings.json');
    // settings.json escapes the inner quote, so match dispatch.cjs + the event name.
    expect(settings).toMatch(/dispatch\.cjs",\s*"Stop"/);
    expect(settings).toMatch(/dispatch\.cjs",\s*"UserPromptSubmit"/);
  });

  it('harness Rule 11 is gone and project-context-loader no longer clears a summary cache', () => {
    expect(read('.claude/skills/cook/references/harness-rules.md')).not.toContain('## Rule 11');
    expect(read('.claude/hooks/handlers/project-context-loader.cjs')).not.toContain('conversation-summary');
  });
});

describe('session-state retirement outcomes', () => {
  it('the dead active-skill reader has been removed from pre-completion-check', () => {
    expect(read('.claude/hooks/handlers/pre-completion-check.cjs')).not.toContain('active-skill');
  });

  it('build-progress.json is kept (live harness-resume feature in the developer agent)', () => {
    // The re-scan proved a live agent-prose producer/consumer, so it is NOT retired.
    expect(read('.claude/agents/developer.md')).toContain('build-progress.json');
  });
});
