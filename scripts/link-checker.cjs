#!/usr/bin/env node
/**
 * link-checker.cjs — Validates all internal markdown links across the docs content tree.
 *
 * Usage: node scripts/link-checker.cjs
 */

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.resolve(__dirname, '..', 'packages', 'docs', 'content', 'docs');
const MARKDOWN_LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;
const BROKEN_LINKS = [];

function getAllMarkdownFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'node_modules') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllMarkdownFiles(fullPath));
    } else if (entry.name.endsWith('.mdx')) {
      results.push(fullPath);
    }
  }
  return results;
}

function resolveLink(fromFile, link) {
  if (link.startsWith('#')) return null; // anchor within same page
  if (link.startsWith('//')) return null;
  // Any URI scheme (http:, https:, mailto:, tel:, attachment:, …) is not a
  // repo-internal file link — includes doc examples of non-http schemes.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(link)) return null;

  const fromDir = path.dirname(fromFile);
  let resolved;

  // Strip a trailing .md (per-page raw-markdown URLs) and any #anchor/?query.
  link = link.replace(/[#?].*$/, '').replace(/\.md$/, '');
  if (link === '') return null; // was a pure anchor/query

  if (link.startsWith('/')) {
    // Absolute (root baseUrl): /foo/bar → content/docs/foo/bar.mdx or .../index.mdx
    resolved = path.join(DOCS_DIR, link.replace(/^\//, ''));
  } else {
    // Relative
    resolved = path.resolve(fromDir, link);
  }

  // Try exact path
  if (fs.existsSync(resolved)) return null;

  // Try .mdx extension
  if (fs.existsSync(resolved + '.mdx')) return null;

  // Try index.mdx in directory
  if (fs.existsSync(path.join(resolved, 'index.mdx'))) return null;

  return { from: path.relative(DOCS_DIR, fromFile), link, resolved: path.relative(DOCS_DIR, resolved) };
}

function main() {
  const files = getAllMarkdownFiles(DOCS_DIR);
  console.log(`Checking ${files.length} markdown files...\n`);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relPath = path.relative(DOCS_DIR, file);
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
