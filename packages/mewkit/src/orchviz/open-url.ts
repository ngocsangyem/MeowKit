/**
 * openURL — cross-platform browser launcher with no runtime deps.
 *
 * Ported from patoles/agent-flow @ 59ccf4e (app/src/server.ts).
 * License Apache-2.0 (see ../NOTICE).
 *
 * macOS/Linux use execFile (no shell). Windows requires `start` (shell builtin),
 * so we exec but ONLY with our own printed URL — never user input (RT2 #3).
 */

import { exec, execFile } from "node:child_process";

export function openURL(url: string, onError?: (err: Error) => void): void {
	const cb = (err: Error | null): void => {
		if (err && onError) onError(err);
	};
	if (process.platform === "darwin") {
		execFile("open", [url], cb);
	} else if (process.platform === "win32") {
		// `start` is a shell builtin; empty title arg is required to avoid
		// `start "URL"` being parsed as a window title.
		exec(`start "" "${url}"`, cb);
	} else {
		execFile("xdg-open", [url], cb);
	}
}
