'use strict';
// env-table-audit.cjs — the converse of the read check: does the classification
// table still describe the code?
//
// The read check answers "is every read classified?". On its own that is half a
// property, and the missing half is the one that went wrong: a table can name a
// reader file that stopped reading the name, and can record a name as replaced
// by a config key while a shipped script still reads the variable. Both stay
// green under a scan that only looks outward from the reads, and both make the
// kit state the opposite of what it does — in a `doctor` row that tells a user
// to unset a name two scripts read, or a session banner reporting a setting's
// inverse.
//
// So each row is checked against the reads:
//   a REPLACED name (a config key took it over, or nothing did) must be read
//     nowhere in the shipped kit;
//   a LIVE name must be read somewhere, and at least one file its reader column
//     names must be one of the files that reads it.
//
// Two reads are invisible to any syntactic scan: a name composed from an index
// (`f'…_{i}'`) and a name read by a markdown skill step rather than by code.
// Those are declared in the table by name with a reason, and the check still
// requires their reader file to exist, so a renamed or deleted reader is caught.

const fs = require('node:fs');
const path = require('node:path');

/** A name whose class means "no longer read from the environment". */
const REPLACED_CLASSES = new Set(['toggle', 'drop']);

/** A path-looking token in a reader column. Prose around it is ignored. */
const READER_PATH = /[A-Za-z0-9_.\-/]+\.(?:cjs|mjs|js|ts|tsx|py|sh|md|json)/g;

/** Reader columns are written relative to the kit, the CLI source, or the root. */
const READER_ROOTS = ['.claude', path.join('packages', 'mewkit', 'src'), '.'];

/** The first root under which `token` exists, as an absolute path, or null. */
function resolveReader(root, token) {
  for (const base of READER_ROOTS) {
    const full = path.resolve(root, base, token);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

/** Reads grouped by name, each entry keeping its file and how it was found. */
function groupByName(reads) {
  const byName = new Map();
  for (const read of reads) {
    const list = byName.get(read.name);
    if (list === undefined) byName.set(read.name, [read]);
    else list.push(read);
  }
  return byName;
}

/**
 * Whether `readerFile` is one of the files that read the name. A composed read
 * is attributed to the file spelling the suffix, which is never the file making
 * the call — so for those the whole composition zone counts, which is the unit
 * the table documents anyway.
 */
function readerMatches(root, readerFile, reads, zones) {
  for (const read of reads) {
    if (path.resolve(read.file) === path.resolve(readerFile)) return true;
    if (!read.composed) continue;
    for (const zone of zones) {
      const dir = path.resolve(root, zone.dir);
      if (path.resolve(read.file).startsWith(dir) && path.resolve(readerFile).startsWith(dir)) return true;
    }
  }
  return false;
}

/**
 * `[{ name, reason, fix }]` — empty when the table and the code agree.
 * `reads` is the output of `scanReads` for the same trees the check scans.
 */
function auditTable(root, table, reads) {
  const byName = groupByName(reads);
  const zones = table.compositionZones || [];
  const unverifiable = new Set(Object.keys(table.readerUnverifiable || {}).filter((k) => k !== 'comment'));
  const problems = [];
  const flag = (name, reason, fix) => problems.push({ name, reason, fix });

  for (const row of table.names) {
    const found = byName.get(row.name) || [];

    if (REPLACED_CLASSES.has(row.class)) {
      for (const read of found) {
        const replacement = row.key === '' ? 'nothing replaced it' : `its replacement is ${row.key}`;
        flag(
          row.name,
          `recorded as no longer read (${replacement}), yet read at ${path.relative(root, read.file)}:${read.line}`,
          'resolve the value from the config instead, or reclassify the name as still read',
        );
      }
      continue;
    }

    const tokens = row.reader.match(READER_PATH) || [];
    if (tokens.length === 0) {
      flag(row.name, 'its reader column names no file', 'name the file that reads it, so a reader that stops reading is detectable');
      continue;
    }
    const resolved = tokens.map((t) => ({ token: t, file: resolveReader(root, t) }));
    for (const entry of resolved.filter((e) => e.file === null)) {
      flag(row.name, `its reader column names ${entry.token}, which does not exist`, 'point the column at the file that reads the name today');
    }
    const present = resolved.filter((e) => e.file !== null);
    if (present.length === 0) continue;

    if (unverifiable.has(row.name)) continue;

    if (found.length === 0) {
      flag(row.name, 'classified as still read, but nothing reads it', 'reclassify it, delete it, or declare why the read is invisible to a scan');
      continue;
    }
    if (!present.some((e) => readerMatches(root, e.file, found, zones))) {
      const actual = [...new Set(found.map((r) => path.relative(root, r.file)))].join(', ');
      flag(row.name, `its reader column names ${tokens.join(', ')}, but the read is at ${actual}`, 'correct the reader column');
    }
  }

  return problems;
}

module.exports = { REPLACED_CLASSES, auditTable, resolveReader };
