#!/usr/bin/env node

/**
 * Environment variable loader for meow:docs-finder skill
 * Priority: process.env > skill/.env > skills/.env > .claude/.env
 */

const fs = require('fs');
const path = require('path');

/**
 * Parse .env file content into key-value pairs
 * @param {string} content - .env file content
 * @returns {Object} Parsed environment variables
 */
function parseEnvFile(content) {
  const env = {};
  const lines = content.split('\n');

  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue;

    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (match) {
      const key = match[1];
      let value = match[2].trim();

      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      env[key] = value;
    }
  }

  return env;
}

/**
 * Load environment variables from .env files in priority order
 * @returns {Object} Merged environment variables
 */
function loadEnv() {
  const skillDir = path.resolve(__dirname, '../..');
  const skillsDir = path.resolve(skillDir, '..');
  const claudeDir = path.resolve(skillsDir, '..');

  const envPaths = [
    path.join(claudeDir, '.env'),
    path.join(skillsDir, '.env'),
    path.join(skillDir, '.env'),
  ];

  let mergedEnv = {};

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf8');
        const parsed = parseEnvFile(content);
        mergedEnv = { ...mergedEnv, ...parsed };
      } catch (error) {
        // Silently skip unreadable files
      }
    }
  }

  mergedEnv = { ...mergedEnv, ...process.env };

  return mergedEnv;
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
  loadEnv,
  getEnv,
  parseEnvFile,
};
