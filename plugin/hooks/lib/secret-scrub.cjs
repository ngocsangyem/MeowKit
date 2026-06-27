// secret-scrub.cjs — JS port of secret-scrub.sh regex set.
// Mirrors the shell version pattern-for-pattern to keep parity across capture
// paths that prefer in-process scrubbing (lower latency, consistent on all OSes).
// Conservative: false positives accepted, missed secrets are not.

'use strict';

const PATTERNS = [
  [/sk-ant-[A-Za-z0-9_-]{20,}/g, '[REDACTED-ANTHROPIC-KEY]'],
  [/sk-[A-Za-z0-9_-]{20,}/g, '[REDACTED-OPENAI-KEY]'],
  // Stripe live/test secret keys + restricted keys use underscore-style.
  [/sk_(live|test)_[A-Za-z0-9]{16,}/g, '[REDACTED-STRIPE-KEY]'],
  [/rk_(live|test)_[A-Za-z0-9]{16,}/g, '[REDACTED-STRIPE-RESTRICTED-KEY]'],
  [/pk_(live|test)_[A-Za-z0-9]{16,}/g, '[REDACTED-STRIPE-PUB-KEY]'],
  [/AKIA[0-9A-Z]{16}/g, '[REDACTED-AWS-KEY]'],
  [/ghp_[A-Za-z0-9]{30,}/g, '[REDACTED-GH-TOKEN]'],
  [/gho_[A-Za-z0-9]{30,}/g, '[REDACTED-GH-OAUTH]'],
  [/glpat-[A-Za-z0-9_-]{20,}/g, '[REDACTED-GITLAB-PAT]'],
  [/xox[bpars]-[0-9]+-[0-9]+-[0-9]+-[A-Za-z0-9]{24,}/g, '[REDACTED-SLACK-TOKEN]'],
  [/https:\/\/hooks\.slack\.com\/services\/[A-Z0-9/]+/g, '[REDACTED-SLACK-WEBHOOK]'],
  [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, '[REDACTED-JWT]'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[^-]*-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTED-PRIVATE-KEY]'],
  // Generic key=value (case-insensitive) — captures api_key, apikey, password, passwd, secret, token
  [/(api[_-]?key|apikey|password|passwd|secret|token)(\s*[:=]\s*)["']?[A-Za-z0-9_/+=.-]{16,}["']?/gi, '$1$2[REDACTED]'],
  [/Bearer [A-Za-z0-9_/+=.-]{20,}/g, 'Bearer [REDACTED]'],
  [/(mysql|postgres|postgresql|mongodb|redis):\/\/[^\s"']+/gi, '$1://[REDACTED-DB-URL]'],
  [/[A-Za-z0-9._%+-]{3,}@[A-Za-z0-9.-]{3,}\.[A-Za-z]{2,}/g, '[REDACTED-EMAIL]'],
  [/(MEOWKIT_[A-Z_]*(?:KEY|SECRET|TOKEN|PASSWORD))(\s*=\s*)\S{8,}/g, '$1$2[REDACTED]'],
];

function scrubSecrets(input) {
  if (typeof input !== 'string' || !input) return '';
  let out = input;
  for (const [re, replacement] of PATTERNS) out = out.replace(re, replacement);
  return out;
}

module.exports = { scrubSecrets, PATTERNS };
