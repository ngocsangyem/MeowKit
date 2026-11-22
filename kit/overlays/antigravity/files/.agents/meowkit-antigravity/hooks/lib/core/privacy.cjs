'use strict';
// privacy.cjs — the privacy decision, shared by every runtime's read and shell guards.
//
// Refuses access to credential-bearing files and web-fetch artifacts, fetches aimed at
// loopback, private or metadata hosts, and reads of archived plans. No stdin, stdout or exit code. Result:
// `{ exit, stdout, stderr }`, where exit 2 is a block and the first stderr line is the marker.
// The only I/O is resolving a named path that exists, to see through a symlink.
//
// Scope limit worth knowing: the sensitive-path patterns match the paths a call names. A shell
// command that reads the same file carries no path and is not caught here; the permission
// system is the control for that case.

const fs = require('node:fs');

const MARKER = '@@PRIVACY_BLOCK@@';

/**
 * Credential-bearing files, matched against the path with `\` turned into `/`: dotenv and
 * direnv files, keys, certificates, credential stores, package-registry tokens, private
 * key files, and the ssh, aws, gnupg and kube config directories. `secret` must stand as a
 * word in a file or directory name (`client_secret.json`, `secrets/`), so `secretary.ts` is
 * not a credential.
 */
const SENSITIVE_PATH = new RegExp([
  String.raw`\.env(?:$|\.)`,
  String.raw`(?:^|/)\.envrc$`,
  String.raw`(?:^|/)\.npmrc$`,
  String.raw`(?:^|/)id_(?:rsa|ed25519|ecdsa|dsa)$`,
  String.raw`\.key$`,
  String.raw`\.pem$`,
  'credentials',
  String.raw`(?:^|[/._-])secrets?(?:[/._-]|$)`,
  'keystore',
  String.raw`\.ssh/`,
  String.raw`(?:^|/)\.(?:aws|gnupg)/`,
  String.raw`(?:^|/)\.kube/config$`,
].join('|'), 'i');

/** Template dotenv files carry placeholders, not secrets; only these exact names are exempt. */
const EXEMPT_BASENAME = /^\.env\.example$/i;

/** The path as the patterns read it: forward slashes, `.` and `..` segments resolved. */
function normalise(filePath) {
  const parts = [];
  for (const part of String(filePath).replace(/\\/g, '/').split('/')) {
    if (part === '.' || (part === '' && parts.length)) continue;
    if (part === '..' && parts.length && parts[parts.length - 1] !== '..' && parts[parts.length - 1] !== '') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

function matches(filePath) {
  const norm = normalise(filePath);
  const base = norm.slice(norm.lastIndexOf('/') + 1);
  return !EXEMPT_BASENAME.test(base) && SENSITIVE_PATH.test(norm);
}

/**
 * True for a credential path, by the name it is called or, when it exists, by the file it
 * resolves to, so a harmless-looking symlink to `.env` is refused as `.env` is.
 */
function isSensitive(filePath) {
  if (matches(filePath)) return true;
  try {
    return matches(fs.realpathSync(filePath));
  } catch {
    return false;
  }
}

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
  if (isSensitive(filePath)) {
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

/**
 * Archived plans. A finished plan describes intent the shipped code has since settled; read
 * back into context it competes with the code as a source of truth, so reads are refused
 * (the user can still approve one). Moving a plan in and writing there stay allowed.
 */
const ARCHIVE_PATH = /(?:^|\/)tasks\/plans\/(?:ceo-plans\/)?archive(?:\/|$)/;

/** True for a path inside an archived-plan directory, by its name or the file it resolves to. */
function isArchivedPlanPath(filePath) {
  if (!filePath) return false;
  if (ARCHIVE_PATH.test(normalise(filePath))) return true;
  try {
    return ARCHIVE_PATH.test(normalise(fs.realpathSync(filePath)));
  } catch {
    return false;
  }
}

/** Tool names that put content into a file rather than read one; archive paths stay writable. */
const WRITE_TOOL = /edit|write|replace|create|patch|update|insert|move|rename|mkdir|delete|remove|notebook/i;

/** Shell commands that print, list or search what they name. */
const READ_VERBS = new Set(['cat', 'head', 'tail', 'less', 'more', 'grep', 'egrep', 'fgrep', 'rg', 'ag', 'ls', 'find', 'sed', 'awk', 'gawk', 'bat', 'tree', 'nl', 'strings', 'xxd', 'od']);
const WRAPPERS = new Set(['sudo', 'command', 'env', 'nice', 'time', 'exec', 'nohup']);

/** Quote-aware split of a shell command into segments of words, cut at `|`, `;`, `&`, `(`, `)` and newlines. */
function shellSegments(command) {
  const segments = [[]];
  let word = null;
  let quote = '';
  const end = () => { if (word !== null) segments[segments.length - 1].push(word); word = null; };
  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];
    if (quote) { if (ch === quote) quote = ''; else word = (word || '') + ch; continue; }
    if (ch === '"' || ch === "'") { quote = ch; word = word || ''; continue; }
    if (ch === '\\' && i + 1 < command.length) { word = (word || '') + command[i += 1]; continue; }
    if (/[|;&()\n`]/.test(ch)) { end(); if (segments[segments.length - 1].length) segments.push([]); continue; }
    if (ch === '<' || ch === '>') { end(); segments[segments.length - 1].push(ch); continue; }
    if (/\s/.test(ch)) { end(); continue; }
    word = (word || '') + ch;
  }
  end();
  return segments.filter((s) => s.length);
}

/**
 * The archive path a shell command reads, or null. Only a read, list or search command (or an
 * input redirect) counts, so `mv`, `cp`, `mkdir`, `git mv` and `mewkit plan archive` aimed at
 * the archive pass, and a search rooted outside it (`grep -r . x`) passes too.
 */
function archiveReadInCommand(command) {
  for (const words of shellSegments(command)) {
    for (let i = 0; i < words.length - 1; i += 1) if (words[i] === '<' && isArchivedPlanPath(words[i + 1])) return words[i + 1];
    let at = 0;
    while (at < words.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[at]) || WRAPPERS.has(words[at]))) at += 1;
    const verb = (words[at] || '').replace(/^.*\//, '');
    if (!READ_VERBS.has(verb)) continue;
    // An output redirect target is written, not read (`cat > archive/x/notes.md`).
    const args = [];
    for (let i = at + 1; i < words.length; i += 1) {
      if (words[i] === '>') { while (words[i + 1] === '>') i += 1; i += 1; continue; }
      if (words[i] !== '<') args.push(words[i]);
    }
    if (verb === 'sed' && args.some((a) => /^-[a-zA-Z]*i|^--in-place/.test(a))) continue;
    let positional = args.filter((a) => !a.startsWith('-'));
    // A search's first positional word is its pattern unless -e/-f gave one.
    if (/^(?:e|f)?grep$|^rg$|^ag$/.test(verb) && !args.some((a) => /^-(?:e|f|-regexp|-file)/.test(a))) positional = positional.slice(1);
    // Option values are left out: `--exclude-dir=archive` names the archive to skip it.
    const hit = positional.find(isArchivedPlanPath);
    if (hit) return hit;
  }
  return null;
}

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

/** @param {{ paths: string[], command?: string, toolName?: string }} input */
function decidePrivacy({ paths, command = '', toolName = '' }) {
  const named = paths.filter(Boolean);
  for (const filePath of named) {
    const blocked = checkPath(filePath);
    if (blocked) return blocked;
  }
  return checkCommand(command) || checkArchive({ paths: named, command, toolName }) || ALLOW;
}

module.exports = { decidePrivacy, isSensitive, isArchivedPlanPath, archiveReadInCommand };
