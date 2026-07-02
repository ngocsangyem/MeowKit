import type { PortableItem, PortableType, ProviderType } from "./types.js";
import type { ReferenceOccurrence } from "./references/reference-types.js";
import { findRuntimeCouplingMatches } from "./runtime-coupling-patterns.js";

export interface RuntimeCompatAuditResult {
	errors: string[];
}

const AUDITED_TYPES = new Set<PortableType>(["agent", "command", "config", "rules", "hooks"]);

export function auditRuntimeCompatibility(
	content: string,
	item: Pick<PortableItem, "name" | "type">,
	targetProvider: ProviderType,
	occurrences: ReferenceOccurrence[] = [],
): RuntimeCompatAuditResult {
	if (targetProvider === "claude-code") return { errors: [] };
	if (!AUDITED_TYPES.has(item.type)) return { errors: [] };

	const errors: string[] = [];
	for (const match of findRuntimeCouplingMatches(content, occurrences)) {
		errors.push(`${item.type}/${item.name} ${match.message}`);
	}

	return { errors };
}
