// JSON read/write for the workflow evidence index, used by `mewkit advice commit`
// when a returned correction supersedes downstream evidence.
//
// Split from `advice.ts` so the command file stays about the supervision contract
// and this stays about file handling. Both operations fail loudly: a correction that
// silently failed to mark evidence superseded would leave stale proof reading as
// current at the next gate, which is precisely the failure the revision exists to
// prevent.
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import type { RevisionBearingIndex } from "../core/workflow-evidence-revision.js";

export type JsonRead = { ok: true; data: RevisionBearingIndex } | { ok: false; reason: string };

export function readJsonFile(absPath: string): JsonRead {
	if (!existsSync(absPath)) return { ok: false, reason: `evidence file not found: ${absPath}` };
	let raw: string;
	try {
		raw = readFileSync(absPath, "utf-8");
	} catch (err) {
		return { ok: false, reason: `cannot read ${absPath}: ${(err as Error).message}` };
	}
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
			return { ok: false, reason: `${absPath} is not a JSON object` };
		return { ok: true, data: parsed as RevisionBearingIndex };
	} catch {
		return { ok: false, reason: `${absPath} is not valid JSON` };
	}
}

/** Temp+rename so a crash mid-write cannot leave a half-written evidence index. */
export function writeJsonAtomic(absPath: string, data: unknown): void {
	const tmp = `${absPath}.tmp-${process.pid}`;
	writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
	renameSync(tmp, absPath);
}
