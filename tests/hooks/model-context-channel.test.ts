// model-context-channel.test.ts — text meant for the model reaches it in the form the host reads.
//
// Claude Code keeps plain stdout from PreToolUse/PostToolUse in the transcript and does not
// show it to the model; `hookSpecificOutput.additionalContext` is the documented field that
// does. On UserPromptSubmit and SessionStart plain stdout already reaches the model. When an
// observer exits 2 the host ignores stdout JSON and shows stderr, so context must go there.

import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const HOOKS = path.join(REPO_ROOT, '.claude/hooks');

type Source = { name: string; source?: string };

/** A throwaway tree with the real dispatcher and lib; `source` absent copies the shipped handler. */
function tree(handlers: Source[], event: string, matcher?: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-context-'));
  fs.cpSync(path.join(HOOKS, 'dispatch.cjs'), path.join(dir, '.claude/hooks/dispatch.cjs'));
  fs.cpSync(path.join(HOOKS, 'lib'), path.join(dir, '.claude/hooks/lib'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.claude/hooks/handlers'), { recursive: true });
  const entries = handlers.map((h) => {
    const target = path.join(dir, '.claude/hooks/handlers', `${h.name}.cjs`);
    if (h.source) fs.writeFileSync(target, h.source);
    else fs.copyFileSync(path.join(HOOKS, 'handlers', `${h.name}.cjs`), target);
    return { event, ...(matcher ? { matcher } : {}), handler: `./handlers/${h.name}.cjs`, toggleKey: h.name };
  });
  fs.writeFileSync(path.join(dir, '.claude/hooks/handlers.json'), JSON.stringify({ schema: 2, handlers: entries }));
  return dir;
}

function dispatch(dir: string, event: string, matcher: string, payload: object) {
  const r = spawnSync(process.execPath, [path.join(dir, '.claude/hooks/dispatch.cjs'), event, matcher], {
    cwd: dir,
    input: JSON.stringify({ session_id: 'context-test', cwd: dir, ...payload }),
    env: { CLAUDE_PROJECT_DIR: dir, HOME: dir, PATH: process.env.PATH ?? '' },
    encoding: 'utf8',
  });
  return { exit: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function additionalContext(stdout: string): string | null {
  if (!stdout.trim().startsWith('{')) return null;
  return (JSON.parse(stdout) as { hookSpecificOutput?: { additionalContext?: string } }).hookSpecificOutput?.additionalContext ?? null;
}

const CONTEXT = `module.exports = () => ({ context: 'act on this' });\n`;
const PLAIN = `module.exports = () => 'transcript line\\n';\n`;
const EXIT_TWO = `module.exports = () => ({ stderr: 'build failed\\n', exitCode: 2, feedback: true });\n`;

describe('the dispatcher maps context to the host channel', () => {
  it('on a tool event, context is additionalContext and other stdout stays user-visible', () => {
    const dir = tree([{ name: 'ctx', source: CONTEXT }, { name: 'plain', source: PLAIN }], 'PostToolUse', 'Edit|Write');
    const r = dispatch(dir, 'PostToolUse', 'Edit|Write', { tool_name: 'Edit', tool_input: { file_path: 'a.ts' } });
    expect(r.exit).toBe(0);
    expect(JSON.parse(r.stdout)).toEqual({
      hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: 'act on this' },
      systemMessage: 'transcript line',
    });
  });

  it('a Stop decision stays parseable when an observer also returns context', () => {
    const decision = `module.exports = () => ({ stdout: JSON.stringify({ decision: 'block', reason: 'finish' }), feedback: true });\n`;
    const dir = tree([{ name: 'ctx', source: CONTEXT }, { name: 'stop', source: decision }], 'Stop');
    const r = dispatch(dir, 'Stop', '', {});
    expect(JSON.parse(r.stdout)).toEqual({ decision: 'block', reason: 'finish' });
    expect(r.stderr).toMatch(/Stop has no model-visible field.*act on this/);
  });

  it('on UserPromptSubmit with a JSON document, plain stdout and context both stay model-visible', () => {
    const decision = `module.exports = () => ({ stdout: JSON.stringify({ suppressOutput: false }), feedback: true });\n`;
    const dir = tree([{ name: 'ctx', source: CONTEXT }, { name: 'plain', source: PLAIN }, { name: 'doc', source: decision }], 'UserPromptSubmit');
    const r = dispatch(dir, 'UserPromptSubmit', '', { prompt: 'hi' });
    const out = JSON.parse(r.stdout) as { hookSpecificOutput: { additionalContext: string }; systemMessage?: string };
    expect(out.hookSpecificOutput.additionalContext).toBe('transcript line\n\nact on this');
    expect(out.systemMessage).toBeUndefined();
  });

  it('caps model-visible text at the host limit and ignores whitespace-only context', () => {
    const long = `module.exports = () => ({ context: 'y'.repeat(12000) });\n`;
    const blank = `module.exports = () => ({ context: '   ' });\n`;
    const dir = tree([{ name: 'long', source: long }], 'PostToolUse', 'Edit|Write');
    const text = additionalContext(dispatch(dir, 'PostToolUse', 'Edit|Write', { tool_name: 'Edit' }).stdout) ?? '';
    expect(text.length).toBeLessThanOrEqual(10000);
    expect(text.endsWith('[truncated]')).toBe(true);
    const quiet = tree([{ name: 'blank', source: blank }], 'PostToolUse', 'Edit|Write');
    expect(dispatch(quiet, 'PostToolUse', 'Edit|Write', { tool_name: 'Edit' }).stdout).toBe('');
  });

  it('when another observer exits 2, context joins stderr, which the host shows', () => {
    const dir = tree([{ name: 'ctx', source: CONTEXT }, { name: 'fail', source: EXIT_TWO }], 'PostToolUse', 'Edit|Write');
    const r = dispatch(dir, 'PostToolUse', 'Edit|Write', { tool_name: 'Edit', tool_input: { file_path: 'a.ts' } });
    expect(r.exit).toBe(2);
    expect(r.stderr).toContain('build failed');
    expect(r.stderr).toContain('act on this');
    expect(r.stdout).toBe('');
  });

  it('on an event whose stdout the model reads, context is plain stdout', () => {
    const dir = tree([{ name: 'ctx', source: CONTEXT }], 'UserPromptSubmit');
    const r = dispatch(dir, 'UserPromptSubmit', '', { prompt: 'hi' });
    expect(r.exit).toBe(0);
    expect(r.stdout.trim()).toBe('act on this');
  });
});

describe('shipped observers', () => {
  it('loop-detection reminds the model at the threshold, not on every edit', () => {
    const dir = tree([{ name: 'loop-detection' }], 'PostToolUse', 'Edit|Write');
    fs.writeFileSync(path.join(dir, 'a.ts'), 'x');
    const edit = () => dispatch(dir, 'PostToolUse', 'Edit|Write', { tool_name: 'Edit', tool_input: { file_path: path.join(dir, 'a.ts') } });
    const said = Array.from({ length: 9 }, () => additionalContext(edit().stdout));
    expect(said.map((c) => c !== null)).toEqual([false, false, false, true, false, false, false, true, false]);
    expect(said[3]).toMatch(/edited 4 times/);
    expect(said[7]).toMatch(/edited 8 times.*re-plan/s);
  });

  it('post-write sends warning-only findings to the model, exit 0', () => {
    const dir = tree([{ name: 'post-write' }], 'PostToolUse', 'Edit|Write');
    const file = path.join(dir, 'a.ts');
    fs.writeFileSync(file, 'export const port = process.env.PORT;\n');
    const r = dispatch(dir, 'PostToolUse', 'Edit|Write', { tool_name: 'Write', tool_input: { file_path: file } });
    expect(r.exit).toBe(0);
    expect(additionalContext(r.stdout)).toMatch(/Security scan warnings in a\.ts[\s\S]*process\.env without validation/);
  });

  it('budget-tracker notice stays user-visible when another observer speaks to the model', () => {
    const dir = tree([{ name: 'budget-tracker' }, { name: 'post-write' }], 'PostToolUse', 'Edit|Write');
    fs.mkdirSync(path.join(dir, '.meowkit'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.meowkit/config.yaml'), 'budget:\n  warn: 0\n');
    const file = path.join(dir, 'a.ts');
    fs.writeFileSync(file, `export const port = process.env.PORT; // ${'x'.repeat(4000)}\n`);
    const r = dispatch(dir, 'PostToolUse', 'Edit|Write', { tool_name: 'Write', tool_input: { file_path: file }, tool_response: 'x'.repeat(4000) });
    const out = JSON.parse(r.stdout) as { hookSpecificOutput: { additionalContext: string }; systemMessage: string };
    expect(out.systemMessage).toContain('Estimated cost');
    expect(out.hookSpecificOutput.additionalContext).not.toContain('Estimated cost');
  });

  it('budget-tracker keeps its spend figure out of the model channel', () => {
    const dir = tree([{ name: 'budget-tracker' }], 'PostToolUse', 'Bash');
    fs.mkdirSync(path.join(dir, '.meowkit'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.meowkit/config.yaml'), 'budget:\n  warn: 0\n');
    const r = dispatch(dir, 'PostToolUse', 'Bash', { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: 'x'.repeat(4000) });
    expect(r.exit).toBe(0);
    expect(r.stdout).toContain('Estimated cost');
    expect(additionalContext(r.stdout)).toBeNull();
    expect(r.stdout).not.toMatch(/\bBLOCK\b/);
  });
});
