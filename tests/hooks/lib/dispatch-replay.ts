// dispatch-replay.ts — decide how a recorded fixture is replayed.
//
// A guard, a write guard and an argv-driven module are each invoked the way they
// were recorded: run the file. An observer is not — it stopped being a file the
// host launches and became a registry entry the dispatcher calls. Replaying it
// by running the file would test code that is no longer on the real path.
//
// So an observer fixture is replayed through the dispatcher, with the registry
// narrowed to the one entry under test. Narrowing is necessary: a full registry
// would run every sibling observer for that event and their output would land in
// the comparison. The narrowing happens in the throwaway project, never in the
// kit, and it reads the REAL registry to find the entry — which also means a
// handler missing from the registry fails here.

import fs from 'node:fs';
import path from 'node:path';

import { REPO_ROOT } from './corpus-cases';

/** The registry entry shape the dispatcher reads. */
export interface RegistryEntry {
  event: string;
  handler: string;
  toggleKey: string;
  matcher?: string;
}

interface Registry {
  schema: number;
  handlers: RegistryEntry[];
}

export function readRegistry(root: string = REPO_ROOT): Registry {
  const parsed: unknown = JSON.parse(fs.readFileSync(path.join(root, '.claude/hooks/handlers.json'), 'utf8'));
  if (typeof parsed !== 'object' || parsed === null) throw new Error('handlers.json is not an object');
  const handlers = (parsed as { handlers?: unknown }).handlers;
  if (!Array.isArray(handlers)) throw new Error('handlers.json has no handlers array');
  return { schema: Number((parsed as { schema?: unknown }).schema ?? 0), handlers: handlers as RegistryEntry[] };
}

/**
 * Fixture groups whose subject is now a dispatcher entry. The value is the
 * handler file basename, which is how its registry entry is found.
 */
const DISPATCHED: Record<string, string> = {
  'observer-pre-task-check': 'pre-task-check',
  'observer-tdd-flag-detector': 'tdd-flag-detector',
  'observer-learning-observer': 'learning-observer',
  'observer-capability-bootstrap': 'capability-bootstrap',
  'observer-jira-env-loader': 'jira-env-loader',
  'observer-precompact-probe': 'precompact-probe',
  'observer-posttoolfailure-probe': 'posttoolfailure-probe',
  'observer-control-probe': 'control-probe',
  'post-write': 'post-write',
  'pre-completion-check': 'pre-completion-check',
};

export const dispatchedHandler = (group: string): string | null => DISPATCHED[group] ?? null;

export interface Invocation {
  script: string;
  args: string[];
}

/**
 * Prepare the throwaway project for a dispatched fixture and return how to
 * invoke it. Writes a single-entry registry so only the handler under test runs.
 */
export function prepareDispatch(projectDir: string, handlerName: string): Invocation {
  const entry = readRegistry().handlers.find((h) => path.basename(h.handler) === `${handlerName}.cjs`);
  if (!entry) throw new Error(`no registry entry for handler ${handlerName}.cjs`);

  const narrowed: Registry = { schema: 2, handlers: [entry] };
  fs.writeFileSync(path.join(projectDir, '.claude/hooks/handlers.json'), `${JSON.stringify(narrowed, null, 2)}\n`);

  const args = [entry.event];
  if (entry.matcher) args.push(entry.matcher);
  return { script: path.join(projectDir, '.claude/hooks/dispatch.cjs'), args };
}

/** A recorded `.sh` entrypoint names its node replacement by extension alone. */
export const nodeEntrypoint = (recorded: string): string => recorded.replace(/\.sh$/, '.cjs');
