#!/usr/bin/env node
'use strict';
// check-env-reads.cjs — every environment name the shipped kit reads is classified.
//
// The allowlist is not written here. It is `env-name-classification.json`, loaded
// as data, which is the same file the universe test diffs the scan against. One
// source means the check and the table cannot disagree: a name allowlisted here
// but missing there, or classified differently, fails both.
//
// A name recorded as no longer read is checked in the other direction too, by
// `lib/env-table-audit.cjs`: a read of one means the migration did not land, and
// a live name whose reader column names the wrong file means the table describes
// a kit that no longer exists. Both halves have to hold, because each one green
// on its own is how the table came to state the opposite of the code.
//
//   node scripts/check-env-reads.cjs [--json]

const fs = require('node:fs');
const path = require('node:path');

const { scanReads } = require('./lib/env-read-scan.cjs');
const { auditTable } = require('./lib/env-table-audit.cjs');

const ROOT = path.resolve(__dirname, '..');
const TABLE_REL = 'env-name-classification.json';
const TREES = ['.claude', path.join('packages', 'mewkit', 'src')];

function loadTable() {
  const file = path.join(ROOT, TABLE_REL);
  const table = JSON.parse(fs.readFileSync(file, 'utf8'));
  const byName = new Map();
  for (const row of table.names) byName.set(row.name, row);
  return { table, byName };
}

function main() {
  const asJson = process.argv.includes('--json');
  const { table, byName } = loadTable();
  const reads = scanReads(ROOT, TREES, table);

  const violations = [];
  const flag = (read, reason, fix) =>
    violations.push({
      name: read.name,
      file: path.relative(ROOT, read.file),
      line: read.line,
      composed: Boolean(read.composed),
      reason,
      fix,
    });

  for (const read of reads) {
    if (byName.has(read.name)) continue;
    flag(read, `not classified in ${TABLE_REL}`, `add a row for ${read.name} with its class, or remove the read`);
  }

  const stale = auditTable(ROOT, table, reads);
  const total = violations.length + stale.length;

  if (asJson) {
    process.stdout.write(`${JSON.stringify({ scanned: reads.length, violations, stale }, null, 2)}\n`);
  } else if (total === 0) {
    process.stdout.write(`PASS: ${reads.length} environment-name reads, all classified in ${TABLE_REL}; every row agrees with the code\n`);
  } else {
    for (const v of violations) {
      const how = v.composed ? 'composed read' : 'read';
      process.stderr.write(`${v.file}:${v.line}: ${how} of ${v.name} — ${v.reason}\n  fix: ${v.fix}\n`);
    }
    for (const s of stale) {
      process.stderr.write(`${TABLE_REL}: ${s.name} — ${s.reason}\n  fix: ${s.fix}\n`);
    }
    process.stderr.write(`FAIL: ${violations.length} unclassified read(s), ${stale.length} row(s) disagreeing with the code\n`);
  }
  process.exit(total === 0 ? 0 : 1);
}

main();
