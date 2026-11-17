'use strict';
// bundle-parity-outline.cjs — the heading outline of a skill, agent or rule file, with
// host terms folded together so that a Codex or Cursor port compares equal to its
// Claude Code source when only the host's words differ.

const fs = require('node:fs');
const path = require('node:path');

/** Host-specific spellings that name the same thing, folded to one token. */
const HOST_TERMS = [
  [/\$mk-|\/mk-|\/?mk:/g, 'mk '],
  [/\bthe ([a-z0-9-]+) skill\b/g, 'mk $1'],
  [/\bclaude code\b|\bclaude\b|\bcodex\b|\bcursor\b/g, 'host'],
  [/\b(?:via |by )?ask(?:ing)? ?(?:the )?user ?(?:question)?\b|\bvia ask ?user ?question\b/g, 'ask'],
  [/\bask ?user ?question\b|\buser question\b/g, 'ask'],
  [/\bsub-?agents?\b|\bsub-?tasks?\b/g, 'subagent'],
  [/\btask\(\)|\bagent\(\)/g, 'spawn'],
  [/\bclaude\.md\b|\bagents\.md\b/g, 'project instructions'],
  // The Cursor agents name the injection rule of two by what it guards.
  [/\btrust boundary\b|\bskill rule of two\b/g, 'rule of two'],
];

/** One heading's text, lowercased, host terms folded, punctuation dropped. */
function normaliseHeading(text) {
  let t = text.toLowerCase().replace(/[`*_]/g, '');
  for (const [pattern, token] of HOST_TERMS) t = t.replace(pattern, token);
  return t.replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** `level text` for every Markdown heading up to level 4 outside fenced code. */
function outlineOfMarkdown(text) {
  const out = [];
  let fenced = false;
  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    const m = !fenced && line.match(/^(#{1,4}) (.+)$/);
    if (m) out.push(`${m[1].length} ${normaliseHeading(m[2])}`);
  }
  return out;
}

/** A Codex agent's Markdown lives in its `developer_instructions` string. */
function codexAgentBody(toml) {
  const m = toml.match(/developer_instructions\s*=\s*("""|''')([\s\S]*?)\1/);
  return m ? m[2] : '';
}

/**
 * The outline of `file`, reading the instruction body out of a Codex agent TOML.
 * `dropTitle` leaves out level-1 headings: a Cursor agent opens with a `# name` title
 * that the Claude Code and Codex agents carry in frontmatter instead.
 */
function outlineOf(file, { dropTitle = false } = {}) {
  const text = fs.readFileSync(file, 'utf8');
  const outline = outlineOfMarkdown(path.extname(file) === '.toml' ? codexAgentBody(text) : text);
  return dropTitle ? outline.filter((h) => !h.startsWith('1 ')) : outline;
}

/** Markdown files under `dir`, relative, skipping tests and tool caches. */
function markdownFiles(dir, base = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (!/^(tests|__pycache__|node_modules|\.venv|\.pytest_cache)$/.test(e.name)) {
        out.push(...markdownFiles(path.join(dir, e.name), rel));
      }
    } else if (e.name.endsWith('.md') && !e.name.includes('.test.')) {
      out.push(rel);
    }
  }
  return out.sort();
}

/** First differing outline line between two outlines, or null when they match. */
function firstDifference(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return { index: i, source: a[i] ?? '(end)', port: b[i] ?? '(end)' };
  }
  return null;
}

module.exports = { normaliseHeading, outlineOfMarkdown, outlineOf, codexAgentBody, markdownFiles, firstDifference };
