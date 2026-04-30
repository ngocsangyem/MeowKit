#!/usr/bin/env node

/**
 * Source Detection Script for mk:docs-finder
 *
 * Analyzes user queries to determine:
 * 1. Query type: LIBRARY_DOCS vs INTERNAL_DOCS
 * 2. Library name and topic keyword extraction
 * 3. Recommended source: context7 | chub | local | fallback
 *
 * Returns JSON with routing info for the fetch scripts.
 */

const { loadEnv } = require('./utils/env-loader');

const env = loadEnv();
const DEBUG = env.DEBUG === 'true';

// ─── Topic-specific patterns ────────────────────────────────────────

const TOPIC_PATTERNS = [
  /how (?:do i|to|can i) (?:use|implement|add|setup|configure) (?:the )?(.+?) (?:in|with|for) (.+)/i,
  /(.+?) (.+?) (?:strategies|patterns|techniques|methods|approaches)/i,
  /(.+?) (.+?) (?:documentation|docs|guide|tutorial)/i,
  /using (.+?) (?:with|in|for) (.+)/i,
  /(.+?) (.+?) (?:guide|implementation|setup|configuration)/i,
  /implement(?:ing)? (.+?) (?:in|with|for|using) (.+)/i,
];

// ─── General library patterns ───────────────────────────────────────

const GENERAL_PATTERNS = [
  /(?:documentation|docs) for (.+)/i,
  /(.+?) (?:getting started|quick ?start|introduction)/i,
  /(?:how to use|learn) (.+)/i,
  /(.+?) (?:api reference|overview|basics)/i,
];

// ─── Internal docs indicators ───────────────────────────────────────

const INTERNAL_INDICATORS = [
  /\b(?:our|internal|project|team)\b/i,
  /\b(?:find|locate|where is)\b.*\b(?:spec|specification|design doc|architecture)\b/i,
  /\b(?:api auth spec|internal api|our api)\b/i,
];

// ─── Known library mappings ─────────────────────────────────────────

const KNOWN_REPOS = {
  'next.js': 'vercel/next.js',
  'nextjs': 'vercel/next.js',
  'remix': 'remix-run/remix',
  'astro': 'withastro/astro',
  'shadcn': 'shadcn-ui/ui',
  'shadcn/ui': 'shadcn-ui/ui',
  'better-auth': 'better-auth/better-auth',
  'vue': 'vuejs/core',
  'vue.js': 'vuejs/core',
  'react': 'facebook/react',
  'svelte': 'sveltejs/svelte',
  'sveltekit': 'sveltejs/kit',
  'nuxt': 'nuxt/nuxt',
  'nuxt.js': 'nuxt/nuxt',
  'angular': 'angular/angular',
  'express': 'expressjs/express',
  'fastify': 'fastify/fastify',
  'hono': 'honojs/hono',
  'drizzle': 'drizzle-team/drizzle-orm',
  'prisma': 'prisma/prisma',
  'stripe': 'stripe/stripe-node',
  'supabase': 'supabase/supabase',
  'tailwind': 'tailwindlabs/tailwindcss',
  'tailwindcss': 'tailwindlabs/tailwindcss',
};

/**
 * Normalize topic keyword
 */
function normalizeTopic(topic) {
  return topic
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .split('-')[0]
    .slice(0, 20);
}

/**
 * Normalize library name
 */
function normalizeLibrary(library) {
  return library
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s\-\/\.]/g, '')
    .replace(/\s+/g, '-');
}

/**
 * Resolve library to context7 repo path
 */
function resolveRepo(library) {
  const normalized = library.toLowerCase();
  return KNOWN_REPOS[normalized] || null;
}

/**
 * Detect if query is about internal project docs
 */
function isInternalQuery(query) {
  return INTERNAL_INDICATORS.some(pattern => pattern.test(query));
}

/**
 * Detect topic from query
 */
function detectTopic(query) {
  if (!query || typeof query !== 'string') return null;

  const trimmedQuery = query.trim();

  // Check general patterns first (these are NOT topic-specific)
  for (const pattern of GENERAL_PATTERNS) {
    const match = trimmedQuery.match(pattern);
    if (match) {
      if (DEBUG) console.error('[DEBUG] Matched general pattern, no topic');
      return {
        query: trimmedQuery,
        library: normalizeLibrary(match[1]),
        topic: null,
        isTopicSpecific: false,
      };
    }
  }

  // Check topic-specific patterns
  for (let i = 0; i < TOPIC_PATTERNS.length; i++) {
    const pattern = TOPIC_PATTERNS[i];
    const match = trimmedQuery.match(pattern);
    if (match) {
      const [, term1, term2] = match;
      let topic, library;

      if (i === 1) {
        topic = normalizeTopic(term2);
        library = normalizeLibrary(term1);
      } else {
        topic = normalizeTopic(term1);
        library = normalizeLibrary(term2);
      }

      if (DEBUG) {
        console.error(`[DEBUG] Topic: ${topic}, Library: ${library}`);
      }

      return {
        query: trimmedQuery,
        topic,
        library,
        isTopicSpecific: true,
      };
    }
  }

  return null;
}

/**
 * Full source detection — determines query type + recommended source
 *
 * @param {string} query - User query
 * @returns {Object} Detection result with routing info
 */
function detectSource(query) {
  if (!query || typeof query !== 'string') {
    return {
      error: 'Empty or invalid query',
      queryType: null,
      source: null,
    };
  }

  const trimmed = query.trim();

  // Step 1: Check if internal docs
  if (isInternalQuery(trimmed)) {
    return {
      queryType: 'INTERNAL_DOCS',
      query: trimmed,
      source: 'chub',
      fallbackSource: 'local',
      library: null,
      topic: null,
      isTopicSpecific: false,
    };
  }

  // Step 2: Detect topic and library
  const topicResult = detectTopic(trimmed);

  if (topicResult) {
    const repo = resolveRepo(topicResult.library);

    return {
      queryType: 'LIBRARY_DOCS',
      query: trimmed,
      source: 'context7',
      fallbackSource: 'chub',
      library: topicResult.library,
      repo: repo,
      topic: topicResult.topic,
      isTopicSpecific: topicResult.isTopicSpecific,
    };
  }

  // Step 3: Fallback — try to extract library name from raw query
  const words = trimmed.split(/\s+/);
  const possibleLibrary = words.find(w => resolveRepo(w.toLowerCase()));

  if (possibleLibrary) {
    return {
      queryType: 'LIBRARY_DOCS',
      query: trimmed,
      source: 'context7',
      fallbackSource: 'chub',
      library: normalizeLibrary(possibleLibrary),
      repo: resolveRepo(possibleLibrary.toLowerCase()),
      topic: null,
      isTopicSpecific: false,
    };
  }

  // Step 4: Unknown — default to library docs, let fetch scripts handle it
  return {
    queryType: 'LIBRARY_DOCS',
    query: trimmed,
    source: 'context7',
    fallbackSource: 'web',
    library: normalizeLibrary(trimmed),
    repo: null,
    topic: null,
    isTopicSpecific: false,
  };
}

// ─── CLI ────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node detect-source.js "<user query>"');
    process.exit(1);
  }

  const query = args.join(' ');
  const result = detectSource(query);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = {
  detectSource,
  detectTopic,
  normalizeTopic,
  normalizeLibrary,
  resolveRepo,
  isInternalQuery,
  KNOWN_REPOS,
};
