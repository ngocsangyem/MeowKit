#!/usr/bin/env node

/**
 * Environment variable loader for mk:docs-finder.
 *
 * Order, highest first: shell export, the project's `.meowkit/.env`, the env file an
 * older install kept in the runtime folder, then the user-wide `~/.meowkit/.env`. The first source to set a key
 * wins, so a project value beats the user-wide one. The project is found from the
 * runtime's project variable or the working directory, not from where this script
 * sits, so a skill installed under the home folder still reads the open project.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const REFUSED_KEYS = new Set([
  'PATH', 'LD_PRELOAD', 'LD_LIBRARY_PATH', 'DYLD_INSERT_LIBRARIES',
  'DYLD_FRAMEWORK_PATH', 'IFS', 'BASH_ENV', 'ENV',
]);

/**
 * Parse .env file content into key-value pairs (first definition of a key wins)
 * @param {string} content - .env file content
 * @returns {Object} Parsed environment variables
 */
function parseEnvFile(content) {
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('export ')) trimmed = trimmed.slice(7).trimStart();
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || REFUSED_KEYS.has(key) || key in env) continue;
    let value = trimmed.slice(eq + 1).trim();
    const quoted = value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.endsWith(value[0]);
    if (quoted) {
      // A quoted value keeps a literal `#`, which real API keys contain.
      value = value.slice(1, -1);
    } else {
      const comment = value.search(/\s#/);
      if (comment > 0) value = value.slice(0, comment).trimEnd();
    }
    env[key] = value;
  }
  return env;
}

/** The open project: the runtime's variable, else the nearest folder above cwd with `.meowkit/`. */
function findProjectRoot() {
  const fromEnv = process.env.MEOWKIT_PROJECT_DIR || process.env.CLAUDE_PROJECT_DIR || process.env.CURSOR_PROJECT_DIR;
  if (fromEnv) return fromEnv;
  const home = os.homedir();
  let dir = process.cwd();
  for (let depth = 0; depth < 12; depth += 1) {
    if (dir !== home && fs.existsSync(path.join(dir, '.meowkit'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

/** The env files in priority order, highest first. */
function envFiles() {
  const root = findProjectRoot();
  return [
    path.join(root, '.meowkit', '.env'),
    path.join(root, '.claude', '.env'),
    path.join(os.homedir(), '.meowkit', '.env'),
  ];
}

/**
 * Load environment variables from the env files and the shell
 * @returns {Object} Merged environment variables
 */
function loadEnv() {
  const merged = {};
  for (const envPath of envFiles()) {
    let content;
    try {
      content = fs.readFileSync(envPath, 'utf8');
    } catch {
      continue;
    }
    for (const [key, value] of Object.entries(parseEnvFile(content))) {
      if (!(key in merged)) merged[key] = value;
    }
  }
  return { ...merged, ...process.env };
}

/**
 * Get environment variable with fallback
 * @param {string} key
 * @param {string} defaultValue
 * @returns {string}
 */
function getEnv(key, defaultValue = '') {
  const env = loadEnv();
  return env[key] || defaultValue;
}

module.exports = {
  envFiles,
  findProjectRoot,
  loadEnv,
  getEnv,
  parseEnvFile,
};
