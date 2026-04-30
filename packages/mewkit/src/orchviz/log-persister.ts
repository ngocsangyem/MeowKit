/**
 * LogPersister — async append-only markdown log of AgentEvents.
 *
 * close() returns a drain Promise so signal handlers can flush the queue
 * before exit (red-team Critical #3).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { AgentEvent } from "./protocol.js";
import { sanitizeEvent } from "./sanitize.js";

export class LogPersister {
	private writer: fs.WriteStream | null = null;
	private pending = 0;
	private resolveDrain: (() => void) | null = null;
	private closed = false;

	constructor(private readonly filePath: string) {
		const dir = path.dirname(filePath);
		try {
			fs.mkdirSync(dir, { recursive: true });
		} catch {
			// best-effort; failures surface on first write
		}
		this.writer = fs.createWriteStream(filePath, { flags: "a", encoding: "utf-8" });
		this.writer.on("error", () => {
			this.closed = true;
			this.writer = null;
		});
		this.writer.write(`\n## orchviz session started ${new Date().toISOString()}\n\n`);
	}

	get path(): string {
		return this.filePath;
	}

	append(event: AgentEvent): void {
		if (this.closed || !this.writer) return;
		const sanitized = sanitizeEvent(event);
		const ts = new Date().toISOString().slice(11, 23);
		const agent = (sanitized.payload?.agent as string | undefined) ?? "—";
		const summary = this.summarize(sanitized);
		const line = `- [${ts}] ${sanitized.type} ${agent}: ${summary}\n`;
		this.pending++;
		this.writer.write(line, () => {
			this.pending--;
			if (this.pending === 0 && this.resolveDrain) {
				const r = this.resolveDrain;
				this.resolveDrain = null;
				r();
			}
		});
	}

	private summarize(event: AgentEvent): string {
		const p = event.payload;
		if (!p) return "";
		if (typeof p.preview === "string") return p.preview.slice(0, 120);
		if (typeof p.content === "string") return p.content.slice(0, 120);
		if (typeof p.message === "string") return p.message.slice(0, 120);
		if (typeof p.tool === "string" && typeof p.args === "string") {
			return `${p.tool}: ${p.args}`.slice(0, 120);
		}
		try {
			return JSON.stringify(p).slice(0, 120);
		} catch {
			return "";
		}
	}

	async close(): Promise<void> {
		if (this.closed) return;
		this.closed = true;
		if (!this.writer) return;
		const writer = this.writer;
		this.writer = null;
		// Wait for pending writes.
		if (this.pending > 0) {
			await new Promise<void>((resolve) => {
				this.resolveDrain = resolve;
			});
		}
		await new Promise<void>((resolve) => {
			writer.end(() => resolve());
		});
	}
}

/** Sanitize a session id for use in a default log filename. */
export function sanitizeSessionIdForPath(sessionId: string): string {
	return sessionId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 16) || "session";
}
