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
    if (typeof entry.toggleKey !== 'string' || !entry.toggleKey) errors.push(`${where}: missing toggleKey`);
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
 */
function selectHandlers(entries, event, matcher) {
  return entries.filter((e) => e.event === event && (!e.matcher || e.matcher === matcher));
}

module.exports = { REGISTRY_REL, TOOL_SCOPED_EVENTS, isToolScoped, loadRegistry, selectHandlers, validate };
