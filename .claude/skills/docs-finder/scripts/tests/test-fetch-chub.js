#!/usr/bin/env node

/**
 * Tests for fetch-chub.js (unit tests — no chub CLI required)
 */

const { detectLanguage, chubCommand, CHUB_PACKAGE } = require('../fetch-chub');

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

console.log('Running fetch-chub.js tests...\n');

// ─── detectLanguage ─────────────────────────────────────────────────
console.log('## detectLanguage()');

assertEqual(detectLanguage('Stripe Python SDK webhooks'), 'py', 'Detects Python');
assertEqual(detectLanguage('Express.js middleware'), 'js', 'Detects JavaScript');
assertEqual(detectLanguage('NestJS TypeScript guards'), 'ts', 'Detects TypeScript');
assertEqual(detectLanguage('Golang HTTP handlers'), 'go', 'Detects Go');
assertEqual(detectLanguage('Ruby on Rails authentication'), 'rb', 'Detects Ruby');
assertEqual(detectLanguage('Rust async runtime'), 'rs', 'Detects Rust');
assertEqual(detectLanguage('SwiftUI navigation patterns'), 'swift', 'Detects Swift');
assertEqual(detectLanguage('Kotlin Jetpack Compose'), 'kt', 'Detects Kotlin');
assertEqual(detectLanguage('How to use date picker'), null, 'No language → null');
assertEqual(detectLanguage('Vue 3 Suspense'), null, 'Vue without lang hint → null');

// ─── chubCommand ───────────────────────────────────────────────────
console.log('\n## chubCommand()');

// The bare `npx chub` resolves the unrelated npm package `chub`; every call
// must name the Context Hub package at a fixed version.
assert(/^@aisuite\/chub@\d+\.\d+\.\d+$/.test(CHUB_PACKAGE), 'Package is @aisuite/chub at an exact version');
assertEqual(chubCommand('--version'), `npx --yes --package=${CHUB_PACKAGE} chub --version`, 'Runs the pinned package\'s chub bin');
assert(!/npx chub/.test(chubCommand("search 'x' --json")), 'Never the bare npx chub');

// ─── isChubAvailable (skipped — env dependent) ─────────────────────
console.log('\n## isChubAvailable() — skipped (environment dependent)');
console.log(`  (Run \`${chubCommand('--version')}\` to verify)`);

// ─── fetchChub integration (skipped — requires npx + network) ──────
console.log('\n## fetchChub() — skipped (requires npx + network)');
console.log(`  To run integration tests: ${chubCommand('search "stripe"')}`);
console.log('  Then: node scripts/fetch-chub.js "stripe webhooks" --lang js');

// ─── Summary ────────────────────────────────────────────────────────
console.log('\n## Test Summary');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

process.exit(failed > 0 ? 1 : 0);
