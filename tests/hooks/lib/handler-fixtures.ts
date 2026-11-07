// handler-fixtures.ts — load a handler and give it a throwaway project.
//
// Shared by the suites that test a handler directly rather than through a
// recording. Loading the handler the way the dispatcher does — a CommonJS module
// exporting one callable — means a handler that stops being callable fails these
// suites too, not only the dispatched ones.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require_ = createRequire(import.meta.url);

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** What a handler may return: text for the agent, text for the log, or nothing. */
export type HandlerResult = { stdout?: string; stderr?: string; feedback?: boolean } | string | null;

export type Handler = (
  ctx: { root: string; session_id?: string },
  state?: unknown,
  extra?: unknown,
) => HandlerResult;

export function loadHandler(name: string): Handler {
  const mod: unknown = require_(path.join(REPO_ROOT, '.claude/hooks/handlers', `${name}.cjs`));
  if (typeof mod !== 'function') throw new Error(`${name}.cjs does not export a callable handler`);
  return mod as Handler;
}

/** A throwaway project seeded with the given files, keyed by repo-relative path. */
export function project(files: Record<string, string> = {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-handler-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return dir;
}

export const text = (result: HandlerResult): string => {
  if (!result) return '';
  if (typeof result === 'string') return result;
  return result.stdout ?? '';
};

export const errText = (result: HandlerResult): string =>
  (result && typeof result !== 'string' ? result.stderr ?? '' : '');
