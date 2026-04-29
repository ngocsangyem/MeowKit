// Vendored from claudekit-cli (MIT). Source: src/commands/portable/converters/gemini-hook-event-map.ts
import type { ProviderType } from "../types.js";

const GEMINI_EVENT_MAP: Record<string, string> = {
	PreToolUse: "BeforeTool",
	PostToolUse: "AfterTool",
	SubagentStart: "BeforeAgent",
	SubagentStop: "AfterAgent",
	Stop: "SessionEnd",
	Notification: "Notification",
	PreCompact: "PreCompress",
};

export const GEMINI_TOOL_NAME_MAP: Record<string, string> = {
	Read: "read_file",
	Glob: "glob",
	Grep: "grep_search",
	Edit: "replace",
	Write: "write_file",
	MultiEdit: "replace",
	Bash: "run_shell_command",
	WebFetch: "web_fetch",
	WebSearch: "google_web_search",
};

export function mapEventName(claudeEvent: string): string {
	return GEMINI_EVENT_MAP[claudeEvent] ?? claudeEvent;
}

export function rewriteMatcherToolNames(matcher: string): string {
	if (!matcher) return matcher;

	const parts = matcher.split("|").map((p) => p.trim());
	const mapped = new Set<string>();

	for (const part of parts) {
		const directMap = GEMINI_TOOL_NAME_MAP[part];
		if (directMap) mapped.add(directMap);
		else mapped.add(part);
	}

	return Array.from(mapped).join("|");
}

export function requiresHookMapping(provider: ProviderType): boolean {
	return provider === "gemini-cli";
}
