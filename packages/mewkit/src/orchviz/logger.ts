/**
 * Tiny stderr logger with per-instance verbose toggle and secret scrubbing.
 * Replaces agent-flow's VS Code-bound logger.
 */

import { scrubSecrets } from "./redact.js";

export interface Logger {
	debug(...args: unknown[]): void;
	info(...args: unknown[]): void;
	warn(...args: unknown[]): void;
	error(...args: unknown[]): void;
}

let globalVerbose = process.env.MEOWKIT_ORCHVIZ_VERBOSE === "1";

export function setVerbose(v: boolean): void {
	globalVerbose = v;
}

function fmt(parts: unknown[]): string {
	return parts
		.map((p) => {
			if (typeof p === "string") return p;
			if (p instanceof Error) return p.stack ?? p.message;
			try {
				return JSON.stringify(p);
			} catch {
				return String(p);
			}
		})
		.join(" ");
}

export function createLogger(name: string): Logger {
	const tag = `[${name}]`;
	return {
		debug(...args) {
			if (!globalVerbose) return;
			process.stderr.write(`${tag} ${scrubSecrets(fmt(args))}\n`);
		},
		info(...args) {
			if (!globalVerbose) return;
			process.stderr.write(`${tag} ${scrubSecrets(fmt(args))}\n`);
		},
		warn(...args) {
			process.stderr.write(`${tag} ${scrubSecrets(fmt(args))}\n`);
		},
		error(...args) {
			process.stderr.write(`${tag} ${scrubSecrets(fmt(args))}\n`);
		},
	};
}
