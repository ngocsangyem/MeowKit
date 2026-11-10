#!/usr/bin/env node
/**
 * Rewrite references a skill makes to its own directory so the skill no longer names `.claude/`.
 *
 *   node scripts/rewrite-own-skill-paths.cjs [--check] [projectRoot]
 *
 * In the markdown of `.claude/skills/<s>/` (frontmatter excluded), `.claude/skills/<s>/<rest>`
 * becomes:
 *   - in SKILL.md, `${CLAUDE_SKILL_DIR}/<rest>` where a shell runs it: inside a fenced code block,
 *     or after a command word on the line. A shell resolves paths from its working directory, not
 *     from the skill, and Claude Code substitutes `${CLAUDE_SKILL_DIR}` with the skill's directory.
 *   - `<rest>` everywhere else: a path relative to the skill root, as the Agent Skills format
 *     specifies. Claude Code substitutes `${CLAUDE_SKILL_DIR}` only in SKILL.md: a reference file
 *     the agent reads keeps the literal text, and the shell does not export the variable (verified
 *     against Claude Code 2.1.316). So any `${CLAUDE_SKILL_DIR}/` in another file is made relative
 *     too, and a skill whose other files run their own scripts gets an anchor line in SKILL.md
 *     that names the substituted directory.
 * A leading `${CLAUDE_PROJECT_DIR}/`, `$CLAUDE_PROJECT_DIR/` or `./` is absorbed. Lines containing
 * `portable-ignore` are left alone. Re-running is a no-op; `--check` exits 1 if anything would change.
 */

const fs = require("fs");
const path = require("path");

const COMMAND_BEFORE =
	/(?:^|[\s`(|;&])(?:node|python3?|bash|sh|zsh|npx|uv run|source|chmod(?: \+x)?|cat|ls|cd|cp|test -[fdx]|\.venv\/bin\/python3|skill-python\.cjs)\s+(?:\S+\s+)*["']?$/;
const FENCE = /^\s*(```|~~~)/;

function ownRef(skill) {
	const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`(?:\\$\\{CLAUDE_PROJECT_DIR\\}/|\\$CLAUDE_PROJECT_DIR/|\\./)?\\.claude/skills/${escaped}/`, "g");
}

const SKILL_DIR_PREFIX = /\$\{CLAUDE_SKILL_DIR\}\//g;

/** Tells the agent where the relative script paths of the skill's other files resolve. */
const ANCHOR =
	"> Script paths in this skill's other files (references, steps) are relative to this skill's directory, " +
	"`${CLAUDE_SKILL_DIR}`. Prefix them with `${CLAUDE_SKILL_DIR}/` before running them; do not run them from the project root.";

/** Rewrite one line; `inFence` says whether it sits inside a fenced code block. */
function rewriteLine(line, skill, inFence, skillMd) {
	if (line.includes("portable-ignore")) return line;
	const out = line.replace(ownRef(skill), (match, offset) => {
		const runs = inFence || COMMAND_BEFORE.test(line.slice(0, offset));
		return runs && skillMd ? "${CLAUDE_SKILL_DIR}/" : "";
	});
	return skillMd ? out : out.replace(SKILL_DIR_PREFIX, "");
}

/** `skillMd: false` for any file other than SKILL.md, where the variable is never substituted. */
function rewriteText(text, skill, { skillMd = true } = {}) {
	const lines = text.split("\n");
	let i = 0;
	if (lines[0] === "---") {
		const end = lines.indexOf("---", 1);
		if (end > 0) i = end + 1;
	}
	let inFence = false;
	for (; i < lines.length; i++) {
		if (FENCE.test(lines[i])) {
			inFence = !inFence;
			continue;
		}
		lines[i] = rewriteLine(lines[i], skill, inFence, skillMd);
	}
	return lines.join("\n");
}

/** Whether a non-SKILL.md file runs one of the skill's own paths from a shell. */
function runsOwnPath(text, skill) {
	return rewriteText(text, skill).includes("${CLAUDE_SKILL_DIR}");
}

/** SKILL.md with the anchor after its first heading (or frontmatter), unless it already names the variable. */
function withAnchor(text) {
	if (text.includes("${CLAUDE_SKILL_DIR}")) return text;
	const lines = text.split("\n");
	let at = 0;
	if (lines[0] === "---") at = lines.indexOf("---", 1) + 1;
	const heading = lines.findIndex((l, i) => i >= at && /^# /.test(l));
	if (heading >= 0) at = heading + 1;
	lines.splice(at, 0, "", ANCHOR);
	return lines.join("\n");
}

function skillMarkdown(skillsDir) {
	const out = [];
	for (const skill of fs.readdirSync(skillsDir)) {
		const dir = path.join(skillsDir, skill);
		if (!fs.statSync(dir).isDirectory()) continue;
		const walk = (abs) => {
			for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
				if (["node_modules", ".venv", "__pycache__"].includes(entry.name)) continue;
				const full = path.join(abs, entry.name);
				if (entry.isDirectory()) walk(full);
				else if (entry.isFile() && entry.name.endsWith(".md")) out.push({ skill, file: full });
			}
		};
		walk(dir);
	}
	return out;
}

function rewriteOwnSkillPaths(root, { write }) {
	const changed = new Set();
	const needsAnchor = new Set();
	const save = (file, before, after) => {
		if (after === before) return;
		changed.add(path.relative(root, file));
		if (write) fs.writeFileSync(file, after, "utf8");
	};
	for (const { skill, file } of skillMarkdown(path.join(root, ".claude", "skills"))) {
		const skillMd = path.basename(file) === "SKILL.md" && path.dirname(file).endsWith(path.join("skills", skill));
		const before = fs.readFileSync(file, "utf8");
		if (!skillMd && runsOwnPath(before, skill)) needsAnchor.add(skill);
		save(file, before, rewriteText(before, skill, { skillMd }));
	}
	for (const skill of needsAnchor) {
		const file = path.join(root, ".claude", "skills", skill, "SKILL.md");
		if (!fs.existsSync(file)) continue;
		// In check mode the file is unchanged on disk, so anchor the rewritten text it would hold.
		const before = fs.readFileSync(file, "utf8");
		save(file, before, withAnchor(rewriteText(before, skill)));
	}
	return [...changed];
}

module.exports = { ANCHOR, rewriteText, rewriteOwnSkillPaths, withAnchor };

if (require.main === module) {
	const args = process.argv.slice(2);
	const check = args.includes("--check");
	const root = path.resolve(args.find((a) => !a.startsWith("--")) || path.join(__dirname, ".."));
	const changed = rewriteOwnSkillPaths(root, { write: !check });
	if (check) {
		for (const file of changed) console.error(`would rewrite: ${file}`);
		process.exit(changed.length > 0 ? 1 : 0);
	}
	console.log(`Rewrote own-skill paths in ${changed.length} file(s).`);
}
