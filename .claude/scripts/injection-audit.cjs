#!/usr/bin/env node
'use strict';

/**
 * injection-audit.cjs — output validation, run AFTER an agent finishes a task.
 *
 * Usage:
 *   node injection-audit.cjs [directory]        scan a tree, print a report
 *   node injection-audit.cjs --file <path>      scan ONE path, print JSON
 *
 * Two modes because there are two kinds of caller. A human (or the escalation
 * protocol in `.claude/rules/injection-rules.md`) wants the report and an exit
 * status to act on. A skill script that has just written a file wants the
 * findings for that one file, as data, so it can quarantine what it wrote —
 * including under `.claude/`, which the tree walk prunes.
 *
 * Runs on node with no dependencies, so the check is available on a machine
 * with no interpreter installed. That is the point: a safety check that is only
 * present when an optional runtime happens to be installed is not a safety
 * check.
 */

const fs = require('node:fs');
const path = require('node:path');

const audit = require('./lib/injection-audit-core.cjs');

/** The tree scan: a report on stdout, and a non-zero exit when it must halt. */
function reportDirectory(target, command) {
  process.stdout.write(`Injection audit scanning: ${target}\n`);
  const findings = audit.scanDirectory(target);
  const critical = findings.filter((f) => f.level === 'CRITICAL');
  const suspicious = findings.filter((f) => f.level === 'SUSPICIOUS');

  for (const f of findings) process.stdout.write(`${audit.formatFinding(f)}\n`);
  process.stdout.write(`\n--- Audit Summary ---\nCRITICAL: ${critical.length}\nSUSPICIOUS: ${suspicious.length}\n`);

  if (critical.length) {
    process.stdout.write('\n==== CRITICAL — Possible successful prompt injection ====\n');
    process.stdout.write('HALT: Review findings above. Do NOT proceed without human review.\n');
    const logPath = path.join(target, '.meowkit', 'telemetry', 'security-log.md');
    audit.writeSecurityLog(critical, logPath, command);
    process.stdout.write(`Findings logged to: ${logPath}\n`);
    return 1;
  }

  if (suspicious.length) {
    process.stdout.write('\n==== SUSPICIOUS — Review recommended ====\n');
    process.stdout.write('Findings may be false positives. User review recommended.\n');
    return 0;
  }

  process.stdout.write('\nCLEAN — no injection indicators found.\n');
  return 0;
}

/**
 * The single-path scan: one JSON object on stdout.
 *
 * The boundary violation is reported FIRST and is additive, so a path that
 * resolved outside the project carries both that finding and whatever its
 * content matched. A caller deciding whether to quarantine needs both.
 *
 * Exit status is 0 for any completed scan, findings or not — a scan that ran is
 * a successful scan, and the caller reads the findings. Reserving non-zero for
 * "could not scan" keeps the two answers distinguishable, which the report mode
 * does not need to do because it prints its verdict in words.
 */
function reportSinglePath(target, projectRoot) {
  const findings = [];
  const boundary = audit.checkFileOutsideProject(target, projectRoot);
  if (boundary) findings.push(boundary);
  findings.push(...audit.scanFile(target));
  process.stdout.write(`${JSON.stringify({ path: target, findings })}\n`);
  return 0;
}

function parseArgs(argv) {
  const fileFlag = argv.indexOf('--file');
  if (fileFlag !== -1) {
    const target = argv[fileFlag + 1];
    if (!target) return { error: 'Error: --file requires a path' };
    return { mode: 'single', target };
  }
  return { mode: 'directory', target: argv[0] === undefined ? '.' : argv[0] };
}

function main(argv) {
  const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const command = process.env.MEOWKIT_COMMAND || 'manual-audit';
  const parsed = parseArgs(argv);

  if (parsed.error) {
    process.stdout.write(`${parsed.error}\n`);
    return 1;
  }
  if (parsed.mode === 'single') return reportSinglePath(parsed.target, projectRoot);

  // Report mode takes a directory. Saying so beats scanning a file the caller
  // named by mistake and reporting CLEAN for the tree they meant.
  let isDir = false;
  try {
    isDir = fs.statSync(parsed.target).isDirectory();
  } catch {
    // A path that cannot be stat'ed is not a directory either.
  }
  if (!isDir) {
    process.stdout.write(`Error: ${parsed.target} is not a directory\n`);
    return 1;
  }
  return reportDirectory(parsed.target, command);
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { main, parseArgs };
