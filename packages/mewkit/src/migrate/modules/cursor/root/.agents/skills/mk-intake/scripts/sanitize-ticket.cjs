#!/usr/bin/env node
"use strict";

const { validateContent } = require("../../../hooks/lib/validate-content.cjs");

function boundedQuote(content, pattern) {
  const match = new RegExp(pattern, "i").exec(content);
  if (!match) return "";
  return content.slice(match.index, match.index + 240);
}

function inspectTicket(content) {
  if (typeof content !== "string" || !content.trim()) return { safe: false, reason: "empty-ticket", quote: "" };
  const verdict = validateContent(content);
  if (verdict.valid) return { safe: true };
  return { safe: false, reason: "injection-pattern", quote: boundedQuote(content, verdict.pattern) };
}

if (require.main === module) {
  const content = process.argv.length > 2 ? process.argv[2] : require("node:fs").readFileSync(0, "utf8");
  const result = inspectTicket(content);
  process.stdout.write(JSON.stringify(result) + "\n");
  process.exit(result.safe ? 0 : 1);
}

module.exports = { inspectTicket };
