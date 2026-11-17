'use strict';
// instruction-criteria-frontmatter.cjs — read top-level scalar values from a Markdown
// frontmatter block or a TOML agent file without a YAML dependency.
//
// Only the scalar forms the kit uses are handled: plain, single-quoted, double-quoted and
// `>`/`|` block scalars, each possibly continued on indented lines. Lists and maps are skipped.

/** The frontmatter block of a Markdown file, or '' when it has none. */
function frontmatterBlock(text) {
  if (!text.startsWith('---')) return '';
  const end = text.indexOf('\n---', 3);
  return end < 0 ? '' : text.slice(text.indexOf('\n') + 1, end + 1);
}

/** Line number (1-based) of the first line of a frontmatter key, or 1 when absent. */
function keyLine(text, key) {
  const lines = text.split('\n');
  const at = new RegExp(`^${key}\\s*[:=]`);
  const i = lines.findIndex((l) => at.test(l));
  return i < 0 ? 1 : i + 1;
}

function unquote(raw) {
  const v = raw.trim();
  if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) {
    try {
      return JSON.parse(v);
    } catch {
      return v.slice(1, -1);
    }
  }
  if (v.startsWith("'") && v.endsWith("'") && v.length >= 2) return v.slice(1, -1).replace(/''/g, "'");
  return v;
}

/** The value of a top-level key in a frontmatter block, or undefined. */
function frontmatterValue(text, key) {
  const lines = frontmatterBlock(text).split('\n');
  const i = lines.findIndex((l) => l.startsWith(`${key}:`));
  if (i < 0) return undefined;
  const head = lines[i].slice(key.length + 1).trim();
  const block = /^[>|][-+]?$/.test(head);
  const cont = [];
  for (let j = i + 1; j < lines.length; j += 1) {
    // A block scalar runs on through blank lines until the next unindented key.
    if (/^\s+\S/.test(lines[j])) cont.push(lines[j].trim());
    else if (!(block && lines[j].trim() === '')) break;
  }
  if (block) return cont.join(head.startsWith('>') ? ' ' : '\n');
  return unquote([head, ...cont].join(' '));
}

/** The value of a top-level `key = "value"` line in a TOML file, or undefined. */
function tomlValue(text, key) {
  // Top-level keys come before the first table header; a trailing `# comment` is dropped.
  const top = text.split(/^\[/m)[0];
  const m = top.match(new RegExp(`^${key}\\s*=\\s*("[^"]*"|'[^']*'|[^#\\s]+)`, 'm'));
  return m ? unquote(m[1]) : undefined;
}

module.exports = { frontmatterBlock, frontmatterValue, keyLine, tomlValue };
