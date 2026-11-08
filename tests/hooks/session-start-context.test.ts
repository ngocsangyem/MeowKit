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
import { createRequire } from 'node:module';

import { loadHandler, project, REPO_ROOT, text } from './lib/handler-fixtures';

const require_ = createRequire(import.meta.url);
const { configValue, isObserverEnabled } = require_(path.join(REPO_ROOT, '.claude/hooks/lib/read-config.cjs')) as {
  configValue: (key: string, fallback: unknown, options: { root: string }) => { value: unknown; level: string };
  isObserverEnabled: (name: string, options: { root: string }) => boolean;
};
const { isTddEnabled } = require_(path.join(REPO_ROOT, '.claude/hooks/lib/tdd-detect.cjs')) as {
  isTddEnabled: (options: { root: string; env: Record<string, string> }) => { enabled: boolean; source: string };
};

describe('session-start context injection', () => {
  const loader = loadHandler('project-context-loader');
  const env = {} as NodeJS.ProcessEnv;
  /** The size cap is a committed preference now, so a fixture sets it in the config. */
  const withCap = (root: string, bytes: number): void => {
    fs.mkdirSync(path.join(root, '.meowkit'), { recursive: true });
    fs.writeFileSync(path.join(root, '.meowkit/config.yaml'), `projectContext:\n  maxBytes: ${bytes}\n`);
  };

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
    withCap(root, 20);
    const out = text(loader({ root, session_id: 's3' }, undefined, env));
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

  // A clone of a project whose `.claude/` is committed has every hook and no CLI.
  // The gates do not care, but the checks that call it skip, so the absence has to
  // be said out loud — once, and naming the command that explains it.
  it('names `mewkit doctor` when no CLI can be resolved, once per session', () => {
    const root = project({ '.claude/hooks/dispatch.cjs': '' });
    const noCli = { PATH: path.join(root, 'nowhere') } as NodeJS.ProcessEnv;
    const first = text(loader({ root, session_id: 'clone' }, undefined, noCli));
    expect(first).toContain('## MeowKit CLI not available');
    expect(first).toContain('mewkit doctor');
    expect(first.split('mewkit doctor')).toHaveLength(2);

    // A resume or a compaction re-runs the handler under the same session id.
    const again = text(loader({ root, session_id: 'clone' }, undefined, noCli));
    expect(again).not.toContain('## MeowKit CLI not available');
  });

  it('says nothing about the CLI when one is resolvable', () => {
    const root = project({ '.claude/hooks/dispatch.cjs': '', 'node_modules/.bin/mewkit': '#!/bin/sh\n' });
    const out = text(loader({ root, session_id: 'installed' }, undefined, { PATH: path.join(root, 'nowhere') } as NodeJS.ProcessEnv));
    expect(out).not.toContain('## MeowKit CLI not available');
  });

  // The config block is the only description of these settings an agent gets,
  // and it is read before the first turn. Built from the environment it reported
  // the INVERSE of a config-driven project's own state — "TDD: off (default)" to
  // a session the gate was about to enforce strict mode on — so each row is
  // asserted against the reader the handlers themselves resolve from.
  const configured = (yaml: string): string => {
    const root = project({ '.claude/hooks/dispatch.cjs': '' });
    fs.mkdirSync(path.join(root, '.meowkit'), { recursive: true });
    fs.writeFileSync(path.join(root, '.meowkit/config.yaml'), yaml);
    // The observer names come from the project's own registry, so a fixture
    // without one would see every `hooks.<name>` key as unknown.
    fs.copyFileSync(path.join(REPO_ROOT, '.claude/hooks/handlers.json'), path.join(root, '.claude/hooks/handlers.json'));
    return root;
  };

  it('reports the effective config row for row, not the environment', () => {
    const root = configured('tdd: true\nhooks:\n  build-verify: false\n  loop-detection: false\nbudget:\n  cap: 20\n');
    const out = text(loader({ root, session_id: 'cfg-on' }, undefined, env));

    expect(out).toContain('- TDD: **enabled** (strict red-green-refactor) (.meowkit/config.yaml)');
    expect(out).toContain('- Build verify: **disabled** (.meowkit/config.yaml)');
    expect(out).toContain('- Loop detection: **disabled** (.meowkit/config.yaml)');
    expect(out).toContain('- Budget cap: **$20** per run (.meowkit/config.yaml)');

    // Agreement with the reader, not merely a plausible string: the block and
    // the enforcement paths must answer from the same resolution.
    expect(isTddEnabled({ root, env: {} }).enabled, 'the gate and the block disagree on strict mode').toBe(true);
    for (const name of ['build-verify', 'loop-detection']) {
      expect(isObserverEnabled(name, { root }), `${name} disagrees with the block`).toBe(false);
    }
    expect(configValue('budget.cap', 0, { root }).value).toBe(20);
  });

  it('says default, and says the real precedence, when nothing is configured', () => {
    const root = configured('');
    const out = text(loader({ root, session_id: 'cfg-off' }, undefined, env));
    expect(out).toContain('- TDD: off (default)');
    expect(out).toContain('- Build verify: on (default)');
    expect(out).toContain('- Loop detection: on (default)');
    expect(out).toContain('- Budget cap: none (default)');
    expect(out, 'the footer must not describe a precedence the kit no longer has').not.toContain('settings.json');
    expect(out).toContain('`.meowkit/config.yaml` → `~/.meowkit/config.yaml`');
  });

  it('names the environment override when one answers over the config', () => {
    const root = configured('tdd: false\n');
    const out = text(loader({ root, session_id: 'cfg-env' }, undefined, { MEOWKIT_TDD: '1' } as NodeJS.ProcessEnv));
    expect(out).toContain('- TDD: **enabled** (strict red-green-refactor) (environment override)');
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
