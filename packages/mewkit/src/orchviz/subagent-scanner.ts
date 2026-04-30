/**
 * SubagentScanner — periodic poll fallback wrapping `scanSubagentsDir`.
 * Split out of subagent-watcher.ts to keep that file under the 200-LOC cap.
 */

import { SCAN_INTERVAL_MS } from "./constants.js";
import type { TranscriptParser } from "./parser/index.js";
import { scanSubagentsDir, type SubagentWatcherDelegate } from "./subagent-watcher.js";

export class SubagentScanner {
	private rescanTimer: NodeJS.Timeout | null = null;
	constructor(
		private readonly delegate: SubagentWatcherDelegate,
		private readonly parser: TranscriptParser,
	) {}

	start(sessionId: string): void {
		scanSubagentsDir(this.delegate, this.parser, sessionId);
		this.rescanTimer = setInterval(
			() => scanSubagentsDir(this.delegate, this.parser, sessionId),
			SCAN_INTERVAL_MS * 3,
		);
		if (typeof this.rescanTimer.unref === "function") this.rescanTimer.unref();
	}

	stop(): void {
		if (this.rescanTimer) clearInterval(this.rescanTimer);
		this.rescanTimer = null;
	}
}
