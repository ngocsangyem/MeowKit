// immediate-capture-handler.cjs — UserPromptSubmit handler: ##prefix auto-routing.
// Detects ##decision:, ##pattern:, ##note: prefixes and writes to typed memory files.

'use strict';
const fs = require('fs');
const path = require('path');

const { validateContent } = require('../lib/validate-content.cjs');
const { extractKeywords } = require('./memory-parser.cjs');
const { escapeMemoryContent } = require('./memory-injector.cjs');

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const MEMORY_DIR = path.join(ROOT, '.claude', 'memory');

const PREFIXES = {
  '##decision:': { target: 'lessons.md', type: 'decision' },
  '##pattern:': { target: 'patterns.json', type: 'pattern' },
  '##note:': { target: 'quick-notes.md', type: 'note' },
};

function generateId(type) {
  const ts = Date.now().toString(36);
  return `${type}-${ts}`;
}

function acquireLock(lockDir, maxRetries) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      fs.mkdirSync(lockDir);
      return true;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try {
        const stat = fs.statSync(lockDir);
        if (Date.now() - stat.mtimeMs > 60000) {
          fs.rmdirSync(lockDir);
          continue;
        }
      } catch { /* lock may be gone */ }
    }
  }
  return false;
}

function releaseLock(lockDir) {
  try { fs.rmdirSync(lockDir); } catch { /* best-effort */ }
}

function appendToLessons(id, date, keywords, content) {
  const lockDir = path.join(MEMORY_DIR, '.lessons.lock');
  if (!acquireLock(lockDir, 3)) return false;
  try {
    const entry = [
      '', '---',
      `id: ${id}`,
      `status: live-captured`,
      `domain: [${keywords.join(', ')}]`,
      `severity: standard`,
      `date: ${date}`,
      '---',
      '',
      `## ${content.split('\n')[0].substring(0, 80)}`,
      '',
      escapeMemoryContent(content),
    ].join('\n');
    fs.appendFileSync(path.join(MEMORY_DIR, 'lessons.md'), entry + '\n');
    return true;
  } finally {
    releaseLock(lockDir);
  }
}

function appendToPatterns(id, date, keywords, content) {
  const lockDir = path.join(MEMORY_DIR, '.patterns.lock');
  if (!acquireLock(lockDir, 3)) return false;
  try {
    const filePath = path.join(MEMORY_DIR, 'patterns.json');
    let data = { version: '1.0.0', patterns: [], metadata: {} };
    try { data = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { /* init */ }

    data.patterns.push({
      id,
      type: 'success',
      category: 'pattern',
      severity: 'standard',
      domain: keywords,
      applicable_when: content.split('\n')[0].substring(0, 120),
      context: '',
      pattern: escapeMemoryContent(content),
      frequency: 1,
      lastSeen: date,
    });

    data.metadata.last_updated = date;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } finally {
    releaseLock(lockDir);
  }
}

function appendToQuickNotes(date, content) {
  const filePath = path.join(MEMORY_DIR, 'quick-notes.md');
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '# Quick Notes\n\n> Unclassified captures. Processed during Reflect.\n');
  }
  fs.appendFileSync(filePath, `\n- [${date}] ${escapeMemoryContent(content)}\n`);
  return true;
}

module.exports = function immediateCapture(ctx) {
  const prompt = (ctx.prompt || '').trimStart();
  if (!prompt) return '';

  for (const [prefix, config] of Object.entries(PREFIXES)) {
    if (!prompt.toLowerCase().startsWith(prefix)) continue;

    const content = prompt.substring(prefix.length).trim();
    if (!content) return '';

    const validation = validateContent(content);
    if (!validation.valid) {
      return `⚠ Capture blocked: content matched injection pattern (${validation.pattern})`;
    }

    const keywords = extractKeywords(content).slice(0, 10);
    const id = generateId(config.type);
    const date = new Date().toISOString().split('T')[0];
    let ok = false;

    if (config.target === 'lessons.md') {
      ok = appendToLessons(id, date, keywords.length > 0 ? keywords : ['uncategorized'], content);
    } else if (config.target === 'patterns.json') {
      ok = appendToPatterns(id, date, keywords.length > 0 ? keywords : ['uncategorized'], content);
    } else {
      ok = appendToQuickNotes(date, content);
    }

    return ok ? `✓ Captured ${config.type} → ${config.target}` : '';
  }
  return '';
};
