'use strict';
// jira-env-loader.cjs — report whether the issue-tracker credentials are present.
//
// This is the ONLY handler that reads the env files. It used to be loaded for
// every hook, which put a project-controlled file in front of all of them;
// narrowing it here means the files reach exactly the handler whose keys live
// in them.
//
// The keys are resolved the way the issue-tracker wrapper resolves them: shell
// export, then the project's `.meowkit/.env`, then the pre-move `.claude/.env`,
// then the user-wide `~/.meowkit/.env`. They are probed into a copy of the
// environment, never printed and never exported: each hook is its own process,
// so an export would not reach anything anyway, and printing a token into
// session context is the failure this check exists to avoid.

const os = require('node:os');
const path = require('node:path');

const { loadDotenv } = require('../lib/load-dotenv.cjs');

const REQUIRED_KEYS = ['MEOW_JIRA_API_TOKEN', 'MEOW_JIRA_EMAIL', 'MEOW_JIRA_SITE_URL'];

/** A found env file as the user would name it: project-relative, or under `~`. */
function displayName(file, root, home) {
  if (file.startsWith(root + path.sep)) return path.relative(root, file);
  return path.join('~', path.relative(home, file));
}

module.exports = function jiraEnvLoader(ctx) {
  const root = ctx.root;
  const home = os.homedir();
  const env = { ...process.env };
  const { found } = loadDotenv({ root, home, env });
  const missing = REQUIRED_KEYS.find((key) => !env[key]);
  if (!missing) return '[mk:jira] env OK\n';
  if (found.length === 0) {
    return '[mk:jira] .meowkit/.env missing — see .meowkit/.env.example for setup\n';
  }
  const where = found.map((file) => displayName(file, root, home)).join(', ');
  return `[mk:jira] ${missing} missing in ${where}\n`;
};
