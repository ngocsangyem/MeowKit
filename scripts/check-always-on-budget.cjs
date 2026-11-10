#!/usr/bin/env node
// Always-on context budget: what a session loads or lists BEFORE any skill runs must stay small.
//
// Two enforced ceilings, answered by one check with one extractor:
//   (i)  the always-on rules alone        — every `.md` under `<root>/.claude/rules/`   <= 25600 B
//   (ii) everything always listed         — those rules PLUS shipped skill/agent metadata <= 70000 B
// Keeping (i) live matters because a combined total alone would let rules grow while metadata
// paid for it, or let metadata grow while an always-on safety rule was cut.
//
// Metadata extraction is defined by this implementation, because three plausible extractors give
// three different totals: each ship-set file's frontmatter is YAML-parsed and `Buffer.byteLength`
// is taken over the SCALAR VALUES of `name` + `description` + `when_to_use` (skills) and
// `name` + `description` (agents) — never a line or regex match. The file set comes from
// `kit-ship-set.cjs`, not a glob of `.claude`, so budget and published kit cannot disagree.
//
// Usage: node scripts/check-always-on-budget.cjs [project-root]
//   exit 0  both comparisons pass
//   exit 1  either comparison is breached (the breached limit and the overage are printed)
//   exit 2  the rules directory, the ship set or a measured file is missing or unreadable

const fs = require("node:fs");
const path = require("node:path");
const { excludeMatcher, shipSetExclusions, shipSetFiles } = require("./kit-ship-set.cjs");

const LIMIT_RULES_BYTES = 25600;
const LIMIT_ALWAYS_LISTED_BYTES = 70000;

// Reference only, never a gate: the per-item figures the budget was sized from. Printed so a
// maintainer who has to find bytes knows what shape was assumed, and so a block that is far over
// its reference figure is visible without a second tool.
const REFERENCE_CAPS = { skill: 280, "skill (integration)": 150, agent: 250, "agent (integration)": 150 };

/** Frontmatter fields whose scalar values are always listed, per kind. */
const MEASURED_FIELDS = { skill: ["name", "description", "when_to_use"], agent: ["name", "description"] };

// Resolved against this script's own location so the check still works when it is pointed at a
// scratch copy of a tree that has no node_modules of its own.
let yaml;
try {
	const paths = ["../packages/mewkit/node_modules", "../node_modules"].map((p) => path.join(__dirname, p));
	yaml = require(require.resolve("js-yaml", { paths }));
} catch {
	console.error("check-always-on-budget: cannot resolve js-yaml — run `npm install`.");
	process.exit(2);
}

/** @returns {string[]} every `.md` file under dir, at any depth, sorted for stable output. */
function collectMarkdown(dir) {
	const found = [];
	const stack = [dir];
	while (stack.length > 0) {
		const current = stack.pop();
		for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
			const full = path.join(current, entry.name);
			if (entry.isDirectory()) stack.push(full);
			else if (entry.isFile() && entry.name.endsWith(".md")) found.push(full);
		}
	}
	return found.sort();
}

/** The integration family measured as one group: the two hubs, their leaves, and the sizer. */
function isIntegration(id) {
	return /^(mk:)?(jira|confluence)(-|$)/.test(id) || /^(mk:)?story-sizer$/.test(id);
}

/** @returns {object|null} parsed frontmatter, or null when the file carries none. */
function frontmatter(abs) {
	const text = fs.readFileSync(abs, "utf8");
	if (!text.startsWith("---")) return null;
	const end = text.indexOf("\n---", 3);
	if (end === -1) return null;
	const parsed = yaml.load(text.slice(3, end + 1));
	return parsed && typeof parsed === "object" ? parsed : null;
}

const scalarBytes = (value) =>
	typeof value === "string" || typeof value === "number" ? Buffer.byteLength(String(value), "utf8") : 0;

/**
 * Measure every always-listed metadata block in the ship set.
 * A `.md` under `.claude/agents/` with no frontmatter is not an agent (the index files) and is
 * excluded by the parse rather than by a name list that would need maintaining.
 */
function measureMetadata(root) {
	const items = [];
	const isExcluded = excludeMatcher(shipSetExclusions(root));
	for (const rel of shipSetFiles(root, isExcluded)) {
		const isSkill = rel.startsWith(".claude/skills/") && rel.endsWith("/SKILL.md");
		const isAgent = rel.startsWith(".claude/agents/") && rel.endsWith(".md");
		if (!isSkill && !isAgent) continue;
		const fm = frontmatter(path.join(root, rel));
		if (!fm) continue;
		const kind = isSkill ? "skill" : "agent";
		const fields = MEASURED_FIELDS[kind];
		const perField = {};
		for (const field of fields) perField[field] = scalarBytes(fm[field]);
		const id = String(fm.name ?? rel);
		const label = isIntegration(id) ? `${kind} (integration)` : kind;
		const bytes = fields.reduce((total, field) => total + perField[field], 0);
		items.push({ kind, label, id, rel, perField, bytes });
	}
	return items;
}

function sum(values) {
	return values.reduce((total, value) => total + value, 0);
}

function reportBreach(label, measured, limit) {
	console.error(`FAIL: ${label} are ${measured - limit} bytes over the ${limit}-byte budget (${measured} B).`);
}

function main(argv) {
	const root = path.resolve(argv[2] || process.cwd());
	const rulesDir = path.join(root, ".claude", "rules");

	let ruleFiles;
	let ruleSizes;
	let items;
	try {
		if (!fs.statSync(rulesDir).isDirectory()) {
			console.error(`check-always-on-budget: not a directory: ${rulesDir}`);
			return 2;
		}
		ruleFiles = collectMarkdown(rulesDir);
		ruleSizes = ruleFiles.map((file) => fs.statSync(file).size);
		items = measureMetadata(root);
	} catch (error) {
		console.error(`check-always-on-budget: cannot read ${root}: ${error.message}`);
		return 2;
	}

	const rulesTotal = sum(ruleSizes);
	const skills = items.filter((item) => item.kind === "skill");
	const agents = items.filter((item) => item.kind === "agent");
	const skillsTotal = sum(skills.map((item) => item.bytes));
	const agentsTotal = sum(agents.map((item) => item.bytes));
	const alwaysListed = rulesTotal + skillsTotal + agentsTotal;

	console.log(`always-on rules: ${ruleFiles.length} file(s) under ${rulesDir}`);
	ruleFiles.forEach((file, i) => console.log(`  ${ruleSizes[i]}\t${path.relative(root, file)}`));

	// Per-field subtotals are printed per kind so a future reader can reproduce the total without
	// guessing which extractor produced it, and can see that no byte was saved by dropping a field.
	const fieldLine = (group, field) => `${field}=${sum(group.map((item) => item.perField[field] ?? 0))}`;
	console.log(`\nsubtotals (bytes):`);
	console.log(`  rules          ${rulesTotal}\t(${ruleFiles.length} files, limit ${LIMIT_RULES_BYTES})`);
	console.log(
		`  skills         ${skillsTotal}\t(${skills.length} shipped SKILL.md; ` +
			MEASURED_FIELDS.skill.map((f) => fieldLine(skills, f)).join(", ") +
			")",
	);
	console.log(
		`  agents         ${agentsTotal}\t(${agents.length} shipped agents; ` +
			MEASURED_FIELDS.agent.map((f) => fieldLine(agents, f)).join(", ") +
			")",
	);

	console.log(`\nreference per-item figures (NOT enforced — sizing aid only):`);
	for (const [label, cap] of Object.entries(REFERENCE_CAPS)) {
		const group = items.filter((item) => item.label === label);
		const over = group.filter((item) => item.bytes > cap).length;
		console.log(`  ${label.padEnd(20)} ${cap} B\t${group.length} block(s), ${over} over the figure`);
	}

	console.log(`\nevery always-listed metadata block, descending by size:`);
	for (const item of [...items].sort((a, b) => b.bytes - a.bytes || a.id.localeCompare(b.id))) {
		console.log(`  ${String(item.bytes).padStart(5)}\t${item.label.padEnd(20)}\t${item.id}\t${item.rel}`);
	}

	console.log(
		`\nmeasured: rules ${rulesTotal} B (limit ${LIMIT_RULES_BYTES}), always-listed ${alwaysListed} B (limit ${LIMIT_ALWAYS_LISTED_BYTES})`,
	);

	let failed = false;
	if (rulesTotal > LIMIT_RULES_BYTES) {
		reportBreach("always-on rules", rulesTotal, LIMIT_RULES_BYTES);
		failed = true;
	}
	if (alwaysListed > LIMIT_ALWAYS_LISTED_BYTES) {
		reportBreach("always-listed rules plus metadata", alwaysListed, LIMIT_ALWAYS_LISTED_BYTES);
		const worst = [...items].sort((a, b) => b.bytes - a.bytes)[0];
		if (worst) console.error(`  largest block: ${worst.rel} — ${worst.id}, ${worst.bytes} B`);
		console.error(`  shorten the blocks at the top of the descending list above.`);
		failed = true;
	}
	if (failed) return 1;

	console.log(
		`OK: ${LIMIT_RULES_BYTES - rulesTotal} B of rules headroom, ${LIMIT_ALWAYS_LISTED_BYTES - alwaysListed} B of always-listed headroom.`,
	);
	return 0;
}

if (require.main === module) {
	process.exit(main(process.argv));
}

module.exports = { main, LIMIT_RULES_BYTES, LIMIT_ALWAYS_LISTED_BYTES, measureMetadata };
