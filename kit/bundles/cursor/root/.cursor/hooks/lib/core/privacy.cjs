'use strict';
// privacy.cjs — the privacy decision, shared by every runtime's read and shell guards.
//
// Refuses access to credential-bearing files and web-fetch artifacts, and fetches aimed at
// loopback, private or metadata hosts. Pure: no stdin, stdout or exit code. Result:
// `{ exit, stdout, stderr }`, where exit 2 is a block and the first stderr line is the marker.
//
// Scope limit worth knowing: the sensitive-path patterns match the paths a call names. A shell
// command that reads the same file carries no path and is not caught here; the permission
// system is the control for that case.

const MARKER = '@@PRIVACY_BLOCK@@';

/** Credential-bearing files: dotenv, keys, certificates, credential stores, ssh. */
const SENSITIVE_PATH = /\.env($|\.)|\.key$|\.pem$|credentials|secret|keystore|\.ssh\//i;

/**
 * Web-fetch artifacts. The manifest is a browsing history, and a quarantined file holds content
 * a previous fetch stopped as untrusted — reading either discloses history or re-injects that
 * content into context. Both cache roots are matched, the canonical one and the pre-move one,
 * so a stale cache in a project installed earlier stays as protected as a new one.
 */
const FETCH_ARTIFACT = /(?:\.meowkit|\.claude)\/cache\/web-fetches\/index\.jsonl$|\.quarantined$/;

/** Commands that invoke the fetch tooling, where a URL argument is worth inspecting. */
const FETCH_COMMAND = /fetch_as_markdown\.py|web-to-markdown|mk:web-to-markdown/;

const URL_IN_COMMAND = /https?:\/\/[^\s"'`]+/;

/** Hosts a fetch must not reach: loopback, private ranges, link-local, metadata. */
const UNSAFE_HOST = /^(localhost|127\..*|10\..*|192\.168\..*|169\.254\..*|metadata\.google\.internal|metadata\..*)$/;

const UNSAFE_SCHEME = /^(file:\/\/|chrome:\/\/|about:|data:|javascript:)/;

const ASK_FIRST = 'Use AskUserQuestion to get explicit user approval before accessing.';

const block = (lines) => ({ exit: 2, stdout: [], stderr: [MARKER, ...lines] });
const ALLOW = Object.freeze({ exit: 0, stdout: [], stderr: [] });

function checkPath(filePath) {
  if (SENSITIVE_PATH.test(filePath)) {
    return block([`File '${filePath}' matches sensitive file pattern (injection-rules.md R4).`, ASK_FIRST]);
  }
  if (FETCH_ARTIFACT.test(filePath)) {
    return block([
      `File '${filePath}' is a web-to-markdown cache artifact.`,
      'The manifest contains browsing history; quarantined files contain injection-stopped content.',
      'Reading these files may disclose browsing history OR re-inject untrusted content into agent context.',
      ASK_FIRST,
    ]);
  }
  return null;
}

/** Host as a fetch would resolve it: drop the scheme, any userinfo, and the path. */
function hostOf(url) {
  return url.replace(/^https?:\/\//, '').replace(/[:/].*$/, '').replace(/.*@/, '');
}

/**
 * Defence in depth only. The fetch tool does its own URL validation; this is a second refusal
 * at the boundary so an unsafe target is stopped before the fetcher ever starts.
 */
function checkCommand(command) {
  if (!command || !FETCH_COMMAND.test(command)) return null;
  // Best-effort: the agent may quote the URL in any number of ways.
  const match = command.match(URL_IN_COMMAND);
  if (!match) return null;
  const url = match[0];
  const host = hostOf(url);
  if (UNSAFE_HOST.test(host)) {
    return block([
      `Web fetch target '${host}' is a private/loopback/metadata address.`,
      'SSRF risk. Use AskUserQuestion for explicit user approval before proceeding.',
    ]);
  }
  if (UNSAFE_SCHEME.test(url)) {
    return block([
      `Web fetch target scheme in '${url}' is not http/https.`,
      'Unsafe scheme — use AskUserQuestion for explicit user approval before proceeding.',
    ]);
  }
  return null;
}

/** @param {{ paths: string[], command?: string }} input */
function decidePrivacy({ paths, command = '' }) {
  for (const filePath of paths.filter(Boolean)) {
    const blocked = checkPath(filePath);
    if (blocked) return blocked;
  }
  return checkCommand(command) || ALLOW;
}

module.exports = { decidePrivacy };
