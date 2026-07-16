#!/usr/bin/env node
/**
 * Reports candidate skill-to-skill edges from canonical SKILL.md bodies.
 * Known references default to peer; only reviewed runtime prerequisites become
 * dependency_edges with type requires.
 */
import fs from "node:fs";
import path from "node:path";
import { load as loadYaml } from "js-yaml";

const skillsRootArg = process.argv.slice(2).find((arg) => !arg.startsWith("-"));
const skillsRoot = path.resolve(skillsRootArg ?? ".claude/skills");
const verifyHighTraffic = process.argv.includes("--check-high-traffic");
const HIGH_TRAFFIC_SKILLS = new Set([
	"mk:cook",
	"mk:fix",
	"mk:plan-creator",
	"mk:workflow-orchestrator",
	"mk:jira",
	"mk:confluence",
	"mk:wiki",
	"mk:agent-browser",
]);
const markdownFiles = fs
	.readdirSync(skillsRoot, { withFileTypes: true })
	.filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
	.map((entry) => path.join(skillsRoot, entry.name, "SKILL.md"))
	.filter((file) => fs.existsSync(file));

const frontmatter = (body) => {
	const match = /^---\n([\s\S]*?)\n---/.exec(body);
	const parsed = match ? loadYaml(match[1]) : {};
	return parsed && typeof parsed === "object" ? parsed : {};
};
const records = markdownFiles.map((file) => {
	const body = fs.readFileSync(file, "utf8");
	const metadata = frontmatter(body);
	return { file, body, metadata, id: typeof metadata.name === "string" ? metadata.name : path.basename(path.dirname(file)) };
});
const ids = new Set(records.map(({ id }) => id));
const reviewed = [];
const candidates = [];
const ignored = [];

for (const { body, id: source, metadata } of records) {
	const bodyOnly = body.replace(/^---\n[\s\S]*?\n---\n?/, "");
	const declared = new Map(
		Array.isArray(metadata.dependency_edges)
			? metadata.dependency_edges
					.filter((edge) => edge && typeof edge === "object" && typeof edge.id === "string" && typeof edge.type === "string")
					.map((edge) => [edge.id, edge.type])
			: [],
	);
	for (const id of Array.isArray(metadata.depends_on) ? metadata.depends_on : []) {
		if (typeof id === "string") declared.set(id, "requires");
	}
	for (const target of new Set(bodyOnly.match(/\bmk:[a-z][a-z0-9-]*/g) ?? [])) {
		if (target === source) ignored.push({ source, target, reason: "self-reference" });
		else if (ids.has(target) && declared.has(target)) reviewed.push({ source, target, type: declared.get(target) });
		else if (ids.has(target)) candidates.push({ source, target, proposedType: "peer" });
		else ignored.push({ source, target, reason: "unknown-target" });
	}
}

const sortEdges = (a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target);
reviewed.sort(sortEdges);
candidates.sort(sortEdges);
const highTrafficCandidates = candidates.filter((edge) => HIGH_TRAFFIC_SKILLS.has(edge.source));
const report = {
	policy: "Known body references default to peer; only reviewed runtime prerequisites become requires.",
	reviewed,
	candidates,
	ignored,
};
console.log(JSON.stringify(report, null, 2));
if (verifyHighTraffic && highTrafficCandidates.length > 0) {
	console.error(`Unclassified high-traffic edges:\n${highTrafficCandidates.map((edge) => `${edge.source} -> ${edge.target}`).join("\n")}`);
	process.exitCode = 1;
}
