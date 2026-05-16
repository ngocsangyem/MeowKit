import type { PortableItem, SkillInfo } from "../types.js";
import { classifyRuleSemantic } from "./rule-classifier.js";
import type { MigrationSemanticGraph } from "./types.js";

export interface DiscoveredPortableSource {
	agents: PortableItem[];
	commands: PortableItem[];
	skills: SkillInfo[];
	config: PortableItem[];
	rules: PortableItem[];
	hooks: PortableItem[];
}

export function liftDiscoveredSourceToIr(source: DiscoveredPortableSource): MigrationSemanticGraph {
	return {
		instructionPolicies: source.config.map((item) => ({
			id: `config:${item.name}`,
			sourcePath: item.sourcePath,
			body: item.body,
			scope: "repo",
		})),
		scopedRules: source.rules.map((item) => ({
			id: `rule:${item.name}`,
			name: item.name,
			sourcePath: item.sourcePath,
			body: item.body,
			kind: classifyRuleSemantic(item).kind,
		})),
		workflowProcedures: source.rules
			.filter((item) => classifyRuleSemantic(item).kind === "procedure")
			.map((item) => ({
				id: `workflow:${item.name}`,
				sourcePath: item.sourcePath,
				body: item.body,
			})),
		agentRoles: source.agents.map((item) => ({ id: `agent:${item.name}`, item })),
		skillPackages: source.skills.map((skill) => ({ id: `skill:${skill.id}`, skill })),
		hookAutomations: source.hooks.map((item) => ({ id: `hook:${item.name}`, item })),
		runtimeMemoryContracts: source.rules
			.filter((item) => classifyRuleSemantic(item).kind === "memory-policy")
			.map((item) => ({
				id: `memory:${item.name}`,
				sourcePath: item.sourcePath,
				body: item.body,
			})),
		commandShortcuts: source.commands.map((item) => ({ id: `command:${item.name}`, item })),
	};
}
