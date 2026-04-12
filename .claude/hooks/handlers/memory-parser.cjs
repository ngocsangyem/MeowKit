// memory-parser.cjs — Parse lessons.md YAML frontmatter entries with validation.

'use strict';
const fs = require('fs');

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

function validateEntry(parsed) {
  const errors = [];
  if (!parsed.id || !/^[a-zA-Z0-9_-]+$/.test(parsed.id.trim())) errors.push('invalid id');
  if (!parsed.domain || parsed.domain.length === 0) errors.push('empty domain');
  if (!['critical', 'standard'].includes(parsed.severity)) errors.push('invalid severity');
  return errors;
}

function parseLessons(content) {
  if (!content) return { entries: [], parseErrors: [] };
  const entries = [];
  const parseErrors = [];
  const blocks = content.split(/^---$/m).filter((b) => b.trim());

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    const idMatch = block.match(/^id:\s*(.+)$/m);
    const domainMatch = block.match(/^domain:\s*\[([^\]]*)\]$/m);
    const severityMatch = block.match(/^severity:\s*(.+)$/m);
    const dateMatch = block.match(/^date:\s*(\d{4}-\d{2}-\d{2})$/m);

    if (idMatch) {
      const domain = domainMatch
        ? domainMatch[1].split(',').map((d) => d.trim().toLowerCase()).filter(Boolean)
        : [];
      const severity = (severityMatch?.[1] || '').trim().toLowerCase();
      const date = dateMatch ? dateMatch[1] : null;

      const parsed = { id: idMatch[1].trim(), domain, severity, date };
      const errors = validateEntry(parsed);
      if (errors.length > 0) {
        parseErrors.push(`${parsed.id || 'unknown'}: ${errors.join(', ')}`);
        continue;
      }

      const lines = block.split('\n');
      let bodyStartLine = 0;
      for (let j = 0; j < lines.length; j++) {
        if (/^(id|status|domain|severity|date):/.test(lines[j])) bodyStartLine = j + 1;
        if (lines[j].trim() === '---') { bodyStartLine = j + 1; break; }
      }
      const body = lines.slice(bodyStartLine).join('\n').trim();
      entries.push({ ...parsed, body: body || block });
    } else if ((block.startsWith('#') || block.includes('status:')) && !block.startsWith('# MeowKit')) {
      const headerMatch = block.match(/^#+\s*(.+)/m);
      const header = headerMatch ? headerMatch[1].toLowerCase() : '';
      const domain = extractKeywords(header);
      const isCritical = block.toLowerCase().includes('critical') || block.toLowerCase().includes('security');
      entries.push({
        id: `legacy-${i}`,
        domain,
        severity: isCritical ? 'critical' : 'standard',
        date: null,
        body: block,
      });
    }
  }
  return { entries, parseErrors };
}

function parsePatterns(filePath) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return data.patterns || [];
  } catch {
    return [];
  }
}

module.exports = { extractKeywords, validateEntry, parseLessons, parsePatterns };
