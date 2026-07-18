import fs from "node:fs";
import path from "node:path";
import { checkStaleIndex } from "./check-stale-index.js";
import { buildInventory, enumerateArtifacts, readFrontmatter } from "./build-inventory.js";
import { resolveModel } from "../migrate/model-taxonomy.js";
import type { CheckResult } from "../commands/validate.js";

const STATUS_REFERENCE = "End with the A1 status block exactly as defined in `.claude/rules/agent-conduct.md` (A1).";
const VIEW_START = "<!-- GENERATED:agent-views START -->";
const VIEW_END = "<!-- GENERATED:agent-views END -->";
const HOST_TOOLS = new Set([
	"Read",
	"Grep",
	"Glob",
	"Bash",
	"Write",
	"Edit",
	"Task",
	"AskUserQuestion",
	"WebFetch",
	"WebSearch",
	"TaskCreate",
	"TaskGet",
	"TaskUpdate",
	"TaskList",
	"SendMessage",
	"Task(Explore)",
]);

interface AgentSource {
	path: string;
	body: string;
	tools: Set<string>;
	artifacts: string[];
}

function sourceForAgents(claudeDir: string, ownershipByPath: Map<string, string[]>): AgentSource[] {
	return enumerateArtifacts(claudeDir)
		.refs.filter((ref) => ref.type === "agent")
		.map((ref) => {
			const body = fs.readFileSync(ref.abs, "utf-8");
			const tools = new Set(
				String(readFrontmatter(ref.abs).tools ?? "")
					.split(",")
					.map((tool) => tool.trim())
					.filter(Boolean),
			);
			return { path: ref.rel, body, tools, artifacts: ownershipByPath.get(ref.rel) ?? [] };
		});
}

function fail(name: string, detail: string): CheckResult {
	return { name, status: "fail", detail, section: "Agents" };
}

function warn(name: string, detail: string): CheckResult {
	return { name, status: "warn", detail, section: "Agents" };
}

/**
 * Verdict patterns use the complete suffix segment as their identity. Other
 * one-star patterns intersect when their fixed prefixes and suffixes are
 * compatible.
 */
export function artifactPatternsOverlap(left: string, right: string): boolean {
	const verdict = /^tasks\/reviews\/\*-(?:evalverdict|security-verdict|verdict)\.md$/;
	if (verdict.test(left) && verdict.test(right)) return left === right;
	const split = (pattern: string) => {
		const star = pattern.indexOf("*");
		return star < 0 ? null : { prefix: pattern.slice(0, star), suffix: pattern.slice(star + 1) };
	};
	const a = split(left),
		b = split(right);
	if (!a || !b) return left === right;
	return (
		(a.prefix.startsWith(b.prefix) || b.prefix.startsWith(a.prefix)) &&
		(a.suffix.endsWith(b.suffix) || b.suffix.endsWith(a.suffix))
	);
}

function modelIsResolvable(model: string): boolean {
	return model === "inherit" || !resolveModel(model, "claude-code").warning?.startsWith("Unknown model");
}

export function renderAgentViewCounts(claudeDir: string): string {
	const agents = buildInventory(claudeDir).entries.filter((entry) => entry.type === "agent");
	const count = (agentClass: string, routing: string) =>
		agents.filter((entry) => entry.agentClass === agentClass && entry.routing === routing).length;
	return `${VIEW_START}\n**Agent registry views (generated):** ${count("core-support", "direct-only")} core/support direct-only; ${count("domain", "hub-only")} domain hub-only; ${count("intelligence", "direct-only")} intelligence direct-only; ${count("internal", "harness")} internal harness.\n${VIEW_END}`;
}

/**
 * Verifies declared agent contracts only. It cannot enforce host tool calls or
 * path-scoped writes at runtime because the host exposes neither boundary.
 */
export function checkAgentConformance(repoRoot: string): CheckResult[] {
	const claudeDir = path.join(repoRoot, ".claude");
	const inventory = buildInventory(claudeDir);
	const agents = sourceForAgents(
		claudeDir,
		new Map(
			inventory.entries
				.filter((entry) => entry.type === "agent")
				.map((entry) => [entry.path, entry.ownedArtifacts ?? []]),
		),
	);
	const results: CheckResult[] = [];
	const knownTools = new Set([...HOST_TOOLS, ...inventory.entries.flatMap((entry) => entry.tools ?? [])]);

	for (const agent of agents) {
		for (const line of agent.body.split("\n")) {
			if (/disallow|never use|do not use|without .*tool/i.test(line)) continue;
			for (const token of line.matchAll(/`([A-Za-z][A-Za-z0-9]*(?:\([^`]+\))?)`/g)) {
				const tool = token[1];
				if (knownTools.has(tool) && !agent.tools.has(tool)) {
					results.push(
						fail(`Agent tools: ${agent.path}`, `body instructs \`${tool}\` but frontmatter does not grant it`),
					);
				}
			}
		}
		if ((agent.tools.has("Write") || agent.tools.has("Edit")) && agent.artifacts.length === 0) {
			results.push(fail(`Agent ownership: ${agent.path}`, "Write/Edit granted with no declared owned artifact"));
		}
		if (/\bend\b[^\n]*\bstatus block\b/i.test(agent.body) && !agent.body.includes(STATUS_REFERENCE)) {
			results.push(
				fail(
					`Agent status reference: ${agent.path}`,
					"status-block instruction does not use the canonical A1 reference",
				),
			);
		}
	}

	const writers = agents.filter((agent) => agent.tools.has("Write") || agent.tools.has("Edit"));
	for (let i = 0; i < writers.length; i += 1) {
		for (let j = i + 1; j < writers.length; j += 1) {
			for (const left of writers[i].artifacts.filter((value) => value.includes("*"))) {
				for (const right of writers[j].artifacts.filter((value) => value.includes("*"))) {
					if (artifactPatternsOverlap(left, right))
						results.push(
							fail("Agent ownership overlap", `${writers[i].path} ${left} overlaps ${writers[j].path} ${right}`),
						);
				}
			}
		}
	}

	for (const entry of inventory.entries.filter((item) => item.type === "agent" && item.agentClass === "core-support")) {
		if (!entry.triggerOwner) {
			results.push(
				fail(
					`Agent trigger boundary: ${entry.path}`,
					"core/support agent needs trigger owner and negative boundary in description",
				),
			);
		}
	}

	const routingPath = path.join(claudeDir, "rules", "agent-routing.md");
	const routing = fs.existsSync(routingPath) ? fs.readFileSync(routingPath, "utf-8") : "";
	if (!routing) results.push(fail("Agent routing index", "Missing .claude/rules/agent-routing.md"));
	for (const entry of inventory.entries.filter((item) => item.type === "agent" && item.routing === "hub-only")) {
		if (!routing.includes(entry.id))
			results.push(warn(`Agent hub route: ${entry.path}`, "hub leaf is not listed in the prose routing table"));
	}
	for (const entry of inventory.entries.filter((item) => item.type === "agent")) {
		if (!modelIsResolvable(entry.model ?? ""))
			results.push(fail(`Agent model: ${entry.path}`, `model "${entry.model}" is not in the taxonomy`));
	}

	if (results.length === 0) {
		results.push({
			name: "Agent conformance",
			status: "pass",
			detail: "Declared contracts are consistent; this is not runtime tool or path enforcement",
			section: "Agents",
		});
	}
	const agentsIndexPath = path.join(claudeDir, "agents", "AGENTS_INDEX.md");
	if (!fs.existsSync(agentsIndexPath)) {
		results.push(fail("Agent registry views", "Missing .claude/agents/AGENTS_INDEX.md"));
	} else {
		const agentsIndex = fs.readFileSync(agentsIndexPath, "utf-8");
		const generatedView = renderAgentViewCounts(claudeDir);
		const viewRegion = new RegExp(`${VIEW_START}[\\s\\S]*?${VIEW_END}`).exec(agentsIndex)?.[0];
		if (viewRegion !== generatedView)
			results.push(fail("Agent registry views", "AGENTS_INDEX generated view counts are missing or stale"));
	}
	results.push(...checkStaleIndex(repoRoot));
	return results;
}
