// Helpers for reconcile-state-builders.ts: provider path resolution and target-checksum
// computation across the four write strategies (per-file, merge-single, yaml-merge, json-merge).
import { buildMergeSectionContent, getMergeSectionKey } from "../config-merger/merge-single-sections.js";
import { providers } from "../provider-registry.js";
import type { PortableItem, PortableType, ProviderType } from "../types.js";
import { computeContentChecksum } from "./checksum-utils.js";
import type { PortableInstallationV3 } from "./portable-registry.js";

export type ProviderPathKey = "agents" | "commands" | "skills" | "config" | "rules" | "hooks";

export function getProviderPathKeyForPortableType(type: PortableType): ProviderPathKey {
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

export function getProviderPathConfig(provider: ProviderType, type: PortableType) {
	return providers[provider]?.[getProviderPathKeyForPortableType(type)] ?? null;
}

export function usesMergeSingleChecksums(entry: PortableInstallationV3): boolean {
	const pathConfig = getProviderPathConfig(entry.provider as ProviderType, entry.type);
	return pathConfig?.writeStrategy === "merge-single";
}

export function buildTargetChecksum(
	item: PortableItem,
	type: PortableType,
	provider: ProviderType,
	convertedContent: string,
): string | undefined {
	const pathConfig = getProviderPathConfig(provider, type);
	if (!pathConfig) return computeContentChecksum(item.body);

	if (pathConfig.writeStrategy !== "merge-single") {
		return computeContentChecksum(convertedContent);
	}

	const sectionKind = type === "config" ? "config" : type === "rules" ? "rule" : type === "agent" ? "agent" : null;
	if (!sectionKind) return undefined;

	const sectionKey = getMergeSectionKey(sectionKind, item);
	return computeContentChecksum(buildMergeSectionContent(sectionKind, sectionKey, convertedContent));
}
