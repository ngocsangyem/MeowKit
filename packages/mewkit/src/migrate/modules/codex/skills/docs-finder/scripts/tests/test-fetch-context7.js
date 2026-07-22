#!/usr/bin/env node

/**
 * Tests for fetch-context7.js (unit tests — no network calls)
 */

const { buildContext7Url, getUrlVariations, OFFICIAL_LLMS_TXT } = require('../fetch-context7');

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

console.log('Running fetch-context7.js tests...\n');

// ─── buildContext7Url ───────────────────────────────────────────────
console.log('## buildContext7Url()');

assertEqual(
  buildContext7Url('vercel/next.js'),
  'https://context7.com/vercel/next.js/llms.txt',
  'GitHub repo URL'
);

assertEqual(
  buildContext7Url('vercel/next.js', 'cache'),
  'https://context7.com/vercel/next.js/llms.txt?topic=cache',
  'GitHub repo URL with topic'
);

assertEqual(
  buildContext7Url('shadcn-ui/ui', 'date'),
  'https://context7.com/shadcn-ui/ui/llms.txt?topic=date',
  'shadcn URL with topic'
);

assertEqual(
  buildContext7Url('express'),
  'https://context7.com/websites/express/llms.txt',
  'Non-repo library → websites/ path'
);

// ─── getUrlVariations ───────────────────────────────────────────────
console.log('\n## getUrlVariations()');

const v1 = getUrlVariations('next.js', 'cache', 'vercel/next.js');
assert(v1.length >= 3, 'Returns ≥3 variations with topic + known repo');
assertEqual(v1[0].type, 'context7-topic', 'First is topic-specific');
assertEqual(v1[1].type, 'context7-general', 'Second is general');
assertEqual(v1[2].type, 'official-llms-txt', 'Third is official llms.txt');
assert(v1[0].url.includes('?topic=cache'), 'Topic URL has topic param');

const v2 = getUrlVariations('shadcn/ui', null, 'shadcn-ui/ui');
assert(v2.length >= 1, 'Returns variations without topic');
assertEqual(v2[0].type, 'context7-general', 'First is general (no topic)');

const v3 = getUrlVariations('astro', 'routing', 'withastro/astro');
assert(v3.length >= 3, 'Astro has official llms.txt fallback');
assert(v3.some(v => v.type === 'official-llms-txt'), 'Includes official llms.txt');

const v4 = getUrlVariations('unknown-lib', 'auth', null);
assert(v4.length >= 2, 'Unknown lib still gets context7 + general');
assertEqual(v4[0].type, 'context7-topic', 'First is topic attempt');

// ─── OFFICIAL_LLMS_TXT mapping ──────────────────────────────────────
console.log('\n## Official llms.txt mapping');

assert(OFFICIAL_LLMS_TXT['astro'] !== undefined, 'Astro mapped');
assert(OFFICIAL_LLMS_TXT['next.js'] !== undefined, 'Next.js mapped');
assert(OFFICIAL_LLMS_TXT['remix'] !== undefined, 'Remix mapped');
assert(OFFICIAL_LLMS_TXT['sveltekit'] !== undefined, 'SvelteKit mapped');

// ─── Summary ────────────────────────────────────────────────────────
console.log('\n## Test Summary');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

process.exit(failed > 0 ? 1 : 0);
