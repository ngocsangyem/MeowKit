'use strict';
// privacy.cjs — the privacy decision, shared by every runtime's read and shell guards.
//
// Refuses access to credential-bearing files and web-fetch artifacts, fetches aimed at
// loopback, private or metadata hosts, and reads of archived plans. No stdin, stdout or exit code. Result:
// `{ exit, stdout, stderr }`, where exit 2 is a block and the first stderr line is the marker.
// The only I/O is resolving a named path that exists, to see through a symlink.
//
// Scope limit worth knowing: a shell command is read word by word, so a credential file is
// refused when a read, search or copy-out command names it, or an input redirect does. That
// is best effort: a path built from a variable or a glob, a command inside `bash -c`, `eval`
// or a script file, and a file a directory-wide search happens to reach are not seen. The
// permission system is the control for those cases.

const { isSensitive, isArchivedPlanPath, globTargetsSensitive } = require('./privacy-paths.cjs');
const { pathReadInCommand } = require('./privacy-shell-reads.cjs');

const MARKER = '@@PRIVACY_BLOCK@@';

/**
 * Web-fetch artifacts. The manifest is a browsing history, and a quarantined file holds content
 * a previous fetch stopped as untrusted — reading either discloses history or re-injects that
 * content into context. Both cache roots are matched, the canonical one and the pre-move one,
 * so a stale cache in a project installed earlier stays as protected as a new one.
 */
const FETCH_ARTIFACT = /(?:\.meowkit|\.claude)\/cache\/web-fetches\/index\.jsonl$|\.quarantined$/;

/** Commands that invoke the fetch tooling, where a URL argument is worth inspecting. */
const FETCH_COMMAND = /fetch_as_markdown\.py|web-to-markdown|mk:web-to-markdown/;

/** Every URL-shaped word, any scheme, including the scheme-only forms a browser accepts. */
const URL_IN_COMMAND = /\b(?:[a-z][a-z0-9+.-]*:\/\/|(?:about|data|javascript):)[^\s"'`]*/gi;

const UNSAFE_SCHEME = /^(?:file:\/\/|chrome:\/\/|about:|data:|javascript:)/i;

/** Host names a fetch must not reach: loopback and cloud metadata endpoints. */
const UNSAFE_NAME = /^(?:localhost|.+\.localhost|metadata\.google\.internal|metadata\..*)$/;

const ASK_FIRST = 'Use AskUserQuestion to get explicit user approval before accessing.';

const block = (lines) => ({ exit: 2, stdout: [], stderr: [MARKER, ...lines] });
const ALLOW = Object.freeze({ exit: 0, stdout: [], stderr: [] });

const sensitiveBlock = (filePath) => block([`File '${filePath}' matches sensitive file pattern (injection-rules.md R4).`, ASK_FIRST]);

function checkPath(filePath) {
  if (isSensitive(filePath)) return sensitiveBlock(filePath);
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

/**
 * Host as a fetch would resolve it. `new URL` already turns integer, hex and octal IPv4 forms
 * into dotted quads and lower-cases the name; the trailing root dot and IPv6 brackets go here.
 * A URL it cannot parse falls back to a plain cut, so a malformed target is still judged.
 */
function hostOf(url) {
  let host;
  try { host = new URL(url).hostname; } catch { host = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/[/?#].*$/, '').replace(/.*@/, '').replace(/:\d*$/, ''); }
  return host.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
}

/** Loopback, unspecified, private, carrier-grade NAT and link-local IPv4 ranges. */
function unsafeIPv4(host) {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/** Loopback, unspecified, unique-local (fc00::/7), link-local (fe80::/10) and IPv4-mapped IPv6. */
function unsafeIPv6(host) {
  if (!host.includes(':')) return false;
  if (host === '::1' || host === '::') return true;
  if (/^f[cd][0-9a-f]{2}:/.test(host) || /^fe[89ab][0-9a-f]:/.test(host)) return true;
  const mapped = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mapped) {
    const [hi, lo] = [parseInt(mapped[1], 16), parseInt(mapped[2], 16)];
    return unsafeIPv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  return /^::ffff:\d/.test(host) && unsafeIPv4(host.slice(7));
}

const unsafeHost = (host) => UNSAFE_NAME.test(host) || unsafeIPv4(host) || unsafeIPv6(host);

/**
 * Defence in depth only. The fetch tool does its own URL validation; this is a second refusal
 * at the boundary so an unsafe target is stopped before the fetcher ever starts. Every URL in
 * the command is judged, so a safe URL written first cannot cover an unsafe one after it.
 */
function checkCommand(command) {
  if (!command || !FETCH_COMMAND.test(command)) return null;
  for (const [url] of command.matchAll(URL_IN_COMMAND)) {
    if (UNSAFE_SCHEME.test(url)) {
      return block([
        `Web fetch target scheme in '${url}' is not http/https.`,
        'Unsafe scheme — use AskUserQuestion for explicit user approval before proceeding.',
      ]);
    }
    if (!/^https?:/i.test(url)) continue;
    const host = hostOf(url);
    if (unsafeHost(host)) {
      return block([
        `Web fetch target '${host}' is a private/loopback/metadata address.`,
        'SSRF risk. Use AskUserQuestion for explicit user approval before proceeding.',
      ]);
    }
  }
  return null;
}

/** Tool names that put content into a file rather than read one; archive paths stay writable. */
const WRITE_TOOL = /edit|write|replace|create|patch|update|insert|move|rename|mkdir|delete|remove|notebook/i;

/** The archive path a shell command reads, lists or searches, or null; `mv`, `cp` and `mkdir` into it pass. */
const archiveReadInCommand = (command) => pathReadInCommand(command, isArchivedPlanPath, { lists: true });

/** The credential path a shell command reads or copies out, or null. Listing names is not a read. */
const sensitiveReadInCommand = (command) => pathReadInCommand(command, isSensitive, { copies: true });

const archiveBlock = (filePath) => block([
  `'${filePath}' is an archived plan. Archived plans are kept out of context; the shipped code is the source of truth.`,
  ASK_FIRST,
]);

/**
 * The block for an archived-plan read, or null. A shell call is judged by its command (the
 * path-like words a runtime adds to `paths` would otherwise refuse a `mv` into the archive);
 * any other call is a read unless its tool name says it writes.
 */
function checkArchive({ paths, command, toolName }) {
  if (command) {
    const hit = archiveReadInCommand(command);
    return hit ? archiveBlock(hit) : null;
  }
  if (toolName && WRITE_TOOL.test(toolName)) return null;
  const hit = paths.find(isArchivedPlanPath);
  return hit ? archiveBlock(hit) : null;
}

/**
 * @param {{ paths: string[], command?: string, toolName?: string, globs?: string[] }} input
 * `globs` are search globs (Grep's `glob`) whose matches the call reads.
 */
function decidePrivacy({ paths, command = '', toolName = '', globs = [] }) {
  const named = paths.filter(Boolean);
  for (const filePath of named) {
    const blocked = checkPath(filePath);
    if (blocked) return blocked;
  }
  const glob = globs.find(globTargetsSensitive);
  if (glob) return block([`Search glob '${glob}' selects files matching a sensitive file pattern (injection-rules.md R4).`, ASK_FIRST]);
  const shellHit = command ? sensitiveReadInCommand(command) : null;
  if (shellHit) return sensitiveBlock(shellHit);
  return checkCommand(command) || checkArchive({ paths: named, command, toolName }) || ALLOW;
}

module.exports = { decidePrivacy, isSensitive, isArchivedPlanPath, archiveReadInCommand, sensitiveReadInCommand, globTargetsSensitive };
