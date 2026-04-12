// validate-content.cjs — Shared injection pattern validator for memory content.
// Used by conversation-summary-cache and immediate-capture-handler.

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
