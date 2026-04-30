/**
 * Discover active Claude Code session JSONL files for a workspace.
 *
 * Strategy ported from patoles/agent-flow @ 59ccf4e (scripts/relay.ts
 * scanForActiveSessions). License Apache-2.0 (see ../../NOTICE).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { ACTIVE_SESSION_AGE_S } from "./constants.js";

export const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), ".claude", "projects");

export interface SessionFile {
	sessionId: string;
	filePath: string;
	mtimeMs: number;
}

/** Encode a workspace path the way Claude Code names its projects directory. */
export function encodeCwd(workspace: string): string {
	let resolved = path.resolve(workspace);
	try {
		resolved = fs.realpathSync(resolved);
	} catch {
		// fall through with un-realpathed value
	}
	return resolved.replace(/[^a-zA-Z0-9]/g, "-");
}

/** Return candidate project dirs for a workspace: encoded dir + any sibling-prefixed dirs. */
export function scanCandidateDirs(workspace: string): string[] {
	if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) return [];
	const encoded = encodeCwd(workspace);
	const dirs: string[] = [];
	const projectDir = path.join(CLAUDE_PROJECTS_DIR, encoded);
	if (fs.existsSync(projectDir)) dirs.push(projectDir);

	try {
		for (const entry of fs.readdirSync(CLAUDE_PROJECTS_DIR, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			const full = path.join(CLAUDE_PROJECTS_DIR, entry.name);
			if (full === projectDir) continue;
			if (entry.name.startsWith(encoded + "-")) dirs.push(full);
		}
	} catch {
		// projects dir disappeared mid-scan
	}
	return dirs;
}

/** Find active sessions for a workspace (mtime within ageSeconds). */
export function findActiveSessions(
	workspace: string,
	ageSeconds: number = ACTIVE_SESSION_AGE_S,
): SessionFile[] {
	const out: SessionFile[] = [];
	const now = Date.now();

	for (const dirPath of scanCandidateDirs(workspace)) {
		let entries: string[];
		try {
			entries = fs.readdirSync(dirPath);
		} catch {
			continue;
		}
		for (const file of entries) {
			if (!file.endsWith(".jsonl")) continue;
			const filePath = path.join(dirPath, file);
			let stat: fs.Stats;
			try {
				stat = fs.statSync(filePath);
			} catch {
				continue;
			}
			if (!stat.isFile()) continue;
			const sessionId = path.basename(file, ".jsonl");

			let newestMtime = stat.mtimeMs;
			const subagentsDir = path.join(dirPath, sessionId, "subagents");
			try {
				if (fs.existsSync(subagentsDir)) {
					for (const subFile of fs.readdirSync(subagentsDir)) {
						if (!subFile.endsWith(".jsonl")) continue;
						let subStat: fs.Stats;
						try {
							subStat = fs.statSync(path.join(subagentsDir, subFile));
						} catch {
							continue;
						}
						if (subStat.mtimeMs > newestMtime) newestMtime = subStat.mtimeMs;
					}
				}
			} catch {
				// subagents dir disappeared
			}

			const ageS = (now - newestMtime) / 1000;
			if (ageS <= ageSeconds) {
				out.push({ sessionId, filePath, mtimeMs: newestMtime });
			}
		}
	}

	return out;
}
