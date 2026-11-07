'use strict';
// jira-env-loader.cjs — report whether the issue-tracker credentials are present.
//
// This is the ONLY handler that reads the project dotenv. It used to be loaded
// for every hook, which put a project-controlled file in front of all of them;
// narrowing it here means the file reaches exactly the handler whose keys live
// in it.
//
// The keys are probed, never printed and never exported. Each hook is its own
// process, so an export here would not reach anything anyway, and printing a
// token into session context is the failure this check exists to avoid.

const fs = require('node:fs');
const path = require('node:path');

const { loadDotenv } = require('../lib/load-dotenv.cjs');

const REQUIRED_KEYS = ['MEOW_JIRA_API_TOKEN', 'MEOW_JIRA_EMAIL', 'MEOW_JIRA_SITE_URL'];

module.exports = function jiraEnvLoader(ctx) {
  const root = ctx.root;
  const envFile = path.join(root, '.meowkit/.env');
  let content;
  try {
    content = fs.readFileSync(envFile, 'utf8');
  } catch {
    return '[mk:jira] .meowkit/.env missing — see .meowkit/.env.example for setup\n';
  }
  loadDotenv({ root });
  for (const key of REQUIRED_KEYS) {
    if (!new RegExp(`^${key}=`, 'm').test(content)) {
      return `[mk:jira] ${key} missing in .meowkit/.env\n`;
    }
  }
  return '[mk:jira] env OK\n';
};
