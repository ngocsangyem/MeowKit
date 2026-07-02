#!/usr/bin/env node
// Validates that docs referenced from .claude/ files exist on disk.
const { existsSync } = require("node:fs");
const { join } = require("node:path");

const target = join(process.cwd(), ".claude/rules/security-rules.md");
process.exit(existsSync(target) ? 0 : 1);
