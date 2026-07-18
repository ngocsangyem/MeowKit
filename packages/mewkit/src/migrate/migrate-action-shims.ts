// Reconcile-action shims for the migrate orchestrator. Builds synthetic actions for
// skill directories, codex bulk installs, and maps portable types to provider keys.
import type { ReconcileAction } from "./reconcile/reconcile-types.js";
import type { PortableType, ProviderType, SkillInfo } from "./types.js";

export function skillActionShim(
	skill: SkillInfo,
	provider: ProviderType,
	global: boolean,
	path: string,
): ReconcileAction {
	return {
		action: "install",
		item: skill.name,
		type: "skill",
		provider,
		global,
		targetPath: path,
		reason: "Skill directory install",
		isDirectoryItem: true,
	};
}

export function codexBulkActionShim(
	type: "agent" | "hooks",
	provider: ProviderType,
	global: boolean,
	count: number,
): ReconcileAction {
	return {
		action: "install",
		item: `${count} ${type === "agent" ? "agent" : "hook"}${count === 1 ? "" : "s"}`,
		type,
		provider,
		global,
		targetPath: "",
		reason: `Specialized ${provider} ${type} install`,
	};
}

export function providerKey(type: PortableType): "agents" | "commands" | "skills" | "config" | "rules" | "hooks" {
	switch (type) {
		case "agent":
			return "agents";
		case "command":
			return "commands";
		case "skill":
			return "skills";
		case "config":
			return "config";
		case "rules":
			return "rules";
		case "hooks":
			return "hooks";
	}
}
