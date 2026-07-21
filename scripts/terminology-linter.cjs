#!/usr/bin/env node
/**
 * terminology-linter.cjs — Flags non-canonical terms across the docs content tree (*.mdx)
 *
 * Usage: node scripts/terminology-linter.cjs
 */

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.resolve(__dirname, '..', 'packages', 'docs', 'content', 'docs');

// Canonical terms — if one of the "wrong" patterns is found, flag it
const RULES = [
  {
    canonical: '7-phase pipeline / Workflow',
    wrong: [/\b5[ -]?phase\s+(workflow|pipeline|process)/gi, /\bfive[ -]?phase\s+(workflow|pipeline|process)/gi],
    note: 'Use "7-phase pipeline" or "Workflow" (Orient→Plan→Test→Build→Review→Ship→Reflect)',
    ignoreFiles: ['changelog.mdx'], // historical accuracy
  },
  {
    canonical: '$30/$100 budget thresholds',
    wrong: [/\$10\b/g, /\$25\b/g],
    note: 'Budget thresholds are $30 (warn) / $100 (block), not $10/$25',
    ignoreFiles: ['changelog.mdx'], // historical accuracy
  },
  // Inventory-derived counts are checked by \`mewkit inventory --check\`; this
  // terminology-only linter must not carry a second volatile count source.
  // Legacy: memory-loader was deleted in v2.4.1
  {
    canonical: 'on-demand memory (no loader)',
    wrong: [/memory-loader/g],
    note: 'memory-loader was deleted in v2.4.1. Memory is on-demand, no auto-loader.',
    ignoreFiles: ['changelog.mdx', 'hooks.mdx'], // historical accuracy
  },
];

function getAllMarkdownFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'node_modules') continue;
    if (entry.name === 'dist') continue; // skip build output
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllMarkdownFiles(fullPath));
    } else if (entry.name.endsWith('.mdx')) {
      results.push(fullPath);
    }
  }
  return results;
}

function main() {
  const files = getAllMarkdownFiles(DOCS_DIR);
  const violations = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relPath = path.relative(DOCS_DIR, file);

    for (const rule of RULES) {
      if (rule.ignoreFiles && rule.ignoreFiles.includes(path.basename(file))) continue;
      for (const pattern of rule.wrong) {
        const matches = content.match(pattern);
        if (matches) {
          for (const m of matches) {
            violations.push({ file: relPath, found: m, canonical: rule.canonical, note: rule.note });
          }
        }
      }
    }
  }

  if (violations.length === 0) {
    console.log('✅ All terminology checks passed.');
    process.exit(0);
  } else {
    console.log(`❌ ${violations.length} terminology violation(s):\n`);
    for (const v of violations) {
      console.log(`  ${v.file}: "${v.found}" → use "${v.canonical}"`);
      console.log(`    ${v.note}\n`);
    }
    process.exit(1);
  }
}

main();
