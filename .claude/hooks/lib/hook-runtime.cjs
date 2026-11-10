'use strict';
// hook-runtime.cjs — what differs between runtimes for the shared guards, and nothing else.
//
// The decisions live in lib/core/. A runtime's shell reads its payload, asks this module which
// runtime its tree was laid down for and which files the call touches, runs the decision, and
// says the result in its runtime's block form.
//
// The runtime is named by `hook-runtime-config.json` beside the hooks, written by whatever
// lays the tree down. The canonical `.claude/hooks` has none and is Claude Code. An emitted
// Codex or Cursor tree must have one: a shell there asks with `{ emitted: true }`, and a
// missing or unknown config comes back null, which that shell turns into a block.

const fs = require('node:fs');
const path = require('node:path');

const CONFIG_FILE = 'hook-runtime-config.json';

/**
 * Per runtime, the trees that hold its own config and kit files. Writes there are kit
 * maintenance, not source, exactly as `.claude/` is on Claude Code.
 */
const NON_SOURCE_TREES = {
  'claude-code': [],
  codex: ['.codex', '.agents', '.meowkit'],
  cursor: ['.cursor', '.meowkit'],
};

/** The runtime the hooks in `hooksDir` serve, or null when it cannot be trusted. */
function loadRuntime(hooksDir, { emitted = false } = {}) {
  let config;
  try {
    config = JSON.parse(fs.readFileSync(path.join(hooksDir, CONFIG_FILE), 'utf8'));
  } catch (err) {
    if (err && err.code === 'ENOENT' && !emitted) return 'claude-code';
    return null;
  }
  const runtime = config && config.schemaVersion === 1 ? config.runtime : null;
  return typeof runtime === 'string' && Object.hasOwn(NON_SOURCE_TREES, runtime) ? runtime : null;
}

const nonSourceTrees = (runtime) => NON_SOURCE_TREES[runtime] || [];

/**
 * Every file target in a Codex patch: added, updated, deleted, and both ends of a move. A
 * patch that touches docs and source at once must be judged on the source file too.
 */
const PATCH_TARGET = /^\*\*\*\s+(?:(?:Add|Update|Delete) File|Move to):\s+(.+?)\s*$/gim;

/** Payload fields a runtime uses for a single target path. */
const PATH_FIELDS = ['file_path', 'path', 'filePath', 'notebook_path', 'target_file'];

/** Payload fields that may carry a patch body. */
const PATCH_FIELDS = ['command', 'patch', 'input'];

/** Every file a tool call touches, as named in its `tool_input`, in first-seen order. */
function targetPaths(toolInput) {
  const input = toolInput && typeof toolInput === 'object' ? toolInput : {};
  const paths = new Set();
  for (const key of PATCH_FIELDS) {
    if (typeof input[key] !== 'string') continue;
    for (const match of input[key].matchAll(PATCH_TARGET)) paths.add(match[1].trim());
  }
  for (const key of PATH_FIELDS) {
    if (typeof input[key] === 'string' && input[key]) paths.add(input[key]);
  }
  // A structured patch keyed by file path (`changes: { "src/a.ts": {...} }`).
  if (input.changes && typeof input.changes === 'object' && !Array.isArray(input.changes)) {
    for (const key of Object.keys(input.changes)) if (key) paths.add(key);
  }
  return [...paths];
}

/**
 * Claude Code names in the shared messages, said the way another runtime's agent can act on:
 * it has no AskUserQuestion tool and runs skills by their installed `mk-` names.
 */
const PORTABLE_WORDING = [
  [/\bAskUserQuestion\b/g, 'a question to the user'],
  [/\/mk:([a-z][\w-]*)/g, 'the mk-$1 skill'],
  [/\.claude\/skills\/([\w-]+)\//g, "the mk-$1 skill's "],
];

/** One-line reason for a blocking result: its stderr without marker or blank lines. */
function denyReason(result, runtime = 'claude-code') {
  const reason = result.stderr.filter((line) => line.trim() && !/^@@[A-Z_]+@@$/.test(line)).join(' ');
  if (runtime === 'claude-code') return reason;
  return PORTABLE_WORDING.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), reason);
}

module.exports = { denyReason, loadRuntime, nonSourceTrees, targetPaths };
