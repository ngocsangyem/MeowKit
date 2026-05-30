// no-injection.test.ts — observability/telemetry must never be injected
// into model prompt context. The only former auto-injection (the conversation-summary
// subsystem) was retired, so NO MeowKit hook should now emit memory/telemetry file
// contents into stdout on a context-injection event (SessionStart / UserPromptSubmit).
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf-8');

// Files that are telemetry/observability or curated data — none may be catted into
// a prompt-injection path.
const NEVER_INJECTED = [
  'trace-log.jsonl',
  'learning-observer.jsonl',
  'hook-log.jsonl',
  'cost-log.json',
];

// Hooks that write to stdout on a context-injection event (their stdout reaches the model).
const INJECTION_PATH_HOOKS = [
  '.claude/hooks/project-context-loader.sh', // SessionStart — emits the Config block
  '.claude/hooks/tdd-flag-detector.sh', // UserPromptSubmit
];

describe('no context pollution', () => {
  it('the conversation-summary auto-injection is fully removed', () => {
    expect(existsSync(resolve(root, '.claude/hooks/conversation-summary-cache.sh'))).toBe(false);
    const settings = read('.claude/settings.json');
    expect(settings).not.toContain('conversation-summary-cache.sh');
  });

  it.each(INJECTION_PATH_HOOKS)('%s does not read any telemetry file into stdout', (hook) => {
    if (!existsSync(resolve(root, hook))) return; // tolerate optional hooks
    const src = read(hook);
    for (const file of NEVER_INJECTED) {
      expect(src.includes(file), `${hook} references ${file}`).toBe(false);
    }
  });

  it('telemetry files keep their writers (data is logged, just never injected)', () => {
    // hook-log.jsonl still written (its telemetry-decisions.py reader needs it).
    expect(read('.claude/hooks/lib/hook-logger.sh')).toContain('hook-log.jsonl');
    // trace-log via append-trace.sh remains the canonical stream.
    expect(existsSync(resolve(root, '.claude/hooks/append-trace.sh'))).toBe(true);
  });

  it('learning-observer only the churn record is gated; it is not an injection source', () => {
    const obs = read('.claude/hooks/learning-observer.sh');
    // It writes to session-state, never to stdout-as-context.
    expect(obs).not.toMatch(/printf[^\n]*learning-observer[^\n]*>&1/);
  });
});
