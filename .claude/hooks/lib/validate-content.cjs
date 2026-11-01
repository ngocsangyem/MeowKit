// validate-content.cjs — Injection pattern validator for text crossing a DATA
// boundary. Its live consumer is `.claude/skills/intake/scripts/sanitize-ticket.cjs`
// (untrusted external ticket text).
//
// NOT the validator behind `mewkit validate --memory` / `mewkit note` — those use
// the CLI's own `state/injection-scanner`, which carries the full pattern set. The
// subset below is a deliberately small shell-side mirror; keep it a subset, and do
// not treat a pass here as equivalent to the CLI lint.

'use strict';

const INJECTION_PATTERNS = [
  /ignore\s+(?:previous|all)\s+instructions/i,
  /disregard\s+(?:rules|instructions|safety)/i,
  /you\s+are\s+now/i,
  /forget\s+your/i,
  /new\s+system\s+prompt/i,
  /<\/?memory-data[^>]*>/i,
  /pretend\s+you\s+are/i,
  /act\s+as\s+if/i,
];

function validateContent(text) {
  if (!text) return { valid: true };
  for (const pattern of INJECTION_PATTERNS) {
    const match = text.match(pattern);
    if (match) return { valid: false, pattern: pattern.source, match: match[0] };
  }
  return { valid: true };
}

module.exports = { validateContent, INJECTION_PATTERNS };
