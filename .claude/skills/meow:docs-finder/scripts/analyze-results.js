#!/usr/bin/env node

/**
 * Results Analyzer for meow:docs-finder
 *
 * Parses llms.txt content OR chub output:
 *  - Categorizes URLs by priority (critical/important/supplementary)
 *  - Suggests agent distribution strategy
 *  - Estimates token usage
 *  - Checks content against context budget (3000 tokens inline max)
 */

const { loadEnv } = require('./utils/env-loader');

const env = loadEnv();
const DEBUG = env.DEBUG === 'true';

const CONTEXT_BUDGET_TOKENS = 3000;

// ─── URL priority keywords ──────────────────────────────────────────

const PRIORITY_KEYWORDS = {
  critical: [
    'getting-started', 'quick-start', 'quickstart', 'introduction', 'intro',
    'overview', 'installation', 'install', 'setup', 'basics', 'core-concepts',
    'fundamentals',
  ],
  supplementary: [
    'advanced', 'internals', 'migration', 'migrate', 'troubleshooting',
    'troubleshoot', 'faq', 'frequently-asked', 'changelog', 'contributing',
    'contribute',
  ],
  important: [
    'guide', 'tutorial', 'example', 'api-reference', 'api', 'reference',
    'configuration', 'config', 'routing', 'route', 'data-fetching',
    'authentication', 'auth',
  ],
};

/**
 * Categorize a URL by priority
 */
function categorizeUrl(url) {
  const urlLower = url.toLowerCase();
  const priorities = ['critical', 'supplementary', 'important'];

  for (const priority of priorities) {
    const keywords = PRIORITY_KEYWORDS[priority];
    for (const keyword of keywords) {
      if (urlLower.includes(keyword)) {
        return priority;
      }
    }
  }

  return 'important';
}

/**
 * Parse llms.txt content to extract URLs
 */
function parseUrls(content) {
  if (!content || typeof content !== 'string') return [];

  const urls = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const urlMatch = trimmed.match(/https?:\/\/[^\s<>"]+/i);
    if (urlMatch) {
      urls.push(urlMatch[0]);
    }
  }

  return urls;
}

/**
 * Group URLs by priority
 */
function groupByPriority(urls) {
  const groups = { critical: [], important: [], supplementary: [] };

  for (const url of urls) {
    const priority = categorizeUrl(url);
    groups[priority].push(url);
  }

  return groups;
}

/**
 * Suggest agent distribution for fetching grouped URLs
 */
function suggestDistribution(urlCount) {
  if (urlCount <= 3) {
    return {
      agentCount: 1,
      strategy: 'single',
      urlsPerAgent: urlCount,
      description: 'Single agent or direct WebFetch',
    };
  } else if (urlCount <= 10) {
    const agents = Math.min(Math.ceil(urlCount / 2), 5);
    return {
      agentCount: agents,
      strategy: 'parallel',
      urlsPerAgent: Math.ceil(urlCount / agents),
      description: `Deploy ${agents} Explorer agents in parallel`,
    };
  } else if (urlCount <= 20) {
    return {
      agentCount: 7,
      strategy: 'parallel',
      urlsPerAgent: Math.ceil(urlCount / 7),
      description: 'Deploy 7 agents with balanced workload',
    };
  } else {
    return {
      agentCount: 7,
      strategy: 'phased',
      urlsPerAgent: Math.ceil(urlCount / 7),
      phases: 2,
      description: 'Two-phase: critical URLs first, then important',
    };
  }
}

/**
 * Check if content fits within inline context budget
 */
function checkContextBudget(content) {
  const tokenEstimate = Math.ceil(content.length / 4);
  const withinBudget = tokenEstimate <= CONTEXT_BUDGET_TOKENS;

  return {
    tokenEstimate,
    budget: CONTEXT_BUDGET_TOKENS,
    withinBudget,
    action: withinBudget ? 'inline' : 'write-to-file',
    summary: withinBudget
      ? `Content fits inline (${tokenEstimate} tokens)`
      : `Content exceeds budget (${tokenEstimate} > ${CONTEXT_BUDGET_TOKENS}). Write full docs to .claude/memory/docs-cache/ and return summary.`,
  };
}

/**
 * Analyze llms.txt content
 */
function analyzeLlmsTxt(content) {
  const urls = parseUrls(content);
  const grouped = groupByPriority(urls);
  const distribution = suggestDistribution(urls.length);
  const budget = checkContextBudget(content);

  return {
    type: 'llms-txt',
    totalUrls: urls.length,
    urls,
    grouped,
    distribution,
    budget,
    summary: {
      critical: grouped.critical.length,
      important: grouped.important.length,
      supplementary: grouped.supplementary.length,
    },
  };
}

/**
 * Analyze chub fetch result (raw documentation content)
 */
function analyzeChubResult(content, metadata = {}) {
  const budget = checkContextBudget(content);

  // Extract sections from chub doc (Markdown with YAML frontmatter)
  const sections = [];
  const lines = content.split('\n');
  let currentSection = null;

  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headerMatch) {
      if (currentSection) sections.push(currentSection);
      currentSection = {
        level: headerMatch[1].length,
        title: headerMatch[2],
        startLine: lines.indexOf(line),
      };
    }
  }
  if (currentSection) sections.push(currentSection);

  return {
    type: 'chub',
    id: metadata.id || null,
    lang: metadata.lang || null,
    sections,
    sectionCount: sections.length,
    budget,
    hasCodeExamples: /```[\s\S]*?```/.test(content),
    hasAnnotations: content.includes('[annotation]') || content.includes('[note]'),
  };
}

/**
 * Analyze any result — auto-detects type
 */
function analyzeResult(content, metadata = {}) {
  if (!content || typeof content !== 'string') {
    return { error: 'Empty or invalid content', type: null };
  }

  // Detect if this is llms.txt (contains many URLs) or documentation content
  const urls = parseUrls(content);
  const isLlmsTxt = urls.length >= 3 && (urls.length / content.split('\n').length) > 0.3;

  if (isLlmsTxt) {
    return analyzeLlmsTxt(content);
  } else {
    return analyzeChubResult(content, metadata);
  }
}

// ─── CLI ────────────────────────────────────────────────────────────

function main() {
  const fs = require('fs');
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node analyze-results.js <file-or-stdin>');
    console.error('  cat docs.txt | node analyze-results.js -');
    console.error('  node analyze-results.js result.json');
    process.exit(1);
  }

  let content;

  if (args[0] === '-') {
    content = fs.readFileSync(0, 'utf8');
  } else {
    const filePath = args[0];
    if (!fs.existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }
    content = fs.readFileSync(filePath, 'utf8');
  }

  // Try to parse as JSON (chub result) or treat as raw content
  let metadata = {};
  try {
    const parsed = JSON.parse(content);
    if (parsed.content) {
      metadata = { id: parsed.id, lang: parsed.lang };
      content = parsed.content;
    }
  } catch {
    // Not JSON — treat as raw content
  }

  const result = analyzeResult(content, metadata);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = {
  analyzeResult,
  analyzeLlmsTxt,
  analyzeChubResult,
  checkContextBudget,
  parseUrls,
  groupByPriority,
  categorizeUrl,
  suggestDistribution,
  CONTEXT_BUDGET_TOKENS,
};
