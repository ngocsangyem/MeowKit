#!/usr/bin/env node

/**
 * Tests for analyze-results.js
 */

const {
  analyzeResult,
  analyzeLlmsTxt,
  analyzeChubResult,
  checkContextBudget,
  parseUrls,
  groupByPriority,
  categorizeUrl,
  suggestDistribution,
  CONTEXT_BUDGET_TOKENS,
} = require('../analyze-results');

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

console.log('Running analyze-results.js tests...\n');

// ─── categorizeUrl ──────────────────────────────────────────────────
console.log('## categorizeUrl()');
assertEqual(categorizeUrl('https://docs.example.com/getting-started'), 'critical', 'getting-started → critical');
assertEqual(categorizeUrl('https://docs.example.com/installation'), 'critical', 'installation → critical');
assertEqual(categorizeUrl('https://docs.example.com/guide/routing'), 'important', 'routing guide → important');
assertEqual(categorizeUrl('https://docs.example.com/api-reference'), 'important', 'api-reference → important');
assertEqual(categorizeUrl('https://docs.example.com/advanced/internals'), 'supplementary', 'internals → supplementary');
assertEqual(categorizeUrl('https://docs.example.com/migration'), 'supplementary', 'migration → supplementary');
assertEqual(categorizeUrl('https://docs.example.com/random-page'), 'important', 'Unknown → default important');

// ─── parseUrls ──────────────────────────────────────────────────────
console.log('\n## parseUrls()');

const sampleLlmsTxt = `# Documentation
https://docs.example.com/getting-started
https://docs.example.com/guide
# Comment line
https://docs.example.com/api-reference

https://docs.example.com/advanced
`;

const urls = parseUrls(sampleLlmsTxt);
assertEqual(urls.length, 4, 'Parses 4 URLs');
assert(urls[0].includes('getting-started'), 'First URL correct');

assertEqual(parseUrls('').length, 0, 'Empty → 0 URLs');
assertEqual(parseUrls(null).length, 0, 'Null → 0 URLs');
assertEqual(parseUrls('no urls here').length, 0, 'No URLs → 0');

// ─── groupByPriority ────────────────────────────────────────────────
console.log('\n## groupByPriority()');

const testUrls = [
  'https://docs.example.com/getting-started',
  'https://docs.example.com/guide/routing',
  'https://docs.example.com/advanced/internals',
  'https://docs.example.com/installation',
];

const grouped = groupByPriority(testUrls);
assert(grouped.critical.length >= 2, 'Has ≥2 critical URLs');
assert(grouped.important.length >= 1, 'Has ≥1 important URL');
assert(grouped.supplementary.length >= 1, 'Has ≥1 supplementary URL');

// ─── suggestDistribution ────────────────────────────────────────────
console.log('\n## suggestDistribution()');

const d1 = suggestDistribution(2);
assertEqual(d1.agentCount, 1, '2 URLs → 1 agent');
assertEqual(d1.strategy, 'single', 'Strategy: single');

const d2 = suggestDistribution(8);
assert(d2.agentCount >= 3 && d2.agentCount <= 5, '8 URLs → 3-5 agents');
assertEqual(d2.strategy, 'parallel', 'Strategy: parallel');

const d3 = suggestDistribution(15);
assertEqual(d3.agentCount, 7, '15 URLs → 7 agents');

const d4 = suggestDistribution(25);
assertEqual(d4.strategy, 'phased', '25 URLs → phased strategy');
assertEqual(d4.phases, 2, 'Two phases');

// ─── checkContextBudget ─────────────────────────────────────────────
console.log('\n## checkContextBudget()');

const shortContent = 'a'.repeat(4000); // ~1000 tokens
const b1 = checkContextBudget(shortContent);
assert(b1.withinBudget === true, 'Short content within budget');
assertEqual(b1.action, 'inline', 'Action: inline');

const longContent = 'a'.repeat(20000); // ~5000 tokens
const b2 = checkContextBudget(longContent);
assert(b2.withinBudget === false, 'Long content exceeds budget');
assertEqual(b2.action, 'write-to-file', 'Action: write-to-file');

assertEqual(checkContextBudget('').budget, CONTEXT_BUDGET_TOKENS, 'Budget constant is 3000');

// ─── analyzeLlmsTxt ─────────────────────────────────────────────────
console.log('\n## analyzeLlmsTxt()');

const analysis = analyzeLlmsTxt(sampleLlmsTxt);
assertEqual(analysis.type, 'llms-txt', 'Type is llms-txt');
assertEqual(analysis.totalUrls, 4, 'Counts 4 URLs');
assert(analysis.grouped !== undefined, 'Has grouped URLs');
assert(analysis.distribution !== undefined, 'Has distribution');
assert(analysis.budget !== undefined, 'Has budget check');

// ─── analyzeChubResult ──────────────────────────────────────────────
console.log('\n## analyzeChubResult()');

const chubContent = `# Stripe Webhooks

## Setup
Configure your endpoint...

## Event Types
\`\`\`javascript
const event = stripe.webhooks.constructEvent(body, sig, secret);
\`\`\`

## Verification
Always verify signatures...
`;

const chubAnalysis = analyzeChubResult(chubContent, { id: 'stripe', lang: 'js' });
assertEqual(chubAnalysis.type, 'chub', 'Type is chub');
assertEqual(chubAnalysis.id, 'stripe', 'ID preserved');
assertEqual(chubAnalysis.lang, 'js', 'Language preserved');
assert(chubAnalysis.sectionCount >= 3, 'Found ≥3 sections');
assert(chubAnalysis.hasCodeExamples === true, 'Detected code examples');
assert(chubAnalysis.budget !== undefined, 'Has budget check');

// ─── analyzeResult — auto-detection ─────────────────────────────────
console.log('\n## analyzeResult() — auto-detection');

const autoLlms = analyzeResult(sampleLlmsTxt);
assertEqual(autoLlms.type, 'llms-txt', 'Auto-detects llms.txt');

const autoChub = analyzeResult(chubContent, { id: 'test' });
assertEqual(autoChub.type, 'chub', 'Auto-detects chub content');

const emptyResult = analyzeResult('');
assert(emptyResult.error !== undefined, 'Empty → error');

// ─── Summary ────────────────────────────────────────────────────────
console.log('\n## Test Summary');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

process.exit(failed > 0 ? 1 : 0);
