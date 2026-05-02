#!/usr/bin/env node
/**
 * link-checker.cjs — Validates all internal markdown links across website/
 *
 * Usage: node scripts/link-checker.cjs
 */

const fs = require('fs');
const path = require('path');

const WEBSITE_DIR = path.resolve(__dirname, '..', 'website');
const MARKDOWN_LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;
const BROKEN_LINKS = [];

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

function resolveLink(fromFile, link) {
  if (link.startsWith('http://') || link.startsWith('https://')) return null; // external
  if (link.startsWith('mailto:')) return null;
  if (link.startsWith('#')) return null; // anchor within same page
  if (link.startsWith('//')) return null;

  const fromDir = path.dirname(fromFile);
  let resolved;

  if (link.startsWith('/')) {
    // Absolute: /foo/bar → website/foo/bar.md or website/foo/bar/index.md
    resolved = path.join(WEBSITE_DIR, link.replace(/^\//, ''));
  } else {
    // Relative
    resolved = path.resolve(fromDir, link);
  }

  // Try exact path
  if (fs.existsSync(resolved)) return null;

  // Try .md extension
  if (fs.existsSync(resolved + '.md')) return null;

  // Try index.md in directory
  if (fs.existsSync(path.join(resolved, 'index.md'))) return null;

  return { from: path.relative(WEBSITE_DIR, fromFile), link, resolved: path.relative(WEBSITE_DIR, resolved) };
}

function main() {
  const files = getAllMarkdownFiles(WEBSITE_DIR);
  console.log(`Checking ${files.length} markdown files...\n`);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relPath = path.relative(WEBSITE_DIR, file);
    let match;
    while ((match = MARKDOWN_LINK_RE.exec(content)) !== null) {
      const [, text, link] = match;
      const result = resolveLink(file, link);
      if (result) {
        BROKEN_LINKS.push(result);
        console.log(`  BROKEN: ${relPath} → "${link}" (${text || 'no text'})`);
      }
    }
  }

  console.log(`\n---`);
  if (BROKEN_LINKS.length === 0) {
    console.log(`✅ All links valid.`);
    process.exit(0);
  } else {
    console.log(`❌ ${BROKEN_LINKS.length} broken link(s) found.`);
    process.exit(1);
  }
}

main();
