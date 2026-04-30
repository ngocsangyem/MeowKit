/**
 * File-system tail helpers for JSONL transcript watching.
 *
 * Ported from patoles/agent-flow @ 59ccf4e
 *   Original: extension/src/fs-utils.ts
 *   License:  Apache-2.0 (see ../../NOTICE)
 *
 * Modifications: switched to `node:fs` import; otherwise verbatim.
 */

import * as fs from "node:fs";

export function readFileChunk(filePath: string, offset: number, length: number): string {
	const fd = fs.openSync(filePath, "r");
	try {
		const buffer = Buffer.alloc(length);
		fs.readSync(fd, buffer, 0, length, offset);
		return buffer.toString("utf-8");
	} finally {
		fs.closeSync(fd);
	}
}

export interface ReadNewLinesResult {
	lines: string[];
	newSize: number;
	tail: string;
}

/**
 * Read new lines appended since `lastSize` bytes.
 * `lastTail` is any partial trailing line returned by the previous call —
 * pass it back to reassemble lines split across reads.
 * Returns null when the file is gone or unchanged.
 * On truncation (file shrunk), returns { lines: [], newSize: 0, tail: '' }.
 */
export function readNewFileLines(
	filePath: string,
	lastSize: number,
	lastTail = "",
): ReadNewLinesResult | null {
	let stat: fs.Stats;
	try {
		stat = fs.statSync(filePath);
	} catch {
		return null;
	}

	if (stat.size < lastSize) {
		return { lines: [], newSize: 0, tail: "" };
	}
	if (stat.size <= lastSize) {
		return null;
	}

	const newContent = lastTail + readFileChunk(filePath, lastSize, stat.size - lastSize);
	const parts = newContent.split(/\r?\n/);
	const tail = parts.pop() ?? "";
	const lines = parts.filter(Boolean);
	return { lines, newSize: stat.size, tail };
}
