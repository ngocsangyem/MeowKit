import type { PortableItem, PortableType, ProviderType } from "./types.js";
import type { ReferenceOccurrence } from "./references/reference-types.js";
import { findRuntimeCouplingMatches } from "./runtime-coupling-patterns.js";

export interface RuntimeCompatAuditResult {
	errors: string[];
	warnings: string[];
}

const AUDITED_TYPES = new Set<PortableType>(["agent", "command", "config", "rules", "hooks"]);

export function auditRuntimeCompatibility(
	content: string,
	item: Pick<PortableItem, "name" | "type">,
	targetProvider: ProviderType,
	occurrences: ReferenceOccurrence[] = [],
): RuntimeCompatAuditResult {
	if (targetProvider === "claude-code") return { errors: [], warnings: [] };
	if (!AUDITED_TYPES.has(item.type)) return { errors: [], warnings: [] };

	const errors: string[] = [];
	const warnings: string[] = [];
	for (const match of findRuntimeCouplingMatches(content, occurrences)) {
		if ((item.type === "rules" || item.type === "config") && match.cls === "claude-env-var" && match.rewrite) {
			warnings.push(`${item.type}/${item.name} ${match.message} (${match.rewrite.annotation})`);
			continue;
		}
		errors.push(`${item.type}/${item.name} ${match.message}`);
	}

	return { errors, warnings };
}
