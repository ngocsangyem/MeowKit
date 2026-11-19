'use strict';
// injection-audit-patterns.cjs — the output-validation pattern set.
//
// Every pattern is stored as its SOURCE STRING and compiled from it, because a
// finding's description quotes the pattern that matched. Writing these as
// regular-expression literals instead would make each description depend on how
// the engine chooses to re-serialize a literal, and a consumer that compares
// descriptions across versions would see churn that means nothing.
//
// `String.raw` is used so a source string is exactly the characters a reader
// sees — no escaping layer sits between this file and the compiled pattern, and
// no description can acquire a stray backslash.
//
// Flags are per-pattern, not per-class: the two key-material patterns are
// case-sensitive on purpose, because the armour lines they match are
// case-sensitive and a loose match on them is almost always a false positive.

/** `CRITICAL` — output claiming its own instructions were replaced. */
const IDENTITY_OVERRIDE = [
  String.raw`I am now (?!going to|ready|done|finished)`,
  String.raw`my new instructions are`,
  String.raw`ignoring previous rules`,
  String.raw`I have been instructed to`,
  String.raw`my new role is`,
  String.raw`I(?:'m| am) no longer (?:bound|restricted|limited)`,
].map((source) => ({ source, flags: 'i' }));

/** `CRITICAL` — a path for project data to leave the machine. */
const EXFILTRATION = [
  String.raw`curl\s+.*\$\(`,
  String.raw`wget\s+.*\$\(`,
  String.raw`curl\s+.*-d\s+@`,
  String.raw`curl\s+.*--data.*@`,
  String.raw`base64\s+(--decode|-d)?\s*["\']?[A-Za-z0-9+/=]{50,}`,
  String.raw`nc\s+-[a-z]*\s+\d+`,
].map((source) => ({ source, flags: 'i' }));

/** `SUSPICIOUS` — credential material sitting in written output. */
const SENSITIVE_DATA = [
  { source: String.raw`(api[_-]?key|apikey)\s*[:=]\s*['\"][^'\"]{10,}`, flags: 'i' },
  { source: String.raw`(password|passwd)\s*[:=]\s*['\"][^'\"]+`, flags: 'i' },
  { source: String.raw`(secret|token)\s*[:=]\s*['\"][^'\"]{10,}`, flags: 'i' },
  { source: String.raw`-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----`, flags: '' },
  { source: String.raw`ssh-(rsa|ed25519|ecdsa)\s+[A-Za-z0-9+/=]{50,}`, flags: '' },
];

/** `SUSPICIOUS` — a command no task asked for. */
const UNEXPECTED_COMMAND = [
  String.raw`rm\s+-rf\s+/`,
  String.raw`chmod\s+777`,
  String.raw`eval\s*\(`,
  String.raw`exec\s*\(`,
  String.raw`os\.system\s*\(`,
  String.raw`subprocess\.call\s*\(.*shell\s*=\s*True`,
  String.raw`>>?\s*~/\.bashrc`,
  String.raw`>>?\s*~/\.zshrc`,
].map((source) => ({ source, flags: 'i' }));

/**
 * The classes, in the order a line is tested. The order is part of the
 * behavior: a line matching two classes reports both, and a consumer reading
 * the first finding gets the more severe one.
 */
const CLASSES = [
  { level: 'CRITICAL', category: 'IDENTITY_OVERRIDE', prefix: 'Agent identity may have been overridden', patterns: IDENTITY_OVERRIDE },
  { level: 'CRITICAL', category: 'EXFILTRATION', prefix: 'Potential data exfiltration pattern', patterns: EXFILTRATION },
  { level: 'SUSPICIOUS', category: 'SENSITIVE_DATA', prefix: 'Sensitive data pattern detected', patterns: SENSITIVE_DATA },
  { level: 'SUSPICIOUS', category: 'UNEXPECTED_COMMAND', prefix: 'Unexpected system command', patterns: UNEXPECTED_COMMAND },
].map((klass) => ({
  ...klass,
  // Compiled once. No pattern uses `g`, so none carries `lastIndex` state
  // between lines — sharing a compiled object across files stays safe.
  compiled: klass.patterns.map(({ source, flags }) => ({ source, regex: new RegExp(source, flags) })),
}));

/** Suffixes the directory walk treats as text worth scanning. */
const SCANNED_SUFFIXES = new Set([
  '.ts', '.js', '.tsx', '.jsx', '.py', '.swift',
  '.vue', '.md', '.txt', '.sh', '.sql', '.json',
  '.yaml', '.yml', '.toml', '.env', '.cfg', '.ini',
]);

/**
 * Directories the walk prunes. `.claude` is here because the kit's own rules
 * files quote the very patterns this scanner looks for, so scanning them
 * reports the documentation as an attack. A caller that needs a path under it
 * names that path explicitly, which is what the single-path mode is for.
 */
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '__pycache__', '.build', '.claude']);

module.exports = { CLASSES, SCANNED_SUFFIXES, SKIP_DIRS };
