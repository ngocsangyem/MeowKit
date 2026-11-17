#!/usr/bin/env node
'use strict';
// check-bundle-parity.cjs — keep the hand-ported Codex and Cursor bundles in step with
// `.claude/`.
//
// For every Claude Code skill and agent, the matching bundle folder or file must exist and
// each Markdown file in it must carry the same heading outline once host terms are folded
// (see lib/bundle-parity-outline.cjs). A difference the bundles hold on purpose is listed in
// scripts/bundle-parity-allow.json with its reason. An unlisted difference fails, and so does
// a listed one that no longer occurs, so the list only shrinks as ports catch up.
//
//   node scripts/check-bundle-parity.cjs            report and exit 1 on an unlisted difference
//   node scripts/check-bundle-parity.cjs --list     print every difference as allow-list keys

const fs = require('node:fs');
const path = require('node:path');
const { outlineOf, markdownFiles, firstDifference } = require('./lib/bundle-parity-outline.cjs');

const HOSTS = {
  codex: {
    skills: 'kit/bundles/codex/root/.agents/skills',
    agents: 'kit/bundles/codex/root/.codex/agents',
    agentExt: '.toml',
    relocated: { 'rubric/rubrics/': 'kit/bundles/codex/root/.codex/rubrics/' },
  },
  cursor: {
    skills: 'kit/bundles/cursor/root/.cursor/skills',
    agents: 'kit/bundles/cursor/root/.cursor/agents',
    agentExt: '.md',
    relocated: { 'rubric/rubrics/': 'kit/bundles/cursor/root/.cursor/rubrics/' },
  },
};

/**
 * Where a skill file's port lives: beside it in the bundle skill (`rel` when present), or
 * under a host-level folder the bundle keeps it in instead (`relocated`). Null when absent.
 */
function portPath(root, host, dst, skillRel, rel) {
  if (rel) return path.join(dst, rel);
  for (const [prefix, target] of Object.entries(host.relocated || {})) {
    if (!skillRel.startsWith(prefix)) continue;
    const file = path.join(root, target, skillRel.slice(prefix.length));
    if (fs.existsSync(file)) return file;
  }
  return null;
}

/**
 * Every difference between `.claude/` and the bundles under `root`, as
 * `{ key, detail }`. Keys read `<host>:<kind>:<path>`, kind one of
 * skill-missing, skill-extra, file-missing, file-extra, outline,
 * agent-missing, agent-extra.
 */
function differences(root) {
  const out = [];
  const add = (key, detail = '') => out.push({ key, detail });
  const ccSkills = path.join(root, '.claude/skills');
  const ccAgents = path.join(root, '.claude/agents');
  const skillNames = fs
    .readdirSync(ccSkills, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();
  const agentNames = fs
    .readdirSync(ccAgents)
    .filter((f) => f.endsWith('.md') && !/_INDEX\.md$/.test(f))
    .map((f) => f.slice(0, -3))
    .sort();

  for (const [host, h] of Object.entries(HOSTS)) {
    const skillsDir = path.join(root, h.skills);
    const ported = new Set(
      fs.readdirSync(skillsDir).filter((n) => n.startsWith('mk-')).map((n) => n.slice(3)),
    );
    for (const name of skillNames) {
      if (!ported.has(name)) {
        add(`${host}:skill-missing:${name}`);
        continue;
      }
      const src = path.join(ccSkills, name);
      const dst = path.join(skillsDir, `mk-${name}`);
      const srcFiles = markdownFiles(src);
      const dstFiles = new Set(markdownFiles(dst));
      for (const rel of srcFiles) {
        const port = portPath(root, h, dst, `${name}/${rel}`, dstFiles.has(rel) ? rel : null);
        if (!port) {
          add(`${host}:file-missing:${name}/${rel}`);
          continue;
        }
        const diff = firstDifference(outlineOf(path.join(src, rel)), outlineOf(port));
        if (diff) add(`${host}:outline:${name}/${rel}`, `heading ${diff.index + 1}: "${diff.source}" vs "${diff.port}"`);
      }
      for (const rel of dstFiles) if (!srcFiles.includes(rel)) add(`${host}:file-extra:${name}/${rel}`);
    }
    for (const name of [...ported].sort()) if (!skillNames.includes(name)) add(`${host}:skill-extra:${name}`);

    const agentsDir = path.join(root, h.agents);
    const portedAgents = fs
      .readdirSync(agentsDir)
      .filter((f) => f.endsWith(h.agentExt))
      .map((f) => f.slice(0, -h.agentExt.length));
    for (const name of agentNames) {
      const port = path.join(agentsDir, `${name}${h.agentExt}`);
      if (!fs.existsSync(port)) {
        add(`${host}:agent-missing:${name}`);
        continue;
      }
      const titleless = { dropTitle: true };
      const diff = firstDifference(outlineOf(path.join(ccAgents, `${name}.md`), titleless), outlineOf(port, titleless));
      if (diff) add(`${host}:outline:agents/${name}`, `heading ${diff.index + 1}: "${diff.source}" vs "${diff.port}"`);
    }
    for (const name of portedAgents) if (!agentNames.includes(name)) add(`${host}:agent-extra:${name}`);
  }
  return out;
}

/** Allow-list keys, each mapped to its reason; `*:` keys cover both hosts. */
function loadAllow(root) {
  const file = path.join(root, 'scripts/bundle-parity-allow.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const allow = new Map();
  for (const [reason, keys] of Object.entries(raw.differences)) {
    for (const key of keys) {
      if (key.startsWith('*:')) for (const host of Object.keys(HOSTS)) allow.set(`${host}${key.slice(1)}`, reason);
      else allow.set(key, reason);
    }
  }
  return allow;
}

/** `{ unlisted, stale }`: differences not in the allow-list, and listed keys that no longer occur. */
function check(root) {
  const found = differences(root);
  const allow = loadAllow(root);
  const seen = new Set(found.map((d) => d.key));
  return {
    found,
    unlisted: found.filter((d) => !allow.has(d.key)),
    stale: [...allow.keys()].filter((k) => !seen.has(k)).sort(),
  };
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  if (process.argv.includes('--list')) {
    for (const d of differences(root)) process.stdout.write(`${d.key}${d.detail ? `\t${d.detail}` : ''}\n`);
    process.exit(0);
  }
  const { found, unlisted, stale } = check(root);
  for (const d of unlisted) process.stderr.write(`unlisted: ${d.key}${d.detail ? ` — ${d.detail}` : ''}\n`);
  for (const k of stale) process.stderr.write(`stale allow-list entry (now in step, remove it): ${k}\n`);
  if (unlisted.length || stale.length) {
    process.stderr.write(
      'Port the change to the bundle file named above, or, when the bundle differs on purpose,\n' +
        'list the key in scripts/bundle-parity-allow.json under its reason.\n',
    );
    process.exit(1);
  }
  process.stdout.write(`bundle parity: ${found.length} known difference(s), none unlisted\n`);
}

module.exports = { differences, check };
