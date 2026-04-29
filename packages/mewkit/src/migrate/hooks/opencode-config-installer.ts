// Vendored from claudekit-cli (MIT). Source: src/commands/portable/opencode-config-installer.ts
// Adapted: dropped logger.warning calls (mewkit uses console).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import * as p from "@clack/prompts";
import { OPENCODE_DEFAULT_MODEL, getOpenCodeDefaultModelOverride } from "../model-taxonomy.js";

export interface EnsureOpenCodeModelResult {
	path: string;
	action: "added" | "existing" | "created" | "skipped";
	model: string;
	reason?: string;
}

export type OpenCodeModelPrompter = (ctx: {
	suggestion: string;
	reason: string;
	detectedProviders: string[];
}) => Promise<{ action: "accept" } | { action: "custom"; value: string } | { action: "skip" }>;

export interface EnsureOpenCodeModelOptions {
	global: boolean;
	interactive?: boolean;
	homeDir?: string;
	cwd?: string;
	prompter?: OpenCodeModelPrompter;
}

function getOpenCodeConfigPath(options: EnsureOpenCodeModelOptions): string {
	if (options.global) {
		return join(options.homeDir ?? homedir(), ".config", "opencode", "opencode.json");
	}
	return join(options.cwd ?? process.cwd(), "opencode.json");
}

async function detectAuthenticatedProviders(homeDir?: string): Promise<string[]> {
	const authPath = join(homeDir ?? homedir(), ".local", "share", "opencode", "auth.json");
	try {
		const raw = await readFile(authPath, "utf-8");
		const parsed = JSON.parse(raw) as unknown;
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return Object.keys(parsed as Record<string, unknown>);
		}
	} catch {
		// Missing or malformed auth.json — silently return empty.
	}
	return [];
}

export async function suggestOpenCodeDefaultModel(
	homeDir?: string,
): Promise<{ model: string; reason: string }> {
	const override = getOpenCodeDefaultModelOverride();
	if (override) return { model: override, reason: ".ck.json override" };
	void homeDir;
	return { model: OPENCODE_DEFAULT_MODEL, reason: "fallback default" };
}

const clackPrompter: OpenCodeModelPrompter = async ({ suggestion, reason, detectedProviders }) => {
	const providersHint =
		detectedProviders.length > 0
			? `Authenticated providers in opencode: ${detectedProviders.join(", ")}`
			: "No authenticated providers detected in opencode.";
	const response = await p.select({
		message: `No default model in opencode.json. ${providersHint}`,
		options: [
			{ value: "accept", label: `Write "${suggestion}"`, hint: reason },
			{ value: "custom", label: "Enter a different model..." },
			{ value: "skip", label: "Skip — I'll configure opencode.json myself" },
		],
		initialValue: "accept",
	});

	if (p.isCancel(response) || response === "skip") return { action: "skip" };
	if (response === "accept") return { action: "accept" };

	const custom = await p.text({
		message: "Model (format: provider/model-id, e.g. openai/gpt-5)",
		placeholder: suggestion,
		validate: (value) => {
			if (!value || !value.includes("/")) return "Must be in 'provider/model-id' format";
			return undefined;
		},
	});
	if (p.isCancel(custom)) return { action: "skip" };
	return { action: "custom", value: custom };
};

export async function ensureOpenCodeModel(
	options: EnsureOpenCodeModelOptions,
): Promise<EnsureOpenCodeModelResult> {
	const configPath = getOpenCodeConfigPath(options);

	let existing: Record<string, unknown> | null = null;
	try {
		const raw = await readFile(configPath, "utf-8");
		const parsed = JSON.parse(raw) as unknown;
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			existing = parsed as Record<string, unknown>;
		} else {
			console.warn(`ensureOpenCodeModel: ${configPath} is valid JSON but not an object; overwriting with default model`);
		}
	} catch (err) {
		const errno = (err as NodeJS.ErrnoException | null)?.code;
		if (errno === "ENOENT") {
			// Expected
		} else if (err instanceof SyntaxError) {
			console.warn(`ensureOpenCodeModel: ${configPath} is not valid JSON; overwriting (existing contents will be lost)`);
		}
	}

	if (existing && typeof existing.model === "string" && existing.model.trim().length > 0) {
		return { path: configPath, action: "existing", model: existing.model };
	}

	const suggestion = await suggestOpenCodeDefaultModel(options.homeDir);
	let chosenModel = suggestion.model;

	if (options.interactive) {
		const detectedProviders = await detectAuthenticatedProviders(options.homeDir);
		const prompter = options.prompter ?? clackPrompter;
		const response = await prompter({
			suggestion: suggestion.model,
			reason: suggestion.reason,
			detectedProviders,
		});

		if (response.action === "skip") {
			return { path: configPath, action: "skipped", model: "", reason: "user declined" };
		}
		if (response.action === "custom") chosenModel = response.value;
	}

	const next = { ...(existing ?? {}), model: chosenModel };
	await mkdir(dirname(configPath), { recursive: true });
	await writeFile(configPath, `${JSON.stringify(next, null, 2)}\n`, "utf-8");

	return {
		path: configPath,
		action: existing ? "added" : "created",
		model: chosenModel,
		reason: suggestion.reason,
	};
}
