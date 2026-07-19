import type { Tracer } from "../application/ports.js";
import { appendTraceRecordSync } from "../../core/trace-append.js";

// Wiki trace events flow through the ONE shared trace-append primitive (core/trace-append.ts),
// which owns the JSONL line shape, secret scrubbing, rotation, and the shared sidecar lock. This
// adapter no longer re-implements any of that — it only names the event and passes the data.

export class TraceAdapter implements Tracer {
	constructor(private readonly claudeDir: string) {}

	recordWikiTrace(event: string, data: Record<string, unknown>): void {
		appendTraceRecordSync(this.claudeDir, { event, data });
	}
}
