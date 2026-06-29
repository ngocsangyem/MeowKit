import fs from "node:fs";
import path from "node:path";
import type { Tracer } from "../application/ports.js";
import { scrubSecrets } from "./scan-patterns.js";

// Appends wiki trace events to .claude/memory/trace-log.jsonl. Re-implements the JSONL
// append + redaction because the only existing writer (commands/trace.ts recordFriction)
// is private and hardcodes event:"friction". Fixed line shape:
//   {schema_version:"1.0", ts, event, run_id, model, density, data:{...}}
// Every string value in `data` is secret-scrubbed before it is written.

function scrubDeep(value: unknown): unknown {
	if (typeof value === "string") return scrubSecrets(value);
	if (Array.isArray(value)) return value.map(scrubDeep);
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value)) out[k] = scrubDeep(v);
		return out;
	}
	return value;
}

export class TraceAdapter implements Tracer {
	constructor(private readonly claudeDir: string) {}

	recordWikiTrace(event: string, data: Record<string, unknown>): void {
		const line = {
			schema_version: "1.0",
			ts: new Date().toISOString(),
			event,
			run_id: process.env["MEOWKIT_RUN_ID"] ?? "",
			model: process.env["MEOWKIT_MODEL_HINT"] ?? "",
			density: process.env["MEOWKIT_AUTOBUILD_MODE"] ?? "",
			data: scrubDeep(data),
		};
		const logPath = path.join(this.claudeDir, "memory", "trace-log.jsonl");
		fs.mkdirSync(path.dirname(logPath), { recursive: true });
		fs.appendFileSync(logPath, JSON.stringify(line) + "\n", "utf-8");
	}
}
