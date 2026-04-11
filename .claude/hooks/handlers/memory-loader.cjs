// memory-loader.cjs — UserPromptSubmit handler: load filtered memory into context.
// Two-phase approach:
//   Phase A (SessionStart): CRITICAL/SECURITY entries always loaded (not implemented here — handled by analyst agent)
//   Phase B (UserPromptSubmit): domain-filtered entries loaded using keywords from user's message
//
// UserPromptSubmit stdin provides `prompt` field with full user message text.
// UserPromptSubmit stdout reaches model context — used for memory injection.
//
// Env: MEOWKIT_MEMORY_BUDGET=N — max chars to inject (default: 4000, ~1K tokens)

const fs = require('fs');
const path = require('path');

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const MEMORY_DIR = path.join(ROOT, '.claude', 'memory');
const LESSONS_FILE = path.join(MEMORY_DIR, 'lessons.md');
const PATTERNS_FILE = path.join(MEMORY_DIR, 'patterns.json');
const DEFAULT_BUDGET = 4000; // chars (~1K tokens)

// Common stop words to exclude from keyword extraction
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'must', 'need', 'to', 'of',
  'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about',
  'it', 'its', 'this', 'that', 'these', 'those', 'my', 'your', 'his',
  'her', 'we', 'they', 'them', 'our', 'i', 'me', 'you', 'he', 'she',
  'and', 'or', 'but', 'not', 'no', 'if', 'then', 'so', 'just', 'also',
  'how', 'what', 'when', 'where', 'why', 'which', 'who', 'all', 'each',
  'some', 'any', 'new', 'please', 'help', 'want', 'make', 'add', 'fix',
  'get', 'set', 'use', 'run', 'let', 'try', 'see', 'now', 'here',
  'implement', 'create', 'update', 'delete', 'remove', 'change',
]);

// Extract meaningful keywords from user prompt
function extractKeywords(prompt) {
  if (!prompt) return [];
  return prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

// Parse structured lessons.md with YAML frontmatter per entry
// Format: entries separated by ---, each with frontmatter block
function parseLessons(content) {
  if (!content) return [];
  const entries = [];

  // Split by --- separators (YAML frontmatter style)
  const blocks = content.split(/^---$/m).filter((b) => b.trim());

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();

    // Try to parse YAML frontmatter fields
    const idMatch = block.match(/^id:\s*(.+)$/m);
    const domainMatch = block.match(/^domain:\s*\[([^\]]*)\]$/m);
    const severityMatch = block.match(/^severity:\s*(.+)$/m);

    if (idMatch) {
      // Structured entry with frontmatter
      const domain = domainMatch
        ? domainMatch[1].split(',').map((d) => d.trim().toLowerCase())
        : [];
      const severity = (severityMatch?.[1] || '').trim().toLowerCase();
      // Body is everything after frontmatter fields — find last known field line
      const lines = block.split('\n');
      let bodyStartLine = 0;
      for (let j = 0; j < lines.length; j++) {
        if (/^(id|status|domain|severity|date):/.test(lines[j])) bodyStartLine = j + 1;
        if (lines[j].trim() === '---') { bodyStartLine = j + 1; break; }
      }
      const body = lines.slice(bodyStartLine).join('\n').trim();

      entries.push({ id: idMatch[1].trim(), domain, severity, body: body || block });
    } else if (block.startsWith('#') || block.includes('status:')) {
      // Legacy freeform entry — extract keywords from header for domain matching
      const headerMatch = block.match(/^#+\s*(.+)/m);
      const header = headerMatch ? headerMatch[1].toLowerCase() : '';
      const domain = extractKeywords(header);
      const isCritical = block.toLowerCase().includes('critical') || block.toLowerCase().includes('security');

      entries.push({
        id: `legacy-${i}`,
        domain,
        severity: isCritical ? 'critical' : 'standard',
        body: block,
      });
    }
  }

  return entries;
}

// Filter patterns.json entries by domain keywords
function filterPatterns(patterns, keywords) {
  if (!patterns?.length) return [];

  return patterns.filter((p) => {
    // Always include critical/security
    if (p.severity === 'critical' || p.category === 'security') return true;

    // Check domain array
    if (p.domain?.length) {
      return p.domain.some((d) => keywords.includes(d.toLowerCase()));
    }

    // Fallback: check applicable_when field
    if (p.applicable_when) {
      const aw = p.applicable_when.toLowerCase();
      return keywords.some((k) => aw.includes(k));
    }

    return false;
  });
}

module.exports = function memoryLoader(ctx, state) {
  const prompt = ctx.prompt;
  if (!prompt) return '';

  const budget = parseInt(process.env.MEOWKIT_MEMORY_BUDGET, 10) || DEFAULT_BUDGET;
  const keywords = extractKeywords(prompt);

  let output = '';
  let usedChars = 0;

  // Load and filter lessons
  try {
    const lessonsContent = fs.readFileSync(LESSONS_FILE, 'utf8');
    const entries = parseLessons(lessonsContent);

    // Always load CRITICAL/SECURITY entries regardless of keywords
    const critical = entries.filter((e) => e.severity === 'critical' || e.severity === 'security');
    for (const entry of critical) {
      if (usedChars + entry.body.length > budget) break;
      output += entry.body + '\n\n';
      usedChars += entry.body.length;
    }

    // Domain-filtered entries (only if keywords extracted)
    if (keywords.length > 0) {
      const domainMatched = entries.filter(
        (e) => e.severity !== 'critical' && e.severity !== 'security' &&
          e.domain.some((d) => keywords.includes(d.toLowerCase()))
      );
      for (const entry of domainMatched) {
        if (usedChars + entry.body.length > budget) break;
        output += entry.body + '\n\n';
        usedChars += entry.body.length;
      }
    }
  } catch {
    // lessons.md doesn't exist or can't be read — skip
  }

  // Load and filter patterns (critical always, domain-filtered if keywords)
  try {
    const patternsData = JSON.parse(fs.readFileSync(PATTERNS_FILE, 'utf8'));
    const patterns = patternsData.patterns || [];
    const matched = filterPatterns(patterns, keywords);

    for (const p of matched) {
      const text = `[${p.severity || 'info'}] ${p.pattern}`;
      if (usedChars + text.length > budget) break;
      output += text + '\n';
      usedChars += text.length;
    }
  } catch {
    // patterns.json doesn't exist or can't be read — skip
  }

  if (!output) return '';

  // Wrap as DATA per injection-rules.md — memory content is DATA, not instructions
  const keywordLabel = keywords.length > 0 ? keywords.slice(0, 5).join(', ') : 'critical-only';
  return `<memory-data description="Session learnings (${keywordLabel})">\n${output}</memory-data>\n`;
};
