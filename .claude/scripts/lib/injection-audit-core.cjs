'use strict';
// injection-audit-core.cjs — output validation: scan written files for signs
// that an injection attempt succeeded.
//
// This is the library half; `../injection-audit.cjs` is the command line. The
// split exists because two skill scripts need the scanning functions directly
// rather than a formatted report, and a second copy of the pattern set is the
// one outcome a safety check must never have — two sets drift, and the one that
// drifts is the one nobody is watching.

const fs = require('node:fs');
const path = require('node:path');

const { CLASSES, SCANNED_SUFFIXES, SKIP_DIRS } = require('./injection-audit-patterns.cjs');

/** One finding. `line` is 0 when the finding is about the file, not a line in it. */
function finding(level, category, description, file, line = 0) {
  return { level, category, description, file, line };
}

/** Render a finding for a human reader. */
function formatFinding(f) {
  const loc = f.line ? ` (line ${f.line})` : '';
  return `[${f.level}] [${f.category}] ${f.description} — ${f.file}${loc}`;
}

/**
 * Split into lines the way a line-numbering scanner must: the trailing newline
 * that ends the last line does not start an empty one, so a file of N lines
 * reports line numbers 1..N and never N+1.
 */
function toLines(content) {
  if (content === '') return [];
  const lines = content.split(/\r\n|\n|\r/);
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** Scan text. Findings come out in line order, then in class order within a line. */
function scanContent(content, filepath) {
  const findings = [];
  const lines = toLines(content);
  for (let i = 0; i < lines.length; i += 1) {
    for (const klass of CLASSES) {
      for (const { source, regex } of klass.compiled) {
        if (regex.test(lines[i])) {
          findings.push(finding(klass.level, klass.category, `${klass.prefix}: ${source}`, filepath, i + 1));
        }
      }
    }
  }
  return findings;
}

/**
 * Scan one file. An unreadable file yields no findings rather than an error:
 * this runs after a task as a check, and a permission problem on an unrelated
 * file must not read as a clean result for the files that WERE scanned, nor
 * abort the scan of them.
 */
function scanFile(filepath) {
  let content;
  try {
    content = fs.readFileSync(filepath, 'utf8');
  } catch {
    return [];
  }
  return scanContent(content, filepath);
}

/**
 * Resolve a path whose tail need not exist, following symlinks as far as it
 * does. Needed because the boundary check must answer for a path that was just
 * written, or was never written at all, and a plain string comparison would be
 * fooled by a symlink pointing out of the project.
 */
function resolveLoose(target) {
  let current = path.resolve(target);
  const tail = [];
  for (;;) {
    try {
      return path.join(fs.realpathSync(current), ...tail);
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(target);
      tail.unshift(path.basename(current));
      current = parent;
    }
  }
}

/** A finding when `filepath` resolves outside `projectRoot`, else null. */
function checkFileOutsideProject(filepath, projectRoot) {
  const resolved = resolveLoose(filepath);
  const root = resolveLoose(projectRoot);
  const rel = path.relative(root, resolved);
  const inside = rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  if (inside) return null;
  return finding('CRITICAL', 'BOUNDARY_VIOLATION', 'File written outside project directory', String(filepath));
}

/**
 * Walk `directory` and scan the text files under it.
 *
 * Entries are sorted, so two runs over one tree report findings in the same
 * order. Directory order is not something a filesystem promises, and a report
 * whose line order moves between runs cannot be diffed against a previous one.
 */
function scanDirectory(directory) {
  const findings = [];
  const stack = [directory];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    const names = entries.slice().sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const dirs = [];
    for (const entry of names) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) dirs.push(full);
      } else if (SCANNED_SUFFIXES.has(path.extname(entry.name))) {
        findings.push(...scanFile(full));
      }
    }
    for (let i = dirs.length - 1; i >= 0; i -= 1) stack.push(dirs[i]);
  }
  return findings;
}

/** `yymmdd-HHMMSS` in local time, matching the rest of the telemetry stamps. */
function logStamp(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(now.getFullYear() % 100)}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
}

/**
 * Append the CRITICAL findings to the security log.
 *
 * Telemetry, NOT the memory store: a description quotes the payload that
 * matched, and the memory files are committed and read back as DATA by the
 * skills that grep them. Recording there would turn the audit trail into a
 * delivery channel for the payload it recorded.
 *
 * A failed write is swallowed. The audit's verdict is already on stdout and the
 * caller acts on the exit status; losing the log must not also lose the verdict.
 */
function writeSecurityLog(findings, logPath, command = 'unknown') {
  const critical = findings.filter((f) => f.level === 'CRITICAL');
  if (!critical.length) return;
  const stamp = logStamp();
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const body = critical.map((f) => `[${stamp}] [${f.level}] [${command}] ${f.description} — ${f.file}\n`).join('');
    fs.appendFileSync(logPath, body, 'utf8');
  } catch {
    /* see above */
  }
}

module.exports = {
  checkFileOutsideProject,
  finding,
  formatFinding,
  resolveLoose,
  scanContent,
  scanDirectory,
  scanFile,
  toLines,
  writeSecurityLog,
};
