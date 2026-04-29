// Vendored from claudekit-cli (MIT). Source: src/commands/portable/provider-registry.ts (helpers)
// Helpers split from the data table; the registry data lives in provider-registry.ts.

import { join } from "node:path";
import { providers } from "./provider-registry.js";
import type { ProviderConfig, ProviderType } from "./types.js";

type SupportType = "agents" | "commands" | "skills" | "config" | "rules" | "hooks";

export function getAllProviderTypes(): ProviderType[] {
	return Object.keys(providers) as ProviderType[];
}

export function getProviderConfig(type: ProviderType): ProviderConfig {
	return providers[type];
}

export async function detectInstalledProviders(): Promise<ProviderType[]> {
	const installed: ProviderType[] = [];
	for (const [type, config] of Object.entries(providers)) {
		if (await config.detect()) installed.push(type as ProviderType);
	}
	return installed;
}

export function getProvidersSupporting(type: SupportType): ProviderType[] {
	return (Object.entries(providers) as [ProviderType, ProviderConfig][])
		.filter(([, config]) => config[type] != null)
		.map(([name]) => name);
}

export function getPortableBasePath(
	provider: ProviderType,
	portableType: SupportType,
	options: { global: boolean },
): string | null {
	const pathConfig = providers[provider][portableType];
	if (!pathConfig) return null;
	return options.global ? pathConfig.globalPath : pathConfig.projectPath;
}

export function getPortableInstallPath(
	itemName: string,
	provider: ProviderType,
	portableType: SupportType,
	options: { global: boolean },
): string | null {
	const pathConfig = providers[provider][portableType];
	if (!pathConfig) return null;

	const basePath = getPortableBasePath(provider, portableType, options);
	if (!basePath) return null;

	const ws = pathConfig.writeStrategy;
	if (ws === "merge-single" || ws === "yaml-merge" || ws === "json-merge" || ws === "single-file") {
		return basePath;
	}

	return join(basePath, `${itemName}${pathConfig.fileExtension}`);
}

export interface ProviderPathCollision {
	path: string;
	portableType: SupportType;
	global: boolean;
	providers: ProviderType[];
}

export function detectProviderPathCollisions(
	selectedProviders: ProviderType[],
	options: { global: boolean },
): ProviderPathCollision[] {
	const portableTypes: SupportType[] = ["agents", "commands", "skills", "config", "rules", "hooks"];
	const collisions: ProviderPathCollision[] = [];

	for (const portableType of portableTypes) {
		const pathToProviders = new Map<string, ProviderType[]>();

		for (const provider of selectedProviders) {
			const pathConfig = providers[provider][portableType];
			if (!pathConfig) continue;

			const basePath = options.global ? pathConfig.globalPath : pathConfig.projectPath;
			if (!basePath) continue;

			const list = pathToProviders.get(basePath) ?? [];
			list.push(provider);
			pathToProviders.set(basePath, list);
		}

		for (const [path, providerList] of pathToProviders) {
			if (providerList.length > 1) {
				collisions.push({ path, portableType, global: options.global, providers: providerList });
			}
		}
	}

	return collisions;
}
