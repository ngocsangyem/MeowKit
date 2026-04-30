#!/usr/bin/env node

/**
 * Context7 Documentation Fetcher for mk:docs-finder
 *
 * Fetches documentation from context7.com using llms.txt standard.
 * Handles topic-specific and general library queries with fallback chain:
 *   topic URL → general URL → official site llms.txt
 */

const https = require('https');
const { loadEnv } = require('./utils/env-loader');
const { detectSource } = require('./detect-source');

const env = loadEnv();
const DEBUG = env.DEBUG === 'true';
const API_KEY = env.CONTEXT7_API_KEY;

// ─── Known official llms.txt URLs ───────────────────────────────────

const OFFICIAL_LLMS_TXT = {
  'astro': 'https://docs.astro.build/llms.txt',
  'next.js': 'https://nextjs.org/llms.txt',
  'nextjs': 'https://nextjs.org/llms.txt',
  'remix': 'https://remix.run/llms.txt',
  'sveltekit': 'https://kit.svelte.dev/llms.txt',
};

/**
 * HTTPS GET request with timeout
 */
function httpsGet(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: API_KEY ? { 'Authorization': `Bearer ${API_KEY}` } : {},
      timeout: timeoutMs,
    };

    const req = https.get(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => { data += chunk; });

      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else if (res.statusCode === 404) {
          resolve(null);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout after ${timeoutMs}ms`));
    });
  });
}

/**
 * Build context7.com URL
 */
function buildContext7Url(library, topic = null) {
  let basePath;

  if (library.includes('/')) {
    basePath = library;
  } else {
    const normalized = library.toLowerCase().replace(/[^a-z0-9-]/g, '');
    basePath = `websites/${normalized}`;
  }

  const baseUrl = `https://context7.com/${basePath}/llms.txt`;

  if (topic) {
    return `${baseUrl}?topic=${encodeURIComponent(topic)}`;
  }

  return baseUrl;
}

/**
 * Generate URL variations for a library
 */
function getUrlVariations(library, topic = null, repo = null) {
  const urls = [];

  // Use resolved repo if available
  const target = repo || library;

  // Priority 1: Topic-specific URL
  if (topic) {
    urls.push({
      url: buildContext7Url(target, topic),
      type: 'context7-topic',
    });
  }

  // Priority 2: General library URL
  urls.push({
    url: buildContext7Url(target),
    type: 'context7-general',
  });

  // Priority 3: Official site llms.txt
  const normalized = library.toLowerCase();
  if (OFFICIAL_LLMS_TXT[normalized]) {
    urls.push({
      url: OFFICIAL_LLMS_TXT[normalized],
      type: 'official-llms-txt',
    });
  }

  return urls;
}

/**
 * Fetch documentation from context7.com
 *
 * @param {string} query - User query
 * @returns {Promise<Object>} Documentation result
 */
async function fetchContext7(query) {
  const detection = detectSource(query);

  if (DEBUG) {
    console.error('[DEBUG] Source detection:', JSON.stringify(detection));
  }

  const library = detection.library;
  const topic = detection.topic;
  const repo = detection.repo;

  if (!library) {
    return {
      success: false,
      source: 'context7',
      error: 'Could not extract library name from query',
      query,
    };
  }

  const variations = getUrlVariations(library, topic, repo);

  if (DEBUG) {
    console.error('[DEBUG] URL variations:', variations.map(v => v.url));
  }

  // Try each URL in order
  for (const { url, type } of variations) {
    if (DEBUG) {
      console.error(`[DEBUG] Trying: ${url}`);
    }

    try {
      const content = await httpsGet(url);

      if (content && content.trim().length > 0) {
        return {
          success: true,
          source: 'context7',
          sourceType: type,
          url,
          library,
          topic,
          content,
          tokenEstimate: Math.ceil(content.length / 4),
          topicSpecific: type === 'context7-topic',
        };
      }
    } catch (error) {
      if (DEBUG) {
        console.error(`[DEBUG] Failed: ${url} — ${error.message}`);
      }
    }
  }

  return {
    success: false,
    source: 'context7',
    error: `Documentation not found for "${library}" on context7.com`,
    library,
    topic,
    triedUrls: variations.map(v => v.url),
    suggestion: 'Try fetch-chub.js or web search as fallback',
  };
}

// ─── CLI ────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node fetch-context7.js "<user query>"');
    process.exit(1);
  }

  const query = args.join(' ');

  try {
    const result = await fetchContext7(query);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  fetchContext7,
  buildContext7Url,
  getUrlVariations,
  httpsGet,
  OFFICIAL_LLMS_TXT,
};
