/**
 * Cross-platform browser launcher with no runtime deps.
 *
 * Ported from patoles/agent-flow @ 59ccf4e (app/src/server.ts).
 * License Apache-2.0 — see the repository NOTICE file.
 *
 * macOS/Linux use execFile (no shell). Windows requires `start` (a shell
 * builtin), so it execs a shell — but ONLY with our own URL, never user input.
 */

import { exec, execFile } from "node:child_process";

/** Open `url` in the platform default browser. `onError` receives any launch error. */
export function openBrowser(url: string, onError?: (err: Error) => void): void {
	const cb = (err: Error | null): void => {
		if (err && onError) onError(err);
	};
	if (process.platform === "darwin") {
		execFile("open", [url], cb);
	} else if (process.platform === "win32") {
		// `start` is a shell builtin; the empty title arg stops `start "URL"`
		// from being parsed as a window title.
		exec(`start "" "${url}"`, cb);
	} else {
		execFile("xdg-open", [url], cb);
	}
}
