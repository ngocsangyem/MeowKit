/**
 * OrchViz — Hook Auto-Configuration
 *
 * Installs hook-relay.cjs (project-local) and registers orchviz hooks in
 * MeowKit's .claude/settings.json. Discovery dir at ~/.claude/orchviz/ is
 * global for runtime files only. Safe to run multiple times (idempotent).
 *
 * Usage:
 *   node scripts/setup.js           — full setup
 *   node scripts/setup.js --dry-run — parse settings.json + report, no writes
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ── Constants ────────────────────────────────────────────────────────────────

// Runtime discovery files stay global (shared across projects, like Agent Flow)
const DISCOVERY_DIR = path.join(os.homedir(), '.claude', 'orchviz');

// Hook script lives PROJECT-LOCAL — referenced via $CLAUDE_PROJECT_DIR
// This avoids the confusing dual ~/.claude/orchviz/ vs project .claude/orchviz/
// meowkit/.claude/orchviz/scripts/ → 3 levels up → meowkit/
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const HOOK_SCRIPT_PATH = path.join(PROJECT_ROOT, '.claude', 'orchviz', 'scripts', 'hook-relay.cjs');
const SETTINGS_PATH = path.join(PROJECT_ROOT, '.claude', 'settings.json');

// Hook event types to register (all six Claude Code hook events)
const HOOK_EVENTS = ['PreToolUse', 'PostToolUse', 'SubagentStart', 'SubagentStop', 'SessionStart', 'Stop'];

// Uses $CLAUDE_PROJECT_DIR so it works regardless of CWD
const ORCHVIZ_HOOK_COMMAND = 'node "$CLAUDE_PROJECT_DIR/.claude/orchviz/scripts/hook-relay.cjs"';

const isDryRun = process.argv.includes('--dry-run');

// ── Hook Script Content ──────────────────────────────────────────────────────

// This is written to scripts/hook-relay.cjs (project-local).
// It must be CommonJS (no ESM), no external deps, hard-deadline safe.
// Discovery files at ~/.claude/orchviz/ are global (shared across projects).
const HOOK_SCRIPT = `#!/usr/bin/env node
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Hard safety deadline — must exit before Claude Code's 2s kill timeout
setTimeout(() => process.exit(0), 1500);

const DIR = path.join(os.homedir(), '.claude', 'orchviz');

let input = '';
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  // Find discovery files listing active relay instances
  let files;
  try { files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')); }
  catch { process.exit(0); }

  if (files.length === 0) process.exit(0);

  let pending = 0;

  for (const file of files) {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
      if (!d.port || !d.pid) continue;

      // Verify relay process is still alive
      try { process.kill(d.pid, 0); }
      catch {
        try { fs.unlinkSync(path.join(DIR, file)); } catch { /* noop */ }
        continue;
      }

      pending++;
      const req = http.request(
        { hostname: '127.0.0.1', port: d.port, method: 'POST', path: '/hook', timeout: 1000 },
        (res) => {
          res.resume();
          res.on('end', () => { if (--pending <= 0) process.exit(0); });
        }
      );
      req.on('error', () => { if (--pending <= 0) process.exit(0); });
      req.on('timeout', () => { req.destroy(); if (--pending <= 0) process.exit(0); });
      req.write(input);
      req.end();
    } catch {
      // Corrupt discovery file — skip
    }
  }

  if (pending === 0) process.exit(0);
});
`;

// ── Step 1: Install hook.js ──────────────────────────────────────────────────

function installHookScript() {
  const exists = fs.existsSync(HOOK_SCRIPT_PATH);

  if (isDryRun) {
    console.log(`[dry-run] hook-relay.cjs: ${exists ? 'already exists' : 'would create'} at ${HOOK_SCRIPT_PATH}`);
    return;
  }

  // Ensure discovery dir exists (for runtime files)
  fs.mkdirSync(DISCOVERY_DIR, { recursive: true });

  // hook-relay.cjs is a static file in the repo — only write if missing
  if (!exists) {
    const hookDir = path.dirname(HOOK_SCRIPT_PATH);
    fs.mkdirSync(hookDir, { recursive: true });
    fs.writeFileSync(HOOK_SCRIPT_PATH, HOOK_SCRIPT, 'utf8');
    try { fs.chmodSync(HOOK_SCRIPT_PATH, 0o755); } catch { /* Windows */ }
    console.log(`Installed hook script: ${HOOK_SCRIPT_PATH}`);
  } else {
    console.log(`Hook script already exists: ${HOOK_SCRIPT_PATH}`);
  }
}

// ── Step 2: Register hooks in settings.json ──────────────────────────────────

/**
 * Check whether an orchviz hook is already registered for a given event.
 * @param {object[]} hooksArray — array of hook group objects for this event
 * @returns {boolean}
 */
function orchvizAlreadyRegistered(hooksArray) {
  if (!Array.isArray(hooksArray)) return false;
  for (const group of hooksArray) {
    if (!Array.isArray(group.hooks)) continue;
    for (const hook of group.hooks) {
      if (typeof hook.command === 'string' && hook.command.includes('orchviz')) {
        return true;
      }
    }
  }
  return false;
}

function registerHooks() {
  // Validate settings.json is readable
  if (!fs.existsSync(SETTINGS_PATH)) {
    console.error(`settings.json not found at: ${SETTINGS_PATH}`);
    console.error('Run this script from the MeowKit project root, or ensure PROJECT_ROOT is correct.');
    process.exit(1);
  }

  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  } catch (err) {
    console.error(`Failed to parse settings.json: ${err.message}`);
    process.exit(1);
  }

  if (!settings.hooks || typeof settings.hooks !== 'object') {
    settings.hooks = {};
  }

  const orchvizHookEntry = {
    type: 'command',
    command: ORCHVIZ_HOOK_COMMAND,
    timeout: 2000,
  };

  let registered = 0;
  let alreadyPresent = 0;

  for (const eventType of HOOK_EVENTS) {
    if (!Array.isArray(settings.hooks[eventType])) {
      settings.hooks[eventType] = [];
    }

    if (orchvizAlreadyRegistered(settings.hooks[eventType])) {
      alreadyPresent++;
      if (isDryRun) {
        console.log(`[dry-run] ${eventType}: orchviz hook already present — skip`);
      }
      continue;
    }

    if (isDryRun) {
      console.log(`[dry-run] ${eventType}: would append orchviz hook`);
      registered++;
      continue;
    }

    // Append as a standalone hook group (no matcher — fires for all tools)
    settings.hooks[eventType].push({
      hooks: [{ ...orchvizHookEntry }],
    });
    registered++;
  }

  if (isDryRun) {
    console.log(`\n[dry-run] Summary: ${registered} would be added, ${alreadyPresent} already present`);
    console.log('[dry-run] settings.json parsed OK — no changes written');
    return;
  }

  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
  console.log(`OrchViz hooks configured for ${registered} event type(s) (${alreadyPresent} already present)`);
}

// ── ensureSetup (called by server.ts at startup) ─────────────────────────────

/**
 * Idempotent setup check — called by server.ts before listening.
 * If already configured, returns immediately. Otherwise runs full setup.
 */
function ensureSetup() {
  const hookExists = fs.existsSync(HOOK_SCRIPT_PATH);

  let hooksRegistered = false;
  try {
    const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    hooksRegistered = HOOK_EVENTS.every((evt) =>
      orchvizAlreadyRegistered(settings.hooks?.[evt] ?? [])
    );
  } catch {
    // settings.json unreadable — will re-register
  }

  if (hookExists && hooksRegistered) {
    return; // Already fully set up
  }

  installHookScript();
  registerHooks();
}

// ── Main ─────────────────────────────────────────────────────────────────────

if (require.main === module) {
  installHookScript();
  registerHooks();
}

module.exports = { ensureSetup, installHookScript, registerHooks };
