'use strict';
// handler-registry.cjs — read and validate the observer registry.
//
// Kept apart from the dispatcher so a malformed registry is one reportable
// error with a reason, rather than a crash somewhere inside the dispatch loop
// where the cause is no longer obvious.
//
// A tool-scoped event is the only kind with a matcher. Requiring one everywhere
// would make the session and prompt events unrepresentable; allowing one
// anywhere would let a matcher silently never apply.

const fs = require('node:fs');
const path = require('node:path');

/** Events whose registrations are scoped to a tool, and therefore need a matcher. */
const TOOL_SCOPED_EVENTS = ['PreToolUse', 'PostToolUse', 'PostToolUseFailure'];

const REGISTRY_REL = '.claude/hooks/handlers.json';

/** A toggle key is lower-case words joined by single hyphens, and nothing else. */
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const isToolScoped = (event) => TOOL_SCOPED_EVENTS.includes(event);

/** `{ entries, errors }` — a bad entry is reported, never silently dropped. */
function validate(handlers) {
  const entries = [];
  const errors = [];
  handlers.forEach((entry, i) => {
    const where = `entry ${i}`;
    if (typeof entry !== 'object' || entry === null) {
      errors.push(`${where}: not an object`);
      return;
    }
    if (typeof entry.event !== 'string' || !entry.event) errors.push(`${where}: missing event`);
    if (typeof entry.handler !== 'string' || !entry.handler) errors.push(`${where}: missing handler`);
    if (typeof entry.toggleKey !== 'string' || !entry.toggleKey) {
      errors.push(`${where}: missing toggleKey`);
    } else if (!KEBAB.test(entry.toggleKey)) {
      errors.push(`${where}: toggleKey '${entry.toggleKey}' is not kebab-case`);
    } else if (typeof entry.handler === 'string' && entry.handler) {
      // The toggle key IS the handler's file name, so there is no translation
      // table between the registry and the config and nothing to fall out of
      // step. A key naming a different file would silently switch off the wrong
      // observer, or nothing at all.
      const base = path.basename(entry.handler, path.extname(entry.handler));
      if (base !== entry.toggleKey) {
        errors.push(`${where}: toggleKey '${entry.toggleKey}' does not match handler file '${base}'`);
      }
    }
    // PostToolUseFailure is tool-scoped in principle but is registered without a
    // matcher, so a matcher is required only where the event can carry one.
    if (entry.event === 'PreToolUse' || entry.event === 'PostToolUse') {
      if (typeof entry.matcher !== 'string' || !entry.matcher) errors.push(`${where}: ${entry.event} needs a matcher`);
    }
    entries.push(entry);
  });
  return { entries, errors };
}

/** Load the registry. Throws with a reason the caller can report verbatim. */
function loadRegistry(root) {
  const file = path.join(root, REGISTRY_REL);
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`cannot read ${REGISTRY_REL}: ${err.message}`);
  }
  if (!parsed || !Array.isArray(parsed.handlers)) {
    throw new Error(`${REGISTRY_REL} has no handlers array`);
  }
  const { entries, errors } = validate(parsed.handlers);
  if (errors.length) throw new Error(`${REGISTRY_REL} is invalid: ${errors.join('; ')}`);
  return entries;
}

/**
 * Entries for one event, in registry order. An entry with no matcher applies to
 * every invocation of its event; an entry with one applies only to the matching
 * invocation.
 *
 * `hooks.<toggleKey>: false` in the project config removes the entry here, which
 * is the only place a toggle needs to act: the observer is never loaded, so the
 * switch works whether or not the handler itself knows about it, and a handler
 * registered twice is switched off in both places by the one key.
 *
 * The config reader is required lazily and its failure is swallowed, because a
 * broken config must not cost the whole event its observers.
 */
function selectHandlers(entries, event, matcher, options = {}) {
  const forEvent = entries.filter((e) => e.event === event && (!e.matcher || e.matcher === matcher));
  if (forEvent.length === 0) return forEvent;
  let disabled;
  try {
    // eslint-disable-next-line global-require
    const { resolveConfig } = require('./read-config.cjs');
    const { values } = resolveConfig(options);
    disabled = new Set(
      Object.entries(values)
        .filter(([key, value]) => key.startsWith('hooks.') && value === false)
        .map(([key]) => key.slice('hooks.'.length)),
    );
  } catch {
    return forEvent;
  }
  return forEvent.filter((e) => !disabled.has(e.toggleKey));
}

module.exports = { KEBAB, REGISTRY_REL, TOOL_SCOPED_EVENTS, isToolScoped, loadRegistry, selectHandlers, validate };
