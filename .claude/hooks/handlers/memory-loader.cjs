// memory-loader.cjs — UserPromptSubmit handler: load filtered memory into context.
// Delegates parsing, filtering, and injection to focused modules.
//
// Env: MEOWKIT_MEMORY_BUDGET=N — max chars to inject (default: 4000, ~1K tokens)
//      MEOWKIT_MEMORY_STALENESS_MONTHS=N — skip standard entries older than N months (default: 6)

const fs = require('fs');
const path = require('path');

const { extractKeywords, parseLessons, parsePatterns } = require('./memory-parser.cjs');
const { filterLessons, filterPatterns, applyBudget } = require('./memory-filter.cjs');
const { escapeMemoryContent, wrapAsData } = require('./memory-injector.cjs');

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const MEMORY_DIR = path.join(ROOT, '.claude', 'memory');
const LESSONS_FILE = path.join(MEMORY_DIR, 'lessons.md');
const PATTERNS_FILE = path.join(MEMORY_DIR, 'patterns.json');
const DEFAULT_BUDGET = 4000;

module.exports = function memoryLoader(ctx) {
  const prompt = ctx.prompt;
  if (!prompt) return '';

  const budget = parseInt(process.env.MEOWKIT_MEMORY_BUDGET, 10) || DEFAULT_BUDGET;
  const keywords = extractKeywords(prompt);

  let allEntries = [];
  let parseErrors = [];
  let staleCount = 0;
  let matchedPatterns = [];

  try {
    const content = fs.readFileSync(LESSONS_FILE, 'utf8');
    const parsed = parseLessons(content);
    allEntries = parsed.entries;
    parseErrors = parsed.parseErrors;
  } catch { /* lessons.md missing — skip */ }

  const { critical, domainMatched, staleCount: sc } = filterLessons(allEntries, keywords);
  staleCount = sc;

  try {
    const patterns = parsePatterns(PATTERNS_FILE);
    matchedPatterns = filterPatterns(patterns, keywords);
  } catch { /* patterns.json missing — skip */ }

  const escapedCritical = critical.map((e) => ({ ...e, body: escapeMemoryContent(e.body) }));
  const escapedDomain = domainMatched.map((e) => ({ ...e, body: escapeMemoryContent(e.body) }));

  const { output, filteredCount } = applyBudget(escapedCritical, escapedDomain, matchedPatterns, budget);

  if (!output.trim()) return '';

  return wrapAsData(output, keywords, parseErrors, filteredCount, staleCount);
};
