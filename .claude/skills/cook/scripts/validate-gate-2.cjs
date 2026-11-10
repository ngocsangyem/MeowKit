#!/usr/bin/env node
'use strict';
// validate-gate-2.cjs — CLI over the verdict parser.
//
// Usage: node validate-gate-2.cjs <path-to-verdict>
//        cat verdict.md | node validate-gate-2.cjs -
// Exit:  0 ready · 1 blocked
//
// The parser lives in the hook library so the ship guard, the completion check
// and this diagnostic all agree on what counts as a FAIL. This file only reads
// the argument (or stdin) and renders.

const fs = require('node:fs');
const path = require('node:path');

const { validateGate2 } = require(path.join(__dirname, '../../../hooks/lib/validate-gate-2.cjs'));

const input = process.argv[2] || '-';
const content = input === '-' ? fs.readFileSync(0, 'utf8') : null;
const result = validateGate2({ input, content });
if (result.stdout.length) process.stdout.write(`${result.stdout.join('\n')}\n`);
if (result.stderr.length) process.stderr.write(`${result.stderr.join('\n')}\n`);
process.exit(result.exit);
