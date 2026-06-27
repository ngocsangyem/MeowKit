#!/usr/bin/env node

/**
 * Context Hub (chub) Documentation Fetcher for mk:docs-finder
 *
 * Fetches documentation from Context Hub CLI — a community-maintained
 * registry of versioned, LLM-optimized documentation with local annotations.
 *
 * Runs via npx — no global install required: npx chub search "query"
 *
 * Features over context7:
 *  - Local annotations persist across sessions
 *  - Language-specific docs (--lang py, --lang js)
 *  - Version-specific docs (--version 2024-12-18)
 *  - Offline capable (npx chub update --full)
 *  - Community feedback loop
 */

const { execSync } = require('child_process');
const { loadEnv } = require('./utils/env-loader');

/**
 * Escape a string for safe use inside a single-quoted shell argument.
 * Neutralizes all shell metacharacters ($, `, \, !, ", ;, &, |).
 * Ported from fetch-web-to-markdown.js.
 */
function shellEscape(str) {
  return "'" + str.replace(/'/g, "'\\''") + "'";
}

const env = loadEnv();
const DEBUG = env.DEBUG === 'true';

/**
 * Check if chub is available (via npx or global install)
 * @returns {boolean}
 */
function isChubAvailable() {
  try {
    execSync('npx chub --version', { stdio: 'pipe', timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run a chub command and return parsed output
 * @param {string} command - chub subcommand and args
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {string|null} stdout or null on failure
 */
function runChub(command, timeoutMs = 15000) {
  try {
    const result = execSync(`npx chub ${command}`, {
      encoding: 'utf8',
      timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim();
  } catch (error) {
    if (DEBUG) {
      console.error(`[DEBUG] npx chub ${command} failed:`, error.message);
    }
    return null;
  }
}

/**
 * Search Context Hub for documentation
 * @param {string} query - Search query
 * @returns {Array<Object>} Search results
 */
function searchChub(query) {
  // Use --json for structured output (reliable parsing)
  const output = runChub(`search ${shellEscape(query)} --json`);

  if (!output) return [];

  // Parse JSON output from chub search --json
  try {
    const parsed = JSON.parse(output);
    if (parsed.results && Array.isArray(parsed.results)) {
      return parsed.results.map(r => ({
        id: r.id,
        name: r.name || r.id,
        version: r.version || null,
        description: r.description || null,
        tags: r.tags || [],
      }));
    }
    return [];
  } catch {
    // Fallback: parse tabular output if --json failed
    const results = [];
    const lines = output.split('\n').filter(l => l.trim());

    for (const line of lines) {
      if (line.startsWith('─') || line.startsWith('=') || line.startsWith('ID')) continue;

      const parts = line.split(/\s*\|\s*/).filter(p => p.trim());
      if (parts.length >= 2) {
        results.push({
          id: parts[0].trim(),
          name: parts[1] ? parts[1].trim() : parts[0].trim(),
          version: parts[2] ? parts[2].trim() : null,
          description: parts[3] ? parts[3].trim() : null,
        });
      }
    }

    return results;
  }
}

/**
 * Get documentation from Context Hub by ID
 * @param {string} id - Documentation ID
 * @param {Object} options - Fetch options
 * @param {string} options.lang - Language (py, js, go, etc.)
 * @param {string} options.version - Version string
 * @returns {string|null} Documentation content
 */
function getChubDoc(id, options = {}) {
  let command = `get ${shellEscape(id)}`;

  if (options.lang) {
    command += ` --lang ${shellEscape(options.lang)}`;
  }

  if (options.version) {
    command += ` --version ${shellEscape(options.version)}`;
  }

  return runChub(command, 30000);
}

/**
 * Save a local annotation for a doc
 * @param {string} id - Documentation ID
 * @param {string} annotation - Note to save
 * @returns {boolean} Success
 */
function annotateChub(id, annotation) {
  const result = runChub(`annotate ${shellEscape(id)} ${shellEscape(annotation)}`);
  return result !== null;
}

/**
 * Detect language hint from query or environment
 * @param {string} query - User query
 * @returns {string|null} Language code or null
 */
function detectLanguage(query) {
  const langPatterns = {
    'py': /\b(?:python|py|django|flask|fastapi)\b/i,
    'js': /\b(?:javascript|js|node|express|react)\b/i,
    'ts': /\b(?:typescript|ts|nestjs|next\.js|angular)\b/i,
    'go': /\b(?:golang|go)\b/i,
    'rb': /\b(?:ruby|rails|rb)\b/i,
    'rs': /\b(?:rust|rs|cargo)\b/i,
    'swift': /\b(?:swift|swiftui|ios)\b/i,
    'kt': /\b(?:kotlin|kt|android)\b/i,
  };

  for (const [lang, pattern] of Object.entries(langPatterns)) {
    if (pattern.test(query)) return lang;
  }

  return null;
}

/**
 * Full fetch pipeline for Context Hub
 *
 * @param {string} query - User query
 * @param {Object} options - Options
 * @param {string} options.lang - Language override
 * @param {string} options.version - Version override
 * @returns {Object} Fetch result
 */
function fetchChub(query, options = {}) {
  // Step 1: Check if chub is available via npx
  if (!isChubAvailable()) {
    return {
      success: false,
      source: 'chub',
      error: 'Context Hub (@aisuite/chub) is not available',
      suggestion: 'Runs via npx — no install needed. Check your network connection or run: npx chub --version',
    };
  }

  // Step 2: Detect language
  const lang = options.lang || detectLanguage(query);

  // Step 3: Search
  const results = searchChub(query);

  if (DEBUG) {
    console.error(`[DEBUG] chub search returned ${results.length} results`);
  }

  if (results.length === 0) {
    return {
      success: false,
      source: 'chub',
      error: `No documentation found in Context Hub for "${query}"`,
      query,
      suggestion: 'Try fetch-context7.js or web search as fallback',
    };
  }

  // Step 4: Get the best match
  const bestMatch = results[0];

  if (DEBUG) {
    console.error(`[DEBUG] Fetching: ${bestMatch.id} (lang: ${lang || 'default'})`);
  }

  const content = getChubDoc(bestMatch.id, {
    lang: lang,
    version: options.version,
  });

  if (!content || content.trim().length === 0) {
    return {
      success: false,
      source: 'chub',
      error: `Found "${bestMatch.id}" but content was empty`,
      searchResults: results,
      suggestion: 'Try a different search term or fetch-context7.js',
    };
  }

  return {
    success: true,
    source: 'chub',
    id: bestMatch.id,
    name: bestMatch.name,
    version: bestMatch.version,
    lang: lang,
    content,
    tokenEstimate: Math.ceil(content.length / 4),
    totalResults: results.length,
    hasAnnotations: content.includes('[annotation]') || content.includes('[note]'),
  };
}

// ─── CLI ────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node fetch-chub.js "<query>" [--lang py] [--version v2]');
    process.exit(1);
  }

  // Parse CLI args
  const options = {};
  const queryParts = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--lang' && args[i + 1]) {
      options.lang = args[++i];
    } else if (args[i] === '--version' && args[i + 1]) {
      options.version = args[++i];
    } else {
      queryParts.push(args[i]);
    }
  }

  const query = queryParts.join(' ');
  const result = fetchChub(query, options);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = {
  fetchChub,
  isChubAvailable,
  searchChub,
  getChubDoc,
  annotateChub,
  detectLanguage,
  runChub,
};
