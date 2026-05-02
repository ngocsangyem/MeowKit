#!/usr/bin/env node
/**
 * count-validator.cjs — Compares source component counts against doc page counts
 *
 * Usage: node scripts/count-validator.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT, 'website');

const CHECKS = [
  {
    name: 'Skills',
    source: path.join(ROOT, '.claude', 'skills'),
    sourceFilter: (entries) => entries.filter(e => e.isDirectory() && !e.name.startsWith('.') && fs.existsSync(path.join(ROOT, '.claude', 'skills', e.name, 'SKILL.md'))).length,
    docDir: path.join(WEBSITE_DIR, 'reference', 'skills'),
    docFilter: (entries) => entries.filter(e => e.name.endsWith('.md') && !e.name.startsWith('_')).length,
  },
  {
    name: 'Agents',
    source: path.join(ROOT, '.claude', 'agents'),
    sourceFilter: (entries) => entries.filter(e => e.isFile() && e.name.endsWith('.md') && !e.name.startsWith('AGENTS_') && !e.name.startsWith('SKILLS_')).length,
    docDir: path.join(WEBSITE_DIR, 'reference', 'agents'),
    docFilter: (entries) => entries.filter(e => e.name.endsWith('.md') && !e.name.startsWith('_')).length,
  },
  {
    name: 'Commands',
    source: path.join(ROOT, '.claude', 'commands', 'mk'),
    sourceFilter: (entries) => entries.filter(e => e.isFile() && e.name.endsWith('.md')).length,
    docDir: path.join(WEBSITE_DIR, 'cli'),
    docFilter: (entries) => {
      const cliFiles = entries.filter(e => e.name.endsWith('.md') && !e.name.startsWith('_'));
      // CLI docs list commands inline, not one-per-file. Check the cheatsheet and CLI pages instead.
      return 'inline'; // Special handling — commands are documented inline
    },
  },
];

function main() {
  let issues = 0;

  for (const check of CHECKS) {
    if (check.name === 'Commands') {
      // Commands are documented inline in CLI pages, not one-per-file
      const sourceEntries = fs.readdirSync(check.source, { withFileTypes: true });
      const sourceCount = check.sourceFilter(sourceEntries);
      console.log(`  Commands: ${sourceCount} source files (documented inline in /cli/ pages)`);
      continue;
    }

    const sourceEntries = fs.readdirSync(check.source, { withFileTypes: true });
    const sourceCount = check.sourceFilter(sourceEntries);

    let docCount = 0;
    if (fs.existsSync(check.docDir)) {
      const docEntries = fs.readdirSync(check.docDir, { withFileTypes: true });
      docCount = check.docFilter(docEntries);
    }

    const status = sourceCount === docCount ? '✅' : '❌';
    console.log(`  ${status} ${check.name}: ${sourceCount} source → ${docCount} doc pages`);

    if (sourceCount !== docCount) {
      issues++;
      if (sourceCount > docCount) {
        console.log(`    ⚠️  Missing ${sourceCount - docCount} doc page(s)`);
      } else {
        console.log(`    ⚠️  ${docCount - sourceCount} extra doc page(s) (possible dead pages)`);
      }
    }
  }

  // Check for dead pages (doc pages with no matching source)
  console.log(`\n  Dead page check (skills only):`);
  const skillsDocDir = path.join(WEBSITE_DIR, 'reference', 'skills');
  const skillsSourceDir = path.join(ROOT, '.claude', 'skills');
  if (fs.existsSync(skillsDocDir) && fs.existsSync(skillsSourceDir)) {
    const docFiles = fs.readdirSync(skillsDocDir, { withFileTypes: true })
      .filter(e => e.name.endsWith('.md') && !e.name.startsWith('_'))
      .map(e => e.name.replace('.md', ''));
    const sourceDirs = fs.readdirSync(skillsSourceDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('.') && fs.existsSync(path.join(skillsSourceDir, e.name, 'SKILL.md')))
      .map(e => e.name);

    const deadPages = docFiles.filter(d => !sourceDirs.includes(d));
    const missingPages = sourceDirs.filter(s => !docFiles.includes(s));

    if (deadPages.length > 0) {
      console.log(`  ❌ Dead doc pages (no source skill): ${deadPages.join(', ')}`);
      issues++;
    }
    if (missingPages.length > 0) {
      console.log(`  ❌ Missing doc pages (source skill exists): ${missingPages.join(', ')}`);
      issues++;
    }
    if (deadPages.length === 0 && missingPages.length === 0) {
      console.log(`  ✅ All skills accounted for.`);
    }
  }

  console.log(`\n---`);
  if (issues === 0) {
    console.log(`✅ All count checks passed.`);
    process.exit(0);
  } else {
    console.log(`❌ ${issues} count mismatch(es) found.`);
    process.exit(1);
  }
}

main();
