#!/usr/bin/env node
'use strict';
// check-contract-signed.cjs — CLI over the signed-contract check.
//
// Usage: node check-contract-signed.cjs
// Exit:  0 a signed contract exists, or the check defers · 1 the active task has none
//
// The rules live in the hook library so the write guard and this diagnostic can
// never disagree about what counts as signed. This file only renders.

const path = require('node:path');

const { checkContractSigned } = require(path.join(__dirname, '../../../hooks/lib/check-contract-signed.cjs'));

const { resolveProjectRoot } = require(path.join(__dirname, '../../../hooks/lib/project-root.cjs'));
const root = resolveProjectRoot();
const result = checkContractSigned({ root, env: process.env });
if (result.stdout.length) process.stdout.write(`${result.stdout.join('\n')}\n`);
if (result.stderr.length) process.stderr.write(`${result.stderr.join('\n')}\n`);
process.exit(result.exit);
