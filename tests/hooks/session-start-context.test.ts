// session-start-context.test.ts — the context an agent is given before its
// first turn, tested against pinned inputs rather than a recording.
//
// It could not be recorded from the shell implementation and replayed: it emits
// the content of the rule and docs trees, so a recording would be a copy of
// files this change also edits and would be stale on its own replay. The
// subject here is which blocks appear, what the size gate does, and which
// session state is cleared versus preserved.

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { loadHandler, project, text } from './lib/handler-fixtures';

describe('session-start context injection', () => {
  const loader = loadHandler('project-context-loader');
  const env = { MEOWKIT_MAX_PROJECT_CONTEXT_BYTES: '0' } as NodeJS.ProcessEnv;

  it('emits every block an agent needs to orient', () => {
    const root = project({
      'docs/project-context.md': '# Context\n\nUse pnpm.\n',
      'package.json': JSON.stringify({ scripts: { build: 'x', test: 'y', lint: 'z' } }),
      '.claude/rules/meowkit-core.md': '# core\n',
      '.claude/hooks/dispatch.cjs': '',
    });
    const out = text(loader({ root, session_id: 's1' }, undefined, env));
    for (const heading of ['## Project Context (auto-loaded)', '## Directory (depth 2)', '## Tools available', '## Package scripts', '## Agent Readiness']) {
      expect(out, heading).toContain(heading);
    }
    expect(out, 'the context file content is injected').toContain('Use pnpm.');
    expect(out, 'scripts are listed').toContain('  - build');
  });

  it('says so when the project has no context file', () => {
    const root = project({ '.claude/hooks/dispatch.cjs': '' });
    const out = text(loader({ root, session_id: 's2' }, undefined, env));
    expect(out).toContain('No project-context.md found.');
  });

  it('truncates an oversized context file instead of warning after the fact', () => {
    const root = project({ 'docs/project-context.md': 'x'.repeat(100), '.claude/hooks/dispatch.cjs': '' });
    const out = text(loader({ root, session_id: 's3' }, undefined, { MEOWKIT_MAX_PROJECT_CONTEXT_BYTES: '20' } as NodeJS.ProcessEnv));
    expect(out).toContain('Truncating to 20B.');
    expect(out).not.toContain('x'.repeat(30));
  });

  it('scores readiness from what the project actually provides', () => {
    const bare = project({ '.claude/hooks/dispatch.cjs': '' });
    expect(text(loader({ root: bare, session_id: 's4' }, undefined, env))).toContain('## Agent Readiness: 0/5');

    const ready = project({
      '.claude/rules/meowkit-core.md': '# core\n',
      '.claude/hooks/dispatch.cjs': '',
      'docs/project-context.md': '# c\n',
      'package.json': JSON.stringify({ scripts: { test: 'a', lint: 'b', typecheck: 'c' } }),
    });
    expect(text(loader({ root: ready, session_id: 's5' }, undefined, env))).toContain('## Agent Readiness: 5/5');
  });

  it('clears per-session state on a new session and leaves the plan pointer alone', () => {
    const root = project({
      '.claude/hooks/dispatch.cjs': '',
      'session-state/edit-counts.json': '{"a":3}',
      'session-state/session-sentinels.jsonl': '{"session_id":"old"}\n',
      'session-state/active-plan.json': '{"path":"tasks/plans/261101-keep-me"}',
      'session-state/precompletion-attempts.json': '{"keep-me":2}',
      '.claude/session-state/tdd-mode': 'on\n',
    });
    loader({ root, session_id: 'fresh' }, undefined, env);

    expect(fs.readFileSync(path.join(root, 'session-state/edit-counts.json'), 'utf8')).toBe('{}');
    expect(fs.readFileSync(path.join(root, 'session-state/session-sentinels.jsonl'), 'utf8')).toBe('');
    expect(fs.existsSync(path.join(root, '.claude/session-state/tdd-mode')), 'test-first sentinel cleared').toBe(false);
    // Cross-session coordination state and the attempt cap must survive, or the
    // next session loses its plan and the completion loop loses its bound.
    expect(fs.readFileSync(path.join(root, 'session-state/active-plan.json'), 'utf8')).toContain('261101-keep-me');
    expect(fs.readFileSync(path.join(root, 'session-state/precompletion-attempts.json'), 'utf8')).toBe('{"keep-me":2}');
  });

  it('leaves per-session state alone when the session has not changed', () => {
    const root = project({
      '.claude/hooks/dispatch.cjs': '',
      'session-state/last-session-id': 'same',
      'session-state/edit-counts.json': '{"a":3}',
    });
    loader({ root, session_id: 'same' }, undefined, env);
    expect(fs.readFileSync(path.join(root, 'session-state/edit-counts.json'), 'utf8')).toBe('{"a":3}');
  });
});
