#!/usr/bin/env node
// memory-migrator.cjs — Convert freeform lessons.md to structured YAML frontmatter format.
// Run: node .claude/scripts/memory-migrator.cjs [--dry-run]
//
// Input:  .claude/memory/lessons.md (freeform ## headers with status markers)
// Output: .claude/memory/lessons.md (structured entries with YAML frontmatter)
// Backup: .claude/memory/lessons.md.bak

const fs = require('fs');
const path = require('path');

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const LESSONS_FILE = path.join(ROOT, '.claude', 'memory', 'lessons.md');
const BACKUP_FILE = LESSONS_FILE + '.bak';
const DRY_RUN = process.argv.includes('--dry-run');

// Extract domain keywords from header text
function extractDomains(header, body) {
  const combined = (header + ' ' + body).toLowerCase();
  const domains = new Set();

  // Domain keyword mapping
  const DOMAIN_MAP = {
    shell: ['shell', 'bash', 'grep', 'sed', 'awk', 'sh ', 'zsh'],
    security: ['security', 'injection', 'xss', 'csrf', 'auth', 'credential', 'secret'],
    python: ['python', 'pip', 'pyenv', 'ruff', 'mypy', 'chardet'],
    typescript: ['typescript', 'ts ', 'tsx', 'tsc', 'eslint'],
    javascript: ['javascript', 'js ', 'node', 'npm', 'cjs', 'mjs'],
    vue: ['vue', 'nuxt', 'pinia', 'composable'],
    react: ['react', 'next', 'jsx', 'tsx'],
    swift: ['swift', 'xcode', 'ios', 'swiftui'],
    database: ['sql', 'postgres', 'supabase', 'database', 'migration', 'schema'],
    testing: ['test', 'jest', 'vitest', 'playwright', 'tdd'],
    git: ['git', 'commit', 'branch', 'merge', 'pr '],
    api: ['api', 'rest', 'graphql', 'endpoint', 'webhook'],
    macos: ['macos', 'darwin', 'bsd', 'homebrew'],
  };

  for (const [domain, keywords] of Object.entries(DOMAIN_MAP)) {
    if (keywords.some((k) => combined.includes(k))) {
      domains.add(domain);
    }
  }

  return [...domains];
}

// Detect severity from content
function detectSeverity(text) {
  const lower = text.toLowerCase();
  if (lower.includes('critical') || lower.includes('security vulnerability')) return 'critical';
  if (lower.includes('security') || lower.includes('injection')) return 'security';
  return 'standard';
}

function main() {
  if (!fs.existsSync(LESSONS_FILE)) {
    console.error('lessons.md not found at', LESSONS_FILE);
    process.exit(1);
  }

  const content = fs.readFileSync(LESSONS_FILE, 'utf8');

  // Split by ## headers
  const sections = content.split(/^## /m);
  const header = sections[0]; // Preamble (title + description)
  const entries = sections.slice(1);

  console.log(`Found ${entries.length} entries to migrate`);

  let output = '# MeowKit — Session Lessons\n\n';
  output += '> Structured format with YAML frontmatter per entry.\n';
  output += '> CRITICAL/SECURITY entries are always loaded. Others filtered by domain tags.\n\n';

  let count = 0;
  for (const entry of entries) {
    count++;
    const lines = entry.trim().split('\n');
    const headerLine = lines[0];
    const body = lines.slice(1).join('\n').trim();

    // Extract date from header
    const dateMatch = headerLine.match(/(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : 'unknown';

    // Extract status
    const statusMatch = headerLine.match(/status:\s*([^)]+)/i);
    const status = statusMatch ? statusMatch[1].trim() : 'captured';

    const domains = extractDomains(headerLine, body);
    const severity = detectSeverity(body);
    const id = `L${String(count).padStart(3, '0')}`;

    output += '---\n';
    output += `id: ${id}\n`;
    output += `status: ${status}\n`;
    output += `domain: [${domains.join(', ')}]\n`;
    output += `severity: ${severity}\n`;
    output += `date: ${date}\n`;
    output += '---\n';
    output += `## ${headerLine}\n\n${body}\n\n`;
  }

  console.log(`Migrated ${count} entries`);
  console.log(`Domains found: ${new Set(entries.flatMap((e) => extractDomains(e, e))).size} unique`);

  if (DRY_RUN) {
    console.log('\n--- DRY RUN OUTPUT ---\n');
    console.log(output);
    return;
  }

  // Backup original
  fs.copyFileSync(LESSONS_FILE, BACKUP_FILE);
  console.log(`Backup saved to ${BACKUP_FILE}`);

  // Write migrated
  fs.writeFileSync(LESSONS_FILE, output);
  console.log(`Migrated lessons.md written`);

  // Validate entry count
  const newContent = fs.readFileSync(LESSONS_FILE, 'utf8');
  const newEntryCount = (newContent.match(/^id: /gm) || []).length;
  if (newEntryCount !== count) {
    console.error(`VALIDATION FAILED: ${newEntryCount} entries in output vs ${count} expected`);
    fs.copyFileSync(BACKUP_FILE, LESSONS_FILE);
    console.error('Restored from backup');
    process.exit(1);
  }
  console.log(`Validation passed: ${newEntryCount} entries`);
}

main();
