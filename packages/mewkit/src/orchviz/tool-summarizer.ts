/**
 * Tool input/result summarization for Claude Code tool blocks.
 *
 * Ported (in part) from patoles/agent-flow @ 59ccf4e
 *   Original: extension/src/tool-summarizer.ts
 *   License:  Apache-2.0 (see ../../NOTICE)
 *
 * Modifications: dropped Codex-only tools (exec_command, write_stdin,
 * update_plan, apply_patch) — meowkit only watches Claude Code sessions.
 */

import {
	ARGS_MAX,
	RESULT_MAX,
	TASK_MAX,
	SKILL_NAME_MAX,
	URL_PATH_MAX,
	DISCOVERY_LABEL_MAX,
	DISCOVERY_LABEL_TAIL,
	DISCOVERY_CONTENT_MAX,
	FILE_TOOLS,
	PATTERN_TOOLS,
} from "./constants.js";

export { extractInputData } from "./tool-input-data.js";

function tailPath(filePath: string, segments = 2): string {
	return String(filePath).split("/").slice(-segments).join("/");
}

export function summarizeInput(toolName: string, input?: Record<string, unknown>): string {
	if (!input) return "";
	switch (toolName) {
		case "Bash":
			return String(input.command || "").slice(0, ARGS_MAX);
		case "Read":
			return tailPath(String(input.file_path || input.path || ""));
		case "Edit":
			return tailPath(String(input.file_path || "")) + " — edit";
		case "Write":
			return tailPath(String(input.file_path || "")) + " — write";
		case "Glob":
		case "Grep":
			return String(input.pattern || "");
		case "Task":
		case "Agent":
			return String(input.description || input.prompt || "").slice(0, TASK_MAX);
		case "TodoWrite": {
			const todos = input.todos as
				| Array<{ content?: string; activeForm?: string; status?: string }>
				| undefined;
			if (Array.isArray(todos) && todos.length > 0) {
				const active = todos.find((t) => t.status === "in_progress");
				const label = active?.activeForm || active?.content || todos[0]?.content || "todos";
				const done = todos.filter((t) => t.status === "completed").length;
				return `${label} (${done}/${todos.length})`.slice(0, ARGS_MAX);
			}
			return "updating todos";
		}
		case "WebSearch":
			return String(input.query || "").slice(0, ARGS_MAX);
		case "WebFetch": {
			const url = String(input.url || "");
			try {
				const u = new URL(url);
				return u.hostname + u.pathname.slice(0, URL_PATH_MAX);
			} catch {
				return url.slice(0, ARGS_MAX);
			}
		}
		case "AskUserQuestion": {
			const questions = input.questions as Array<{ question?: string }> | undefined;
			if (Array.isArray(questions) && questions[0]?.question) {
				return String(questions[0].question).slice(0, ARGS_MAX);
			}
			return "asking user...";
		}
		case "Skill":
			return String(input.skill || "").slice(0, SKILL_NAME_MAX);
		case "NotebookEdit":
			return tailPath(String(input.notebook_path || "")) + ` cell ${input.cell_number ?? "?"}`;
		default:
			return JSON.stringify(input).slice(0, ARGS_MAX);
	}
}

export function summarizeResult(content: unknown): string {
	if (typeof content === "string") return content.slice(0, RESULT_MAX);
	if (Array.isArray(content)) {
		return content
			.map((c) => {
				if (typeof c === "string") return c;
				if (c && typeof c === "object" && "text" in c) return String((c as { text?: unknown }).text);
				return "";
			})
			.join("\n")
			.slice(0, RESULT_MAX);
	}
	if (content && typeof content === "object") {
		const obj = content as { content?: unknown; text?: unknown };
		if (typeof obj.content === "string") return obj.content.slice(0, RESULT_MAX);
		if (typeof obj.text === "string") return obj.text.slice(0, RESULT_MAX);
		try {
			return JSON.stringify(content).slice(0, RESULT_MAX);
		} catch {
			/* fall through */
		}
	}
	return String(content || "").slice(0, RESULT_MAX);
}

export function buildDiscovery(
	toolName: string,
	filePath: string | undefined,
	result: string,
): Record<string, string> | undefined {
	if (!(FILE_TOOLS as readonly string[]).includes(toolName) || !filePath) return undefined;
	return {
		type: (PATTERN_TOOLS as readonly string[]).includes(toolName) ? "pattern" : "file",
		label:
			filePath.length > DISCOVERY_LABEL_MAX
				? "..." + filePath.slice(-DISCOVERY_LABEL_TAIL)
				: filePath,
		content: result.slice(0, DISCOVERY_CONTENT_MAX),
	};
}

export function detectError(content: string): boolean {
	const lower = content.toLowerCase();
	const patterns = [
		"error:",
		"error[",
		"exception:",
		"failed",
		"permission denied",
		"command failed",
		"cannot find",
		"not found",
		"enoent",
		"fatal:",
		"panic:",
		"segfault",
		"syntax error",
	];
	return patterns.some((p) => lower.includes(p));
}
