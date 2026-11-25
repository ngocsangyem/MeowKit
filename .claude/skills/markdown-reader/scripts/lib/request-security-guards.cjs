/**
 * Request guards for the markdown-reader server.
 *
 * The server renders untrusted markdown on a localhost origin that can also
 * read local files, so every request is checked here:
 * - Host header must name this server (blocks DNS-rebinding pages that resolve
 *   their own hostname to 127.0.0.1 and then read /file/ responses).
 * - Paths are contained by realpath + path.sep, so symlinks and sibling
 *   directories sharing a name prefix ("/proj" vs "/proj-other") are refused.
 * - Dotfiles and credential-like names are never served.
 * - Responses carry a Content-Security-Policy so HTML that slips through the
 *   renderer, or an .html/.svg file served from /file/, cannot run script.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/** True when the Host header is 127.0.0.1:<port> or localhost:<port>. */
function isHostAllowed(hostHeader, port) {
  if (typeof hostHeader !== 'string' || !port) return false;
  const host = hostHeader.trim().toLowerCase();
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
}

/** Resolve symlinks; returns null when the path does not exist. */
function realPathOrNull(p) {
  try {
    return fs.realpathSync(path.resolve(p));
  } catch {
    return null;
  }
}

/** Real paths of the allowed base dirs (missing dirs dropped). */
function realAllowedDirs(dirs) {
  return dirs.map(realPathOrNull).filter(Boolean);
}

/**
 * Return the real path of filePath when it lies inside one of the allowed
 * (already real) dirs, otherwise null.
 */
function containedRealPath(filePath, allowedRealDirs) {
  if (typeof filePath !== 'string' || filePath.includes('\0')) return null;
  const real = realPathOrNull(filePath);
  if (!real) return null;
  const inside = allowedRealDirs.some(dir =>
    real === dir || real.startsWith(dir.endsWith(path.sep) ? dir : dir + path.sep));
  return inside ? real : null;
}

// Names never served: dotfiles (.env, .git, .npmrc, ...) and credential-like
// files. Checked on every path segment below the allowed base dir.
const SENSITIVE_NAME = /secret|credential|\.pem$|\.key$|\.p12$|\.pfx$|\.keystore$|^id_[a-z0-9]+$/i;

/** True when any segment of realPath under its base dir is hidden or sensitive. */
function isSensitivePath(realPath, allowedRealDirs) {
  const base = allowedRealDirs
    .filter(dir => realPath === dir || realPath.startsWith(dir + path.sep))
    .sort((a, b) => b.length - a.length)[0];
  const rel = base ? path.relative(base, realPath) : realPath;
  return rel.split(path.sep).some(seg => seg.startsWith('.') || SENSITIVE_NAME.test(seg));
}

/** Per-response nonce for the viewer's own inline scripts. */
function createNonce() {
  return crypto.randomBytes(16).toString('base64');
}

// Default for every response: no script at all.
const STRICT_CSP = [
  "default-src 'none'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join('; ');

/**
 * Viewer page policy: only nonced scripts plus the pinned Mermaid ESM path.
 * Inline event handlers and javascript: URLs stay blocked.
 */
function viewerCsp(nonce) {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}' https://cdn.jsdelivr.net/npm/mermaid@11/`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
    'font-src https://fonts.gstatic.com',
    "img-src 'self' data: https:",
    "connect-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'"
  ].join('; ');
}

module.exports = {
  isHostAllowed,
  realAllowedDirs,
  containedRealPath,
  isSensitivePath,
  createNonce,
  STRICT_CSP,
  viewerCsp
};
