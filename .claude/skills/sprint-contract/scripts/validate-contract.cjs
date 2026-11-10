#!/usr/bin/env node
'use strict';
// validate-contract.cjs — CLI over the contract schema validator.
//
// Usage: node validate-contract.cjs <path-to-contract.md>
// Exit:  0 valid · 1 schema failure (diagnostics on stderr) · 2 usage error
//
// The rules live in the hook library so the write guard and this diagnostic can
// never disagree about what a valid contract is. This file only renders.

const path = require('node:path');

const { validateContract } = require(path.join(__dirname, '../../../hooks/lib/validate-contract.cjs'));

const result = validateContract(process.argv[2] || '', { usage: process.argv[1] });
if (result.stdout.length) process.stdout.write(`${result.stdout.join('\n')}\n`);
if (result.stderr.length) process.stderr.write(`${result.stderr.join('\n')}\n`);
process.exit(result.exit);
