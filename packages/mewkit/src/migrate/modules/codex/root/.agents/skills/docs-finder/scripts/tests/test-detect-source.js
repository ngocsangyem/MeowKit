#!/usr/bin/env node

/**
 * Tests for detect-source.js
 */

const {
  detectSource,
  detectTopic,
  normalizeTopic,
  normalizeLibrary,
  resolveRepo,
  isInternalQuery,
} = require('../detect-source');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`✓ ${message}`); passed++; }
  else { console.error(`✗ ${message}`); failed++; }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) { console.log(`✓ ${message}`); passed++; }
  else { console.error(`✗ ${message}\n  Expected: ${expected}\n  Actual: ${actual}`); failed++; }
}

console.log('Running detect-source.js tests...\n');

// ─── normalizeTopic ─────────────────────────────────────────────────
console.log('## normalizeTopic()');
assertEqual(normalizeTopic('date picker'), 'date', 'Multi-word → first word');
assertEqual(normalizeTopic('OAuth'), 'oauth', 'Uppercase → lowercase');
assertEqual(normalizeTopic('Server-Side'), 'server', 'Hyphenated → first word');
assertEqual(normalizeTopic('caching'), 'caching', 'Single word preserved');

// ─── normalizeLibrary ───────────────────────────────────────────────
console.log('\n## normalizeLibrary()');
assertEqual(normalizeLibrary('Next.js'), 'next.js', 'Dots preserved');
assertEqual(normalizeLibrary('shadcn/ui'), 'shadcn/ui', 'Slashes preserved');
assertEqual(normalizeLibrary('Better Auth'), 'better-auth', 'Spaces → hyphens');

// ─── resolveRepo ────────────────────────────────────────────────────
console.log('\n## resolveRepo()');
assertEqual(resolveRepo('next.js'), 'vercel/next.js', 'Resolves next.js');
assertEqual(resolveRepo('shadcn'), 'shadcn-ui/ui', 'Resolves shadcn');
assertEqual(resolveRepo('vue'), 'vuejs/core', 'Resolves vue');
assertEqual(resolveRepo('unknown-lib'), null, 'Unknown returns null');

// ─── isInternalQuery ────────────────────────────────────────────────
console.log('\n## isInternalQuery()');
assert(isInternalQuery('find our API auth spec'), '"our" triggers internal');
assert(isInternalQuery('internal API documentation'), '"internal" triggers internal');
assert(!isInternalQuery('Next.js API reference'), 'Library query is NOT internal');
assert(!isInternalQuery('How to use Stripe webhooks'), 'External lib is NOT internal');

// ─── detectTopic — topic-specific queries ───────────────────────────
console.log('\n## detectTopic() — topic-specific');

const t1 = detectTopic('How do I use date picker in shadcn/ui?');
assert(t1 !== null, 'Detects topic-specific query');
assert(t1 && t1.isTopicSpecific === true, 'Marked topic-specific');
assertEqual(t1 && t1.topic, 'date', 'Topic = "date"');
assertEqual(t1 && t1.library, 'shadcn/ui', 'Library = "shadcn/ui"');

const t2 = detectTopic('Next.js caching strategies');
assert(t2 !== null, 'Detects strategies pattern');
assert(t2 && t2.isTopicSpecific === true, 'Marked topic-specific');
assertEqual(t2 && t2.topic, 'caching', 'Topic = "caching"');
assertEqual(t2 && t2.library, 'next.js', 'Library = "next.js"');

const t3 = detectTopic('Implement routing in Next.js');
assert(t3 !== null, 'Detects implement pattern');
assert(t3 && t3.isTopicSpecific === true, 'Marked topic-specific');

// ─── detectTopic — general queries ──────────────────────────────────
console.log('\n## detectTopic() — general');

const g1 = detectTopic('Documentation for Next.js');
assert(g1 !== null, 'Returns object for general query');
assert(g1 && g1.isTopicSpecific === false, 'NOT topic-specific');
assertEqual(g1 && g1.library, 'next.js', 'Library extracted');

const g2 = detectTopic('Astro getting started');
assert(g2 !== null, 'Returns object for getting-started');
assert(g2 && g2.isTopicSpecific === false, 'NOT topic-specific');

// ─── detectSource — full routing ────────────────────────────────────
console.log('\n## detectSource() — full routing');

const s1 = detectSource('How do I use date picker in shadcn/ui?');
assertEqual(s1.queryType, 'LIBRARY_DOCS', 'Library docs type');
assertEqual(s1.source, 'context7', 'Routes to context7');
assertEqual(s1.library, 'shadcn/ui', 'Library extracted');
assertEqual(s1.topic, 'date', 'Topic extracted');

const s2 = detectSource('find our API auth spec');
assertEqual(s2.queryType, 'INTERNAL_DOCS', 'Internal docs type');
assertEqual(s2.source, 'chub', 'Routes to chub');

const s3 = detectSource('Documentation for Vue');
assertEqual(s3.queryType, 'LIBRARY_DOCS', 'Library docs type');
assertEqual(s3.source, 'context7', 'Routes to context7');
assert(s3.repo === 'vuejs/core', 'Resolves vue repo');

const s4 = detectSource('internal project authentication design');
assertEqual(s4.queryType, 'INTERNAL_DOCS', 'Internal docs');
assertEqual(s4.source, 'chub', 'Routes to chub');

// ─── Edge cases ─────────────────────────────────────────────────────
console.log('\n## Edge cases');

const e1 = detectSource('');
assert(e1.error !== undefined, 'Empty string returns error');

const e2 = detectSource(null);
assert(e2.error !== undefined, 'Null returns error');

const e3 = detectSource('random text without library');
assertEqual(e3.queryType, 'LIBRARY_DOCS', 'Defaults to LIBRARY_DOCS');
assertEqual(e3.source, 'context7', 'Defaults to context7');

// ─── Summary ────────────────────────────────────────────────────────
console.log('\n## Test Summary');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

process.exit(failed > 0 ? 1 : 0);
