#!/usr/bin/env node
// memory-topic-file-migrator.cjs — Phase-05 one-time migration script.
// Reads lessons.md, categorizes entries, writes to topic files, archives lessons.md.
// IDEMPOTENT: re-running skips IDs already present in target files.
//
// Usage: node .claude/scripts/memory-topic-file-migrator.cjs [--dry-run]

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const MEMORY_DIR = path.join(ROOT, '.claude', 'memory');
const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Topic file paths
// ---------------------------------------------------------------------------
const FILES = {
  fixes: path.join(MEMORY_DIR, 'fixes.md'),
  reviewPatterns: path.join(MEMORY_DIR, 'review-patterns.md'),
  architectureDecisions: path.join(MEMORY_DIR, 'architecture-decisions.md'),
  securityNotes: path.join(MEMORY_DIR, 'security-notes.md'),
  lessons: path.join(MEMORY_DIR, 'lessons.md'),
  lessonsBak: path.join(MEMORY_DIR, 'lessons.md.bak'),
};

// ---------------------------------------------------------------------------
// Parse lessons.md — returns array of { id, status, domain, severity, date, body }
// ---------------------------------------------------------------------------
function parseLessons(content) {
  const entries = [];
  // Split on YAML frontmatter blocks (--- ... ---)
  const blocks = content.split(/^---$/m);
  // blocks[0] = header text before first ---
  // blocks[1] = first frontmatter, blocks[2] = first body, blocks[3] = second frontmatter, ...
  for (let i = 1; i + 1 < blocks.length; i += 2) {
    const fm = blocks[i];
    const body = blocks[i + 1] || '';
    const id = (fm.match(/^id:\s*(.+)$/m) || [])[1]?.trim();
    const status = (fm.match(/^status:\s*(.+)$/m) || [])[1]?.trim() || 'unknown';
    const date = (fm.match(/^date:\s*(.+)$/m) || [])[1]?.trim() || '';
    const severity = (fm.match(/^severity:\s*(.+)$/m) || [])[1]?.trim() || 'standard';
    const domainRaw = (fm.match(/^domain:\s*\[([^\]]*)\]/m) || [])[1] || '';
    const domain = domainRaw.split(',').map((s) => s.trim()).filter(Boolean);
    if (id) {
      entries.push({ id, status, domain, severity, date, body: body.trim() });
    }
  }

  // Also collect NEEDS_CAPTURE markers (no frontmatter — discard, do not migrate)
  const needsCaptureCount = (content.match(/NEEDS_CAPTURE/g) || []).length;

  return { entries, needsCaptureCount };
}

// ---------------------------------------------------------------------------
// Read IDs already present in a topic file (idempotency guard)
// ---------------------------------------------------------------------------
function existingIds(filePath) {
  if (!fs.existsSync(filePath)) return new Set();
  const content = fs.readFileSync(filePath, 'utf8');
  const ids = new Set();
  for (const match of content.matchAll(/<!-- migrated-id: ([^\s]+) -->/g)) {
    ids.add(match[1]);
  }
  // Also check plain ID headers for legacy entries
  for (const match of content.matchAll(/^## ([^\s(]+)/gm)) {
    ids.add(match[1]);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Ensure topic file exists with header comment
// ---------------------------------------------------------------------------
function ensureTopicFile(filePath, header) {
  if (!fs.existsSync(filePath)) {
    if (!DRY_RUN) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, header + '\n');
    }
    console.log(`  [create] ${path.basename(filePath)}`);
  }
}

// ---------------------------------------------------------------------------
// Append entry to topic file (idempotent — checks existing IDs first)
// ---------------------------------------------------------------------------
function appendEntry(filePath, id, markdownContent) {
  const known = existingIds(filePath);
  if (known.has(id)) {
    console.log(`  [skip]   ${id} already in ${path.basename(filePath)}`);
    return false;
  }
  if (!DRY_RUN) {
    const block = `\n<!-- migrated-id: ${id} -->\n${markdownContent}\n`;
    fs.appendFileSync(filePath, block);
  }
  console.log(`  [write]  ${id} → ${path.basename(filePath)}`);
  return true;
}

// ---------------------------------------------------------------------------
// Main migration logic
// ---------------------------------------------------------------------------
function migrate() {
  console.log(`Memory topic file migrator (phase-05)${DRY_RUN ? ' [DRY RUN]' : ''}`);
  console.log(`Memory dir: ${MEMORY_DIR}`);
  console.log('');

  const lessonsPath = FILES.lessons;
  if (!fs.existsSync(lessonsPath)) {
    console.error('ERROR: lessons.md not found — nothing to migrate.');
    process.exit(1);
  }
  const content = fs.readFileSync(lessonsPath, 'utf8');

  // Skip if already archived
  if (content.includes('ARCHIVED')) {
    console.log('lessons.md is already archived. Nothing to do.');
    return;
  }

  const { entries, needsCaptureCount } = parseLessons(content);
  console.log(`Found ${entries.length} structured entries, ${needsCaptureCount} NEEDS_CAPTURE markers (discarded).`);
  console.log('');

  // Ensure topic files exist
  ensureTopicFile(FILES.fixes, `# Fixes — Session Learnings

> Loaded on-demand by meow:fix. Read this file when diagnosing bugs or after fixing to record patterns.`);

  ensureTopicFile(FILES.reviewPatterns, `# Review Patterns — Session Learnings

> Loaded on-demand by meow:review and meow:plan-creator.`);

  ensureTopicFile(FILES.architectureDecisions, `# Architecture Decisions — Session Learnings

> Loaded on-demand by meow:plan-creator and meow:cook.`);

  ensureTopicFile(FILES.securityNotes, `# Security Notes — Session Learnings

> Curated from security-log.md. Read by meow:cso and meow:review for security context.`);

  let migrated = 0;
  let skipped = 0;

  for (const entry of entries) {
    const { id, severity, date, domain, body } = entry;

    // Categorize by ID prefix + severity
    if (id.startsWith('L') && /^\d/.test(id.slice(1))) {
      // L001-type: skill audit findings → fixes.md primary, review-patterns.md cross-ref
      const fixesContent = `## ${id} — ${body.split('\n')[0].replace(/^#+\s*/, '')} (${date}, severity: ${severity})\n\n${body}`;
      if (appendEntry(FILES.fixes, id, fixesContent)) migrated++;
      else skipped++;

      // Cross-reference to review-patterns.md (process learnings sub-section only)
      const processMatch = body.match(/### Process Learnings([\s\S]*?)(?=^###|$)/m);
      if (processMatch) {
        const crossRef = `## ${id} cross-ref — Process Learnings (${date})\n\n> See fixes.md#${id} for full entry.\n\n${processMatch[1].trim()}`;
        const crossRefId = `${id}-review-xref`;
        if (appendEntry(FILES.reviewPatterns, crossRefId, crossRef)) migrated++;
        else skipped++;
      }
    } else if (id.startsWith('decision-')) {
      // decision-* entries → architecture-decisions.md, normalize domain tags
      const title = body.split('\n').find((l) => l.startsWith('## '))?.replace(/^## /, '') || id;
      const decContent = `## ${title} (${date}, severity: ${severity})\n\n**Decision:** ${title}\n**Context:** Captured via ##decision: prefix at session start.\n**Status:** live-captured`;
      if (appendEntry(FILES.architectureDecisions, id, decContent)) migrated++;
      else skipped++;
    } else {
      // Unknown prefix — append to fixes.md as fallback
      const fallback = `## ${id} (${date})\n\n${body}`;
      if (appendEntry(FILES.fixes, id, fallback)) migrated++;
      else skipped++;
    }
  }

  console.log('');
  console.log(`Migrated ${migrated} entries, skipped ${skipped} (already present), discarded ${needsCaptureCount} NEEDS_CAPTURE markers.`);

  // Archive lessons.md (overwrite with stub — do not delete)
  if (!DRY_RUN) {
    const archiveStub = `# MeowKit — Session Lessons (ARCHIVED)

> Content migrated to topic files in phase-05 (${new Date().toISOString().split('T')[0]}).
> See: fixes.md, review-patterns.md, architecture-decisions.md, security-notes.md
> This file is kept as a stub for backward compatibility. Do not write here.
`;
    fs.writeFileSync(lessonsPath, archiveStub);
    console.log('Archived lessons.md (overwritten with stub).');

    // Delete lessons.md.bak if present
    if (fs.existsSync(FILES.lessonsBak)) {
      fs.unlinkSync(FILES.lessonsBak);
      console.log('Deleted lessons.md.bak.');
    }
  } else {
    console.log('[dry-run] Would archive lessons.md and delete lessons.md.bak.');
  }

  console.log('Done.');
}

migrate();
