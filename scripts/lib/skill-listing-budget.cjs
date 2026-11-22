// Skill-listing size per runtime, and SKILL.md size, for scripts/check-always-on-budget.cjs.
//
// What each runtime lists is the name plus the description text it reads:
//   - Claude Code reads `description` and `when_to_use` as separate fields and truncates the
//     pair at 1,536 characters per entry (code.claude.com/docs/en/skills).
//   - Every other runtime has no `when_to_use` field. The adapters append it to `description` as
//     "<description> Use when: <when_to_use>" (crates/mewkit-adapters, projection/frontmatter.rs),
//     so the listing is name plus that text.
// Budgets are documented only for Claude Code (1% of the window) and Codex (2%); the other
// runtimes publish none, so they carry a ceiling that ratchets the current size and no budget.
// Token figures are an estimate of chars / 4, never a measurement.

const fs = require("node:fs");
const path = require("node:path");

const CLAUDE_ENTRY_CAP_CHARS = 1536;
const CHARS_PER_TOKEN = 4;
const RUNTIMES = ["claude-code", "codex", "cursor", "grok", "pi", "omp", "antigravity"];
const WINDOWS = [
	["200K", 200_000],
	["1M", 1_000_000],
];
/** Share of the context window the vendor documents for the listing, or null when none is. */
const DOCUMENTED_PERCENT = { "claude-code": 1, codex: 2 };

const chars = (value) => (typeof value === "string" ? [...value].length : 0);
const bytes = (value) => (typeof value === "string" ? Buffer.byteLength(value, "utf8") : 0);

/** The text a runtime lists after the name, for one skill's frontmatter values. */
function listedText(runtime, values) {
	const description = typeof values.description === "string" ? values.description : "";
	const whenToUse = typeof values.when_to_use === "string" ? values.when_to_use : "";
	if (runtime === "claude-code") {
		const pair = whenToUse ? `${description} ${whenToUse}` : description;
		return [...pair].slice(0, CLAUDE_ENTRY_CAP_CHARS).join("");
	}
	return whenToUse ? `${description} Use when: ${whenToUse}` : description;
}

/** Bytes of the listing a runtime builds from skill items (each item carries `values`). */
function listingBytes(runtime, skills) {
	return skills.reduce((total, item) => total + bytes(item.values.name) + bytes(listedText(runtime, item.values)), 0);
}

/** One SKILL.md per shipped skill: bytes, estimated tokens, largest first. */
function measureSkillFiles(root, skills) {
	return skills
		.map((item) => {
			const size = fs.statSync(path.join(root, item.rel)).size;
			return { id: item.id, rel: item.rel, bytes: size, tokens: Math.ceil(size / CHARS_PER_TOKEN) };
		})
		.sort((a, b) => b.bytes - a.bytes || a.id.localeCompare(b.id));
}

/** Documented budget in estimated characters for a window, or null where none is documented. */
function budgetChars(runtime, windowTokens) {
	const percent = DOCUMENTED_PERCENT[runtime];
	return percent == null ? null : Math.floor((windowTokens * percent) / 100) * CHARS_PER_TOKEN;
}

/**
 * Print the per-runtime listing sizes and SKILL.md sizes, and check them against `limits`
 * ({ listing: {runtime: bytes}, skillFilesTotal, largestSkillFile }).
 * @returns {boolean} true when a ceiling is breached
 */
function reportAndCheck(root, skills, limits) {
	let failed = false;
	console.log(`\nskill listing per runtime (bytes of name + listed description; tokens are an estimate, chars/4):`);
	for (const runtime of RUNTIMES) {
		const size = listingBytes(runtime, skills);
		const estimate = Math.ceil(size / CHARS_PER_TOKEN);
		const budgets = WINDOWS.map(([label, window]) => {
			const budget = budgetChars(runtime, window);
			return budget == null ? `${label}: budget unknown` : `${label}: budget ~${budget / CHARS_PER_TOKEN} tokens`;
		});
		const ceiling = limits.listing[runtime];
		console.log(
			`  ${runtime.padEnd(12)} ${String(size).padStart(6)} B  ~${estimate} tokens (est.)  ceiling ${ceiling}  ${budgets.join("; ")}`,
		);
		if (size > ceiling) {
			console.error(`FAIL: ${runtime} skill listing is ${size - ceiling} bytes over its ${ceiling}-byte ceiling (${size} B).`);
			failed = true;
		}
	}
	const files = measureSkillFiles(root, skills);
	const total = files.reduce((sum, file) => sum + file.bytes, 0);
	console.log(`\nSKILL.md size: ${files.length} files, ${total} B, ~${Math.ceil(total / CHARS_PER_TOKEN)} tokens (est., chars/4)`);
	console.log(`largest SKILL.md files (only the first 5,000 tokens of a skill return after compaction):`);
	for (const file of files.slice(0, 5)) {
		console.log(`  ${String(file.bytes).padStart(6)} B  ~${file.tokens} tokens (est.)\t${file.id}\t${file.rel}`);
	}
	if (total > limits.skillFilesTotal) {
		console.error(`FAIL: SKILL.md files total ${total - limits.skillFilesTotal} bytes over the ${limits.skillFilesTotal}-byte ceiling (${total} B).`);
		failed = true;
	}
	if (files[0] && files[0].bytes > limits.largestSkillFile) {
		console.error(`FAIL: ${files[0].rel} is ${files[0].bytes - limits.largestSkillFile} bytes over the ${limits.largestSkillFile}-byte ceiling (${files[0].bytes} B).`);
		failed = true;
	}
	return failed;
}

module.exports = {
	reportAndCheck,
	RUNTIMES,
	WINDOWS,
	CHARS_PER_TOKEN,
	chars,
	listedText,
	listingBytes,
	measureSkillFiles,
	budgetChars,
};
