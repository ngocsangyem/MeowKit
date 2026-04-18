// immediate-capture-handler.cjs — UserPromptSubmit handler: ##prefix auto-routing.
// Detects ##decision:, ##pattern:, ##note: prefixes and writes to typed memory files.

'use strict';
const fs = require('fs');
const path = require('path');

const { validateContent } = require('../lib/validate-content.cjs');
const { scrubSecrets } = require('../lib/secret-scrub.cjs');

// Per-file lock: all writers targeting the same topic file acquire the same lock,
// regardless of which ##prefix triggered the write. Prevents cross-prefix races.
function lockDirForFile(targetFile) {
  return path.join(MEMORY_DIR, '.' + path.basename(targetFile) + '.lock');
}

// Atomic JSON write via temp-rename. Crash during write leaves the original intact.
function writeJsonAtomic(filePath, data) {
  const tmp = filePath + '.tmp.' + process.pid;
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, filePath);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch { /* best-effort */ }
    throw e;
  }
}

// Extracts domain keywords from prompt text.
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

// Escapes memory-data tags so captured content cannot inject its own data boundary.
function escapeMemoryContent(text) {
  return text.replace(/<\/?memory-data[^>]*>/gi, (m) => m.replace(/</g, '&lt;'));
}

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const MEMORY_DIR = path.join(ROOT, '.claude', 'memory');

// ##decision: routes to architecture-decisions.json (structured JSON entry).
// ##pattern: is category-routed — resolved at runtime in appendToPatterns() — to
// fixes.json (bug-class), architecture-decisions.json (decision), or
// review-patterns.json (default).
const PREFIXES = {
  '##decision:': { target: 'architecture-decisions.json', type: 'decision' },
  // ##pattern: is category-routed — resolved at runtime in appendToPatterns()
  '##pattern:': { target: 'pattern-routed', type: 'pattern' },
  '##note:': { target: 'quick-notes.md', type: 'note' },
};

function generateId(type) {
  const ts = Date.now().toString(36);
  return `${type}-${ts}`;
}

// Lock acquisition uses exponential backoff + jitter (10ms → 400ms cap) across
// up to 8 retries. Busy-spinning without sleep caused silent write loss under
// concurrent captures. The backoff accommodates the common case (prior holder
// releases within a few ms) without blocking the hook for long.
function sleepMs(ms) {
  // Synchronous sleep via Atomics — available in Node 16+ and safe in a hook.
  const sab = new SharedArrayBuffer(4);
  const arr = new Int32Array(sab);
  Atomics.wait(arr, 0, 0, Math.max(0, ms));
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
      // Exponential backoff with jitter: ~10ms, ~25ms, ~60ms, ~140ms, …
      const base = 10 * Math.pow(2.2, i);
      const jitter = Math.random() * base * 0.5;
      sleepMs(Math.min(400, base + jitter));
    }
  }
  return false;
}

function releaseLock(lockDir) {
  try { fs.rmdirSync(lockDir); } catch { /* best-effort */ }
}

// Appends a schema v2.0.0 entry to architecture-decisions.json via atomic temp-rename.
function appendToArchitectureDecisions(id, date, keywords, content) {
  const targetFile = path.join(MEMORY_DIR, 'architecture-decisions.json');
  const lockDir = lockDirForFile(targetFile);
  if (!acquireLock(lockDir, 8)) return false;
  try {
    let data = {
      version: '2.0.0',
      scope: 'architecture-decisions',
      consumer: 'meow:plan-creator,meow:cook',
      patterns: [],
      metadata: { created: date, last_updated: date },
    };
    try {
      const raw = fs.readFileSync(targetFile, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed.scope && parsed.scope !== 'architecture-decisions') {
        process.stderr.write(`appendToArchitectureDecisions: scope mismatch\n`);
        return false;
      }
      data = parsed;
    } catch { /* init with skeleton */ }

    data.patterns.push({
      id,
      type: 'decision',
      category: 'architecture',
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

    writeJsonAtomic(targetFile, data);
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
  const filePath = path.join(MEMORY_DIR, targetFile);
  // Per-file lock: shares with appendToArchitectureDecisions when both target
  // architecture-decisions.json, preventing dual-lock races.
  const lockDir = lockDirForFile(filePath);
  if (!acquireLock(lockDir, 8)) return { ok: false, target: targetFile };
  try {
    let data = { version: '2.0.0', scope: targetFile.replace('.json', ''), consumer: '', patterns: [], metadata: {} };
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
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
    writeJsonAtomic(filePath, data);
    return { ok: true, target: targetFile };
  } finally {
    releaseLock(lockDir);
  }
}

// Locked append so concurrent ##note: captures don't interleave. Uses the same
// per-file lock primitive as appendTo{Patterns,ArchitectureDecisions}.
function appendToQuickNotes(date, content) {
  const filePath = path.join(MEMORY_DIR, 'quick-notes.md');
  const lockDir = lockDirForFile(filePath);
  if (!acquireLock(lockDir, 8)) return false;
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '# Quick Notes\n\n> Unclassified captures. Processed during Reflect.\n');
    }
    fs.appendFileSync(filePath, `\n- [${date}] ${escapeMemoryContent(content)}\n`);
    return true;
  } finally {
    releaseLock(lockDir);
  }
}

module.exports = function immediateCapture(ctx) {
  const prompt = (ctx.prompt || '').trimStart();
  if (!prompt) return '';

  for (const [prefix, config] of Object.entries(PREFIXES)) {
    if (!prompt.toLowerCase().startsWith(prefix)) continue;

    const rawContent = prompt.substring(prefix.length).trim();
    if (!rawContent) return '';

    const validation = validateContent(rawContent);
    if (!validation.valid) {
      return `⚠ Capture blocked: content matched injection pattern (${validation.pattern})`;
    }

    // Ensure memory dir exists. Fresh installs (no prior session) may have no
    // .claude/memory/ yet; acquireLock() below would fail ENOENT otherwise.
    try {
      fs.mkdirSync(MEMORY_DIR, { recursive: true });
    } catch (e) {
      process.stderr.write(`immediate-capture: cannot create MEMORY_DIR (${e.message})\n`);
      return '';
    }

    // Scrub known secret patterns before persisting. Captured content becomes
    // re-injected into future sessions — leaked secrets would re-enter context.
    const content = scrubSecrets(rawContent);
    const keywords = extractKeywords(content).slice(0, 10);
    const id = generateId(config.type);
    const date = new Date().toISOString().split('T')[0];
    let ok = false;

    if (config.target === 'architecture-decisions.json') {
      ok = appendToArchitectureDecisions(id, date, keywords.length > 0 ? keywords : ['uncategorized'], content);
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
