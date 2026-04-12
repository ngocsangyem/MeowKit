#!/usr/bin/env node
// dispatch.cjs — Central event dispatcher for MeowKit Node.js hooks.
// Parses stdin JSON once, loads handler registry from handlers.json,
// dispatches to matching handlers sequentially.
//
// Usage: node dispatch.cjs <EventName> [Matcher]
//   e.g. node dispatch.cjs PostToolUse "Edit|Write"
//        node dispatch.cjs Stop
//
// Security: gate-enforcement.sh and privacy-block.sh stay independent
// in settings.json — they are NOT routed through this dispatcher.

const fs = require('fs');
const path = require('path');

// Must point to meowkit root (not parent repo) for .claude/.env resolution
const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const HOOKS_DIR = path.join(ROOT, '.claude', 'hooks');

// Load .claude/.env for Node.js handlers — no external dependency.
// Does NOT override existing env vars (shell export takes precedence).
const dotenvPath = path.join(ROOT, '.claude', '.env');
try {
  if (fs.existsSync(dotenvPath)) {
    const lines = fs.readFileSync(dotenvPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      // Strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      // Don't override existing env vars
      if (!(key in process.env)) {
        process.env[key] = val;
      }
    }
  }
} catch (_) { /* graceful — dotenv is optional */ }

async function main() {
  const event = process.argv[2] || '';
  const matcher = process.argv[3] || '';

  // Load handler registry
  const registryPath = path.join(HOOKS_DIR, 'handlers.json');
  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (err) {
    process.stderr.write(`dispatch: failed to load handlers.json: ${err.message}\n`);
    process.exit(0); // graceful degradation — don't block Claude Code
  }

  // Find handlers for this event + matcher
  const eventHandlers = registry[event];
  if (!eventHandlers) {
    process.exit(0);
  }

  let handlerPaths;
  if (Array.isArray(eventHandlers)) {
    // Events without matchers (Stop, SessionStart, UserPromptSubmit)
    handlerPaths = eventHandlers;
  } else {
    // Events with matchers (PostToolUse, PreToolUse)
    handlerPaths = eventHandlers[matcher] || [];
  }

  if (handlerPaths.length === 0) {
    process.exit(0);
  }

  // Read and parse stdin once
  const { parseStdin } = require(path.join(HOOKS_DIR, 'lib', 'parse-stdin.cjs'));
  const ctx = await parseStdin();

  // Load shared state module
  const state = require(path.join(HOOKS_DIR, 'lib', 'shared-state.cjs'));

  // Dispatch to each handler sequentially, collect stdout output
  let output = '';
  for (const handlerPath of handlerPaths) {
    try {
      const absPath = path.resolve(HOOKS_DIR, handlerPath);
      const handler = require(absPath);
      if (typeof handler === 'function') {
        const result = await handler(ctx, state);
        if (result) output += result;
      } else if (typeof handler.run === 'function') {
        const result = await handler.run(ctx, state);
        if (result) output += result;
      }
    } catch (err) {
      process.stderr.write(`dispatch: handler ${handlerPath} error: ${err.message}\n`);
      // Continue to next handler — don't let one handler crash others
    }
  }

  if (output) {
    process.stdout.write(output);
  }
}

main().catch((err) => {
  process.stderr.write(`dispatch: fatal: ${err.message}\n`);
  process.exit(0); // graceful degradation
});
