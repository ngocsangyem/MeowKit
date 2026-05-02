#!/usr/bin/env node
/**
 * terminology-linter.cjs — Flags non-canonical terms across website/**\/*.md
 *
 * Usage: node scripts/terminology-linter.cjs
 */

const fs = require('fs');
const path = require('path');

const WEBSITE_DIR = path.resolve(__dirname, '..', 'website');

// Canonical terms — if one of the "wrong" patterns is found, flag it
const RULES = [
  {
    canonical: '7-phase pipeline / Workflow',
    wrong: [/\b5[ -]?phase\s+(workflow|pipeline|process)/gi, /\bfive[ -]?phase\s+(workflow|pipeline|process)/gi],
    note: 'Use "7-phase pipeline" or "Workflow" (Orient→Plan→Test→Build→Review→Ship→Reflect)',
    ignoreFiles: ['changelog.md'], // historical accuracy
  },
  {
    canonical: '$30/$100 budget thresholds',
    wrong: [/\$10\b/g, /\$25\b/g],
    note: 'Budget thresholds are $30 (warn) / $100 (block), not $10/$25',
    ignoreFiles: ['changelog.md'], // historical accuracy
  },
  {
    canonical: '77 skills',
    wrong: [/\b75 skills?\b/gi, /\b76 skills?\b/gi, /\b78 skills?\b/gi],
    note: 'Current count is 77 skills. Verify before changing.',
    ignoreFiles: ['changelog.md'],
  },
  {
    canonical: '17 agents',
    wrong: [/\b16 agents?\b/gi, /\b18 agents?\b/gi, /\b19 agents?\b/gi],
    note: 'Current count is 17 agents. Verify before changing.',
    ignoreFiles: ['changelog.md'],
  },
  {
    canonical: '21 commands',
    wrong: [/\b20 commands?\b/gi, /\b22 commands?\b/gi],
    note: 'Current count is 21 commands. Verify before changing.',
    ignoreFiles: ['changelog.md'],
  },
  // Legacy: memory-loader was deleted in v2.4.1
  {
    canonical: 'on-demand memory (no loader)',
    wrong: [/memory-loader/g],
    note: 'memory-loader was deleted in v2.4.1. Memory is on-demand, no auto-loader.',
    ignoreFiles: ['changelog.md', 'hooks.md'], // historical accuracy
  },
];

function getAllMarkdownFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.vitepress') continue;
    if (entry.name === 'node_modules') continue;
    if (entry.name === 'dist') continue; // skip build output
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllMarkdownFiles(fullPath));
    } else if (entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

function main() {
  const files = getAllMarkdownFiles(WEBSITE_DIR);
  const violations = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relPath = path.relative(WEBSITE_DIR, file);

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
