#!/usr/bin/env node
'use strict';
// privacy-block.cjs — refuse reads of sensitive files and obviously unsafe web
// fetches.
//
// Matches Read, Edit, Write and Bash. Exit 2 is the only blocking value: exit 1
// is advisory and the tool call proceeds, which is useless for policy
// enforcement. The same asymmetry makes a crash dangerous, so the handlers
// below are installed before any library is required and are written inline —
// importing them would reintroduce the dependency they exist to survive.
//
// When blocked, the reason goes to stderr, which the host feeds back to the
// model. The agent is expected to ask the user for explicit approval before
// retrying rather than working around the refusal.
//
// Scope limit worth knowing: the sensitive-path patterns are matched against the
// payload's file path. A shell command that reads the same file through Bash
// carries no file path and is not caught here; the permission system is the
// control for that case.

const MARKER = '@@PRIVACY_BLOCK@@';

function failClosed(err) {
  try {
    process.stderr.write(`${MARKER}\nPrivacy guard could not run: ${err && err.message ? err.message : String(err)}\n`);
    process.stderr.write('A read guard that cannot evaluate must not allow the read.\n');
  } catch {
    // Nothing left to report with; the exit code is the decision.
  }
  process.exit(2);
}

process.on('uncaughtException', failClosed);
process.on('unhandledRejection', failClosed);

const { readHookInput } = require('./lib/parse-stdin.cjs');

/** Credential-bearing files: dotenv, keys, certificates, credential stores, ssh. */
const SENSITIVE_PATH = /\.env($|\.)|\.key$|\.pem$|credentials|secret|keystore|\.ssh\//i;

/**
 * Web-fetch artifacts. The manifest is a browsing history, and a quarantined
 * file holds content a previous fetch stopped as untrusted — reading either
 * discloses history or re-injects that content into context.
 */
const FETCH_ARTIFACT = /\.claude\/cache\/web-fetches\/index\.jsonl$|\.quarantined$/;

/** Commands that invoke the fetch tooling, where a URL argument is worth inspecting. */
const FETCH_COMMAND = /fetch_as_markdown\.py|web-to-markdown|mk:web-to-markdown/;

const URL_IN_COMMAND = /https?:\/\/[^\s"'`]+/;

/** Hosts a fetch must not reach: loopback, private ranges, link-local, metadata. */
const UNSAFE_HOST = /^(localhost|127\..*|10\..*|192\.168\..*|169\.254\..*|metadata\.google\.internal|metadata\..*)$/;

const UNSAFE_SCHEME = /^(file:\/\/|chrome:\/\/|about:|data:|javascript:)/;

const emit = (lines) => process.stderr.write(`${lines.join('\n')}\n`);

const ASK_FIRST = 'Use AskUserQuestion to get explicit user approval before accessing.';

function checkFilePath(filePath) {
  if (!filePath) return 0;

  if (SENSITIVE_PATH.test(filePath)) {
    emit([
      MARKER,
      `File '${filePath}' matches sensitive file pattern (injection-rules.md R4).`,
      ASK_FIRST,
    ]);
    return 2;
  }

  if (FETCH_ARTIFACT.test(filePath)) {
    emit([
      MARKER,
      `File '${filePath}' is a web-to-markdown cache artifact.`,
      'The manifest contains browsing history; quarantined files contain injection-stopped content.',
      'Reading these files may disclose browsing history OR re-inject untrusted content into agent context.',
      ASK_FIRST,
    ]);
    return 2;
  }
  return 0;
}

/** Host as a fetch would resolve it: drop the scheme, any userinfo, and the path. */
function hostOf(url) {
  return url.replace(/^https?:\/\//, '').replace(/[:/].*$/, '').replace(/.*@/, '');
}

/**
 * Defence in depth only. The fetch tool does its own URL validation; this is a
 * second refusal at the boundary so an unsafe target is stopped before the
 * fetcher ever starts.
 */
function checkCommand(command) {
  if (!command || !FETCH_COMMAND.test(command)) return 0;

  // Best-effort: the agent may quote the URL in any number of ways.
  const match = command.match(URL_IN_COMMAND);
  if (!match) return 0;
  const url = match[0];

  const host = hostOf(url);
  if (UNSAFE_HOST.test(host)) {
    emit([
      MARKER,
      `Web fetch target '${host}' is a private/loopback/metadata address.`,
      'SSRF risk. Use AskUserQuestion for explicit user approval before proceeding.',
    ]);
    return 2;
  }
  if (UNSAFE_SCHEME.test(url)) {
    emit([
      MARKER,
      `Web fetch target scheme in '${url}' is not http/https.`,
      'Unsafe scheme — use AskUserQuestion for explicit user approval before proceeding.',
    ]);
    return 2;
  }
  return 0;
}

async function main() {
  const input = await readHookInput();
  if (!input.ok) {
    emit([
      MARKER,
      `Privacy guard received unreadable hook input (${input.reason}).`,
      'A read guard that cannot read what is being accessed must not allow it.',
    ]);
    process.exit(2);
  }

  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  try {
    process.chdir(root);
  } catch {
    process.exit(0);
  }

  // argv is the back-compatible fallback for a registration that still passes
  // the target as a positional argument.
  const filePath = input.filePath || process.argv[2] || '';
  const fileExit = checkFilePath(filePath);
  process.exit(fileExit !== 0 ? fileExit : checkCommand(input.command));
}

main();
