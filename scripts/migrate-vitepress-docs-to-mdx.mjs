#!/usr/bin/env node
// One-off migration tool: convert VitePress markdown (website/) to Fumadocs MDX
// (packages/docs/content/docs/). Re-runnable and deterministic.
//
// Pipeline per file:
//   1. Split frontmatter; keep title/description, drop VitePress-only keys.
//   2. Stage A (structural, fence-aware): inline @include partials, rewrite
//      ::: containers -> <Callout>/<details>, heading {#id} -> [#id], unwrap
//      VitePress <span class="vp-badge"> spans.
//   3. Title fixup: promote first H1 to title when frontmatter lacks one; strip
//      the leading H1 (Fumadocs renders the title via <DocsTitle>).
//   4. Stage B (escape, fence + inline-code aware): backtick-wrap bare
//      <placeholder> and {placeholder} tokens so MDX does not parse them as JSX
//      or expressions; convert HTML comments to {/* */}.
//
// Usage: node scripts/migrate-vitepress-docs-to-mdx.mjs [--only <dir>] [--verbose]

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'website');
const OUT = join(ROOT, 'packages/docs/content/docs');

// ---- CLI ----
const argv = process.argv.slice(2);
const onlyDir = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
const verbose = argv.includes('--verbose');

// ---- Constants ----
const CONTAINER_TYPE = {
  tip: 'info',
  info: 'info',
  warning: 'warn',
  danger: 'error',
  caution: 'error',
  note: 'info',
};
// Bare <word> tags that are real JSX/HTML and must NOT be backtick-escaped.
const TAG_WHITELIST = new Set([
  'Callout', 'Tabs', 'Tab', 'Fragment', 'details', 'summary',
]);
// Excluded from page output (partials + the home page handled in the landing phase).
const EXCLUDE_BASENAMES = new Set(['index.md']);

// ---- Frontmatter ----
function splitFrontmatter(raw) {
  if (!raw.startsWith('---')) return { fm: '', body: raw };
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return { fm: '', body: raw };
  const fm = raw.slice(3, end).replace(/^\n/, '');
  let body = raw.slice(end + 4);
  body = body.replace(/^\r?\n/, '');
  return { fm, body };
}

function extractFmValue(fm, key) {
  const re = new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm');
  const m = fm.match(re);
  if (!m) return null;
  let v = m[1].trim();
  if (v.startsWith('"') && v.endsWith('"')) {
    v = v.slice(1, -1).replace(/\\(["\\])/g, '$1'); // unescape YAML double-quoted string
  } else if (v.startsWith("'") && v.endsWith("'")) {
    v = v.slice(1, -1).replace(/''/g, "'"); // unescape YAML single-quoted string
  }
  return v;
}

function yamlQuote(s) {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

// ---- Fence-aware line grouping ----
// Returns array of { code: boolean, lines: string[] }.
function groupByFences(lines) {
  const groups = [];
  let cur = { code: false, lines: [] };
  let fence = null; // the marker string that opened the current fence
  for (const line of lines) {
    const m = line.match(/^(\s*)(`{3,}|~{3,})/);
    if (!fence && m) {
      // opening fence
      if (cur.lines.length) groups.push(cur);
      cur = { code: true, lines: [line] };
      fence = m[2][0]; // ` or ~
    } else if (fence && new RegExp(`^\\s*${fence === '`' ? '`{3,}' : '~{3,}'}\\s*$`).test(line)) {
      // closing fence
      cur.lines.push(line);
      groups.push(cur);
      cur = { code: false, lines: [] };
      fence = null;
    } else {
      cur.lines.push(line);
    }
  }
  if (cur.lines.length) groups.push(cur);
  return groups;
}

// ---- @include inlining (recursive) ----
function inlineIncludes(body, fileDir, seen = new Set()) {
  return body.replace(/^[ \t]*<!--\s*@include:\s*(.+?)\s*-->[ \t]*$/gm, (m, rel) => {
    const target = resolve(fileDir, rel.trim());
    if (seen.has(target)) return '';
    seen.add(target);
    let partial;
    try {
      partial = readFileSync(target, 'utf8');
    } catch {
      console.warn(`  ! @include target not found: ${rel}`);
      return m;
    }
    const { body: pBody } = splitFrontmatter(partial);
    return inlineIncludes(pBody, dirname(target), seen).trimEnd();
  });
}

// ---- Stage A: structural rewrites (fence-aware) ----
function stageA(body) {
  const groups = groupByFences(body.split('\n'));
  const out = [];
  for (const g of groups) {
    if (g.code) {
      out.push(...g.lines);
      continue;
    }
    out.push(...rewriteContainers(g.lines).flatMap(rewriteLineStructural));
  }
  return out.join('\n');
}

function rewriteLineStructural(line) {
  // Heading custom anchors: ## Title {#id} -> ## Title [#id]
  line = line.replace(/^(#{1,6}\s+.*?)\s*\{#([\w-]+)\}\s*$/, '$1 [#$2]');
  // Unwrap VitePress badge spans: <span class="vp-badge ...">X</span> -> `X`
  line = line.replace(/<span class="vp-badge[^"]*">(.*?)<\/span>/g, '`$1`');
  return [line];
}

// Container state machine over a non-fence line block.
function rewriteContainers(lines) {
  const out = [];
  const stack = [];
  for (const line of lines) {
    const open = line.match(/^:::\s+(tip|info|warning|danger|caution|note|details)(?:\s+(.*))?\s*$/);
    const close = /^:::\s*$/.test(line);
    if (open) {
      const kind = open[1];
      const title = (open[2] || '').trim();
      if (kind === 'details') {
        out.push('<details>');
        if (title) out.push(`<summary>${stripInlineMarkup(title)}</summary>`);
        out.push('');
        stack.push('</details>');
      } else {
        const type = CONTAINER_TYPE[kind] || 'info';
        const attrs = title ? ` title=${yamlQuote(stripInlineMarkup(title))} type="${type}"` : ` type="${type}"`;
        out.push(`<Callout${attrs}>`);
        out.push('');
        stack.push('</Callout>');
      }
    } else if (close && stack.length) {
      out.push('');
      out.push(stack.pop());
    } else {
      out.push(line);
    }
  }
  // Close any unbalanced containers defensively.
  while (stack.length) {
    out.push('');
    out.push(stack.pop());
  }
  return out;
}

function stripInlineMarkup(s) {
  return s.replace(/`/g, '').trim();
}

// ---- Title fixup ----
function extractAndStripFirstH1(body) {
  const lines = body.split('\n');
  const groups = groupByFences(lines);
  let title = null;
  const out = [];
  let stripped = false;
  for (const g of groups) {
    if (g.code || stripped) {
      out.push(...g.lines);
      continue;
    }
    const kept = [];
    for (const line of g.lines) {
      if (!stripped) {
        const h1 = line.match(/^#\s+(.+?)\s*$/);
        if (h1) {
          title = h1[1].replace(/\s*\[#[\w-]+\]\s*$/, '').trim();
          stripped = true;
          continue; // drop the H1 line
        }
      }
      kept.push(line);
    }
    out.push(...kept);
  }
  return { title, body: out.join('\n') };
}

// ---- Stage B: MDX escaping (fence + inline-code aware) ----
function stageB(body) {
  const groups = groupByFences(body.split('\n'));
  const out = [];
  let region = [];
  const flush = () => {
    if (region.length) {
      out.push(escapeProseRegion(region.join('\n')));
      region = [];
    }
  };
  for (const g of groups) {
    if (g.code) {
      flush();
      out.push(g.lines.join('\n'));
    } else {
      region.push(...g.lines);
    }
  }
  flush();
  return out.join('\n');
}

function escapeProseRegion(text) {
  // Multi-line HTML comments (cannot be inside single-line inline code) -> {/* */}
  text = text.replace(/<!--([\s\S]*?)-->/g, (m, inner) => {
    if (!m.includes('\n')) return m; // single-line handled per-line below
    return `{/*${inner.replace(/\*\//g, '* /')}*/}`;
  });
  return text.split('\n').map(escapeProseLine).join('\n');
}

function escapeProseLine(line) {
  // Tokenize by inline-code spans; escape only the prose segments.
  const parts = line.split(/(``[^`]*``|`[^`]+`)/g);
  // A structural pipe outside code means this is a GFM table row: pipes inside
  // a code span must be \|-escaped or the cell splits and breaks the span.
  const isTableRow = parts.some((p, i) => i % 2 === 0 && p.includes('|'));
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return isTableRow ? part.replace(/(?<!\\)\|/g, '\\|') : part;
      return escapeProsePart(part);
    })
    .join('');
}

function escapeProsePart(s) {
  // 1. Bare autolinks <https://...> -> [url](url) (MDX has no autolink support).
  s = s.replace(/<(https?:\/\/[^>\s]+)>/g, '[$1]($1)');
  // 2. Bare <word> placeholder tags (no attributes, no slash) -> `<word>`
  s = s.replace(/<([A-Za-z][A-Za-z0-9._-]*)>/g, (m, tag) =>
    TAG_WHITELIST.has(tag) ? m : '`' + m + '`',
  );
  // 3. Remaining "<" that cannot begin a JSX element/closing tag/fragment
  //    (e.g. "<5 files", "< 30", "<="): escape so MDX treats it as literal text.
  s = s.replace(/<(?![A-Za-z_$/>])/g, '\\<');
  // 4. {placeholder} expression-shaped tokens -> `{placeholder}`
  s = s.replace(/\{([^{}`]+)\}/g, (m) => '`' + m + '`');
  // 5. Single-line HTML comments -> {/* */}
  s = s.replace(/<!--([\s\S]*?)-->/g, (m, inner) => `{/*${inner.replace(/\*\//g, '* /')}*/}`);
  return s;
}

// ---- File walk ----
function walk(dir) {
  const results = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'plans' || name === 'node_modules' || name.startsWith('.')) continue;
      results.push(...walk(full));
    } else if (name.endsWith('.md')) {
      if (name.startsWith('_')) continue; // partials
      if (EXCLUDE_BASENAMES.has(name) && dir === SRC) continue; // home page
      results.push(full);
    }
  }
  return results;
}

// ---- Convert one file ----
function convert(file) {
  const raw = readFileSync(file, 'utf8');
  const { fm, body: rawBody } = splitFrontmatter(raw);
  let title = extractFmValue(fm, 'title');
  const description = extractFmValue(fm, 'description');

  let body = inlineIncludes(rawBody, dirname(file));
  body = stageA(body);
  const h1 = extractAndStripFirstH1(body);
  body = h1.body;
  if (!title && h1.title) title = h1.title;
  body = stageB(body);
  body = body.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').trimEnd() + '\n';

  const fmLines = ['---'];
  fmLines.push(`title: ${yamlQuote(title || basename(file, '.md'))}`);
  if (description) fmLines.push(`description: ${yamlQuote(description)}`);
  fmLines.push('---', '', '');

  const relPath = relative(SRC, file).replace(/\.md$/, '.mdx');
  const outPath = join(OUT, relPath);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, fmLines.join('\n') + body);
  return { relPath, title };
}

// ---- Main ----
let files = walk(SRC);
if (onlyDir) {
  files = files.filter((f) => relative(SRC, f).startsWith(onlyDir));
}
const byDir = {};
for (const f of files) {
  const r = convert(f);
  const top = r.relPath.split('/')[0].replace(/\.mdx$/, '(root)');
  byDir[top] = (byDir[top] || 0) + 1;
  if (verbose) console.log(`  ${r.relPath}  ->  ${r.title}`);
}
console.log(`Converted ${files.length} files:`);
for (const [d, n] of Object.entries(byDir).sort()) console.log(`  ${d}: ${n}`);
