#!/usr/bin/env node
/**
 * OrchViz — Hook Relay Script
 *
 * Called by Claude Code on each hook event (configured in .claude/settings.json).
 * Reads discovery files from ~/.claude/orchviz/ to find running relay servers,
 * then forwards the hook payload via HTTP POST.
 *
 * If no relay server is running, exits silently (zero overhead).
 * Must be CommonJS (no ESM), no external deps, hard-deadline safe.
 */
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
        // Dead process — clean up stale discovery file
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
