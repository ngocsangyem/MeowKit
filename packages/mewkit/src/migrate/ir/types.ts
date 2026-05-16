import type { PortableItem, PortableType, SkillInfo } from "../types.js";

export type RuleSemanticKind = "policy" | "procedure" | "orchestration" | "runtime-automation" | "memory-policy";

export interface InstructionPolicy {
	id: string;
	sourcePath: string;
	body: string;
	scope: PortableType | "repo";
}

export interface ScopedRule {
	id: string;
	name: string;
	sourcePath: string;
	body: string;
	kind: RuleSemanticKind;
}

export interface WorkflowProcedure {
	id: string;
	sourcePath: string;
	body: string;
}

export interface AgentRole {
	id: string;
	item: PortableItem;
}

export interface SkillPackage {
	id: string;
	skill: SkillInfo;
}

export interface HookAutomation {
	id: string;
	item: PortableItem;
}

export interface RuntimeMemoryContract {
	id: string;
	sourcePath: string;
	body: string;
}

export interface CommandShortcut {
	id: string;
	item: PortableItem;
}

export interface MigrationSemanticGraph {
	instructionPolicies: InstructionPolicy[];
	scopedRules: ScopedRule[];
	workflowProcedures: WorkflowProcedure[];
	agentRoles: AgentRole[];
	skillPackages: SkillPackage[];
	hookAutomations: HookAutomation[];
	runtimeMemoryContracts: RuntimeMemoryContract[];
	commandShortcuts: CommandShortcut[];
}
