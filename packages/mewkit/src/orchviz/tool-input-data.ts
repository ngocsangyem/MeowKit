/**
 * Structured tool-input extraction (per-tool rich payloads for the UI).
 *
 * Ported (in part) from patoles/agent-flow @ 59ccf4e
 *   Original: extension/src/tool-summarizer.ts (extractInputData function)
 *   License:  Apache-2.0 (see ../../NOTICE)
 *
 * Modifications: dropped Codex-only tools; meowkit only watches Claude Code.
 */

import { EDIT_CONTENT_MAX, WEB_FETCH_PROMPT_MAX } from "./constants.js";

export function extractInputData(
	toolName: string,
	input: Record<string, unknown>,
): Record<string, unknown> | undefined {
	if (!input) return undefined;
	try {
		switch (toolName) {
			case "Edit":
				return {
					file_path: String(input.file_path || ""),
					old_string: String(input.old_string || "").slice(0, EDIT_CONTENT_MAX),
					new_string: String(input.new_string || "").slice(0, EDIT_CONTENT_MAX),
				};
			case "TodoWrite":
				return { todos: input.todos };
			case "Write":
				return {
					file_path: String(input.file_path || ""),
					content: String(input.content || "").slice(0, EDIT_CONTENT_MAX),
				};
			case "Bash":
				return {
					command: String(input.command || ""),
					description: String(input.description || ""),
				};
			case "Read":
				return {
					file_path: String(input.file_path || input.path || ""),
					offset: typeof input.offset === "number" ? input.offset : undefined,
					limit: typeof input.limit === "number" ? input.limit : undefined,
				};
			case "Grep":
				return {
					pattern: String(input.pattern || ""),
					path: String(input.path || ""),
					glob: typeof input.glob === "string" ? input.glob : undefined,
				};
			case "Glob":
				return { pattern: String(input.pattern || ""), path: String(input.path || "") };
			case "WebSearch":
				return { query: String(input.query || "") };
			case "WebFetch":
				return {
					url: String(input.url || ""),
					prompt: String(input.prompt || "").slice(0, WEB_FETCH_PROMPT_MAX),
				};
			case "AskUserQuestion": {
				const qs = input.questions as
					| Array<{ question?: string; options?: Array<{ label?: string }> }>
					| undefined;
				return {
					questions: Array.isArray(qs)
						? qs.map((q) => ({
								question: String(q.question || ""),
								options: Array.isArray(q.options)
									? q.options.map((o) => String(o.label || ""))
									: [],
							}))
						: [],
				};
			}
			default:
				return undefined;
		}
	} catch {
		return undefined;
	}
}
