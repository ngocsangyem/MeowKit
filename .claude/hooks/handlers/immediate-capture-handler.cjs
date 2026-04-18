// immediate-capture-handler.cjs — UserPromptSubmit handler: ##prefix auto-routing.
// Detects ##decision:, ##pattern:, ##note: prefixes and writes to typed memory files.

'use strict';
const fs = require('fs');
const path = require('path');

const { validateContent } = require('../lib/validate-content.cjs');

// Inlined from memory-parser.cjs (deleted in phase-03) — extracts domain keywords from prompt text.
function extractKeywords(prompt) {
  if (!prompt) return [];
  const STOP_WORDS = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'must', 'need', 'to', 'of',
    'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about',
    'it', 'its', 'this', 'that', 'these', 'those', 'my', 'your', 'his',
    'her', 'we', 'they', 'them', 'our', 'i', 'me', 'you', 'he', 'she',
    'and', 'or', 'but', 'not', 'no', 'if', 'then', 'so', 'just', 'also',
    'how', 'what', 'when', 'where', 'why', 'which', 'who', 'all', 'each',
    'some', 'any', 'new', 'please', 'help', 'want', 'make',
    'get', 'set', 'run', 'let', 'try', 'see', 'now', 'here',
    'implement', 'create', 'update', 'delete', 'remove',
  ]);
  const DOMAIN_KEYWORDS = new Set([
    'api', 'auth', 'db', 'sql', 'tls', 'ssl', 'css', 'html', 'jwt',
    'oauth', 'cors', 'xss', 'csrf', 'rls', 'ssr', 'ssg', 'isr',
    'grpc', 'rest', 'graphql', 'websocket', 'redis', 'postgres',
    'vue', 'react', 'swift', 'kotlin', 'python', 'typescript',
    'docker', 'k8s', 'nginx', 'supabase', 'prisma', 'zod',
    'change', 'fix', 'add', 'use',
  ]);
  return prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => {
      if (DOMAIN_KEYWORDS.has(w)) return true;
      return w.length > 2 && !STOP_WORDS.has(w);
    });
}

// Inlined from memory-injector.cjs (deleted in phase-03) — escapes memory-data tags.
function escapeMemoryContent(text) {
  return text.replace(/<\/?memory-data[^>]*>/gi, (m) => m.replace(/</g, '&lt;'));
}

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const MEMORY_DIR = path.join(ROOT, '.claude', 'memory');

const PREFIXES = {
  '##decision:': { target: 'lessons.md', type: 'decision' },
  // ##pattern: is category-routed — resolved at runtime in appendToPatterns()
  '##pattern:': { target: 'pattern-routed', type: 'pattern' },
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

// Resolve the correct split file for ##pattern: captures.
// Routing: bug-class category → fixes.json, decision → architecture-decisions.json,
// all other (default) → review-patterns.json.
function resolvePatternFile(category) {
  if (category === 'bug-class') return 'fixes.json';
  if (category === 'decision') return 'architecture-decisions.json';
  return 'review-patterns.json';
}

function appendToPatterns(id, date, keywords, content, category) {
  const targetFile = resolvePatternFile(category || 'pattern');
  const lockDir = path.join(MEMORY_DIR, '.patterns.lock');
  if (!acquireLock(lockDir, 3)) return { ok: false, target: targetFile };
  try {
    const filePath = path.join(MEMORY_DIR, targetFile);
    let data = { version: '2.0.0', scope: targetFile.replace('.json', ''), consumer: '', patterns: [], metadata: {} };
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      // Validate scope field to prevent cross-file writes
      if (parsed.scope && parsed.scope !== data.scope) {
        process.stderr.write(`appendToPatterns: scope mismatch — expected ${data.scope}, got ${parsed.scope}\n`);
        return { ok: false, target: targetFile };
      }
      data = parsed;
    } catch { /* init with skeleton */ }

    data.patterns.push({
      id,
      type: category === 'bug-class' ? 'failure' : 'success',
      category: category || 'pattern',
      severity: 'standard',
      domain: keywords,
      applicable_when: content.split('\n')[0].substring(0, 120),
      context: '',
      pattern: escapeMemoryContent(content),
      frequency: 1,
      lastSeen: date,
    });

    if (!data.metadata) data.metadata = {};
    data.metadata.last_updated = date;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return { ok: true, target: targetFile };
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
    } else if (config.target === 'pattern-routed') {
      // Category extracted from first word after prefix if present (e.g. "##pattern:bug-class ...")
      const firstWord = content.split(/\s+/)[0].toLowerCase();
      const category = ['bug-class', 'decision', 'pattern'].includes(firstWord) ? firstWord : 'pattern';
      const result = appendToPatterns(id, date, keywords.length > 0 ? keywords : ['uncategorized'], content, category);
      ok = result.ok;
      return ok ? `✓ Captured ${config.type} → ${result.target}` : '';
    } else {
      ok = appendToQuickNotes(date, content);
    }

    return ok ? `✓ Captured ${config.type} → ${config.target}` : '';
  }
  return '';
};
