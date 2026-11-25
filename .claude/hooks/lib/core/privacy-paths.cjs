'use strict';
// privacy-paths.cjs — which paths the privacy decision protects: credential-bearing files and
// archived plans. Pure apart from resolving a named path that exists, to see through a symlink.

const fs = require('node:fs');

/**
 * Credential-bearing files, matched against the path with `\` turned into `/`: dotenv and
 * direnv files, keys, certificates and keystores, credential stores and cloud CLI config,
 * package-registry and container-registry tokens, Terraform state and variables, service
 * account keys, ssh private keys (any suffix but `.pub`), and the ssh, aws, gnupg, kube,
 * gcloud and azure config directories (the directory itself, so a search or archive of it counts). Names are anchored on path segments so a source file
 * that merely contains one of the words (`kubeconfig.ts`) is not a credential.
 */
const SENSITIVE_PATH = new RegExp([
  String.raw`\.env(?:$|\.)`,
  String.raw`(?:^|/)\.envrc$`,
  String.raw`(?:^|/)\.npmrc$`,
  String.raw`(?:^|/)\.pypirc$`,
  String.raw`(?:^|/)[._]netrc$`,
  String.raw`(?:^|/)\.htpasswd$`,
  String.raw`(?:^|/)\.claude\.json$`,
  String.raw`(?:^|/)id_(?:rsa|ed25519|ecdsa|dsa)(?![^/]*\.pub$)(?:[._-][^/]*)?$`,
  String.raw`\.(?:key|pem|p12|pfx|jks)$`,
  String.raw`\.tfstate(?:\.backup)?$`,
  String.raw`\.tfvars(?:\.json)?$`,
  String.raw`(?:^|/)[^/]*service[-_]?account[^/]*\.json$`,
  String.raw`(?:^|/)(?:[^/]+[._-])?kubeconfig(?:\.ya?ml|\.json)?$`,
  'credentials',
  'keystore',
  String.raw`\.ssh(?:/|$)`,
  String.raw`(?:^|/)\.(?:aws|gnupg|azure)(?:/|$)`,
  String.raw`(?:^|/)\.config/gcloud(?:/|$)`,
  String.raw`(?:^|/)\.config/gh/hosts\.ya?ml$`,
  String.raw`(?:^|/)\.docker/config\.json$`,
  String.raw`(?:^|/)\.kube/config$`,
].join('|'), 'i');

/** `secret` must stand as a word in a file or directory name, so `secretary.ts` is not a credential. */
const SECRET_WORD = /(?:^|[/._-])secrets?(?:[/._-]|$)/i;

/**
 * Markdown inside a skills tree the kit installs is documentation (`phase-2-3-secrets-dependencies.md`
 * explains secret scanning, it holds none). Only the `secret` word rule is waived there.
 */
const KIT_SKILL_DOC = /(?:^|\/)\.(?:claude|agents?|cursor|codex|grok|pi|omp)\/skills\/.+\.md$/i;

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
  if (EXEMPT_BASENAME.test(base)) return false;
  return SENSITIVE_PATH.test(norm) || (SECRET_WORD.test(norm) && !KIT_SKILL_DOC.test(norm));
}

/**
 * True for a credential path, by the name it is called or, when it exists, by the file it
 * resolves to, so a harmless-looking symlink to `.env` is refused as `.env` is — and a skill
 * document that is a link to a real secrets file is judged as that file.
 */
function isSensitive(filePath) {
  if (!filePath) return false;
  if (matches(filePath)) return true;
  try {
    return matches(fs.realpathSync(filePath));
  } catch {
    return false;
  }
}

/**
 * True when a search glob (Grep's `glob`) can select a credential file: each brace
 * alternative, with wildcards removed, is judged as a name. A `!` glob excludes and passes.
 */
function globTargetsSensitive(glob) {
  if (typeof glob !== 'string' || !glob || glob.startsWith('!')) return false;
  const braced = glob.match(/^(.*?)\{([^{}]*)\}(.*)$/);
  const alternatives = braced ? braced[2].split(',').map((alt) => braced[1] + alt + braced[3]) : [glob];
  return alternatives.some((alt) => matches(alt.replace(/\[([^\]])[^\]]*\]/g, '$1').replace(/[*?]/g, '')));
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

module.exports = { normalise, isSensitive, isArchivedPlanPath, globTargetsSensitive };
