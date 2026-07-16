#!/usr/bin/env node
// Reports provider-specific vocabulary in canonical skill bodies. Baseline only:
// Phase 6 records migration work without blocking untouched directories.
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", ".claude", "skills");
const rules = [
	["host-tool", /\b(?:AskUserQuestion|Agent|Task)\b/g],
	["model", /\b(?:haiku|sonnet|opus|claude-[a-z0-9.-]+)\b/gi],
	["context-threshold", /\b\d{2,3}K\b/g],
];
const findings = [];
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
	if (!entry.isDirectory()) continue;
	const file = path.join(root, entry.name, "SKILL.md");
	if (!fs.existsSync(file)) continue;
	const body = fs.readFileSync(file, "utf8").replace(/^---\n[\s\S]*?\n---\n?/, "");
	for (const [kind, pattern] of rules) {
		for (const match of body.matchAll(pattern)) findings.push({ skill: `mk:${entry.name}`, kind, token: match[0] });
	}
}
console.log(JSON.stringify({ mode: "baseline", findings }, null, 2));
