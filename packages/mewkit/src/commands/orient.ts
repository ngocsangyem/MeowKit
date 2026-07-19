// `mewkit orient [--json]` — provider-neutral orientation from durable task state ONLY. It
// reconstructs the active records + canonical pointer, probes each recorded repo's CURRENT
// revision (read from git refs directly, never a git binary), builds the pure Phase-1 envelope,
// and prints it. Human output goes through the bounded, control-stripped renderer; --json emits
// the full structured envelope for tooling. Read-only: it never writes task state, a pointer, or
// a trace event, and it never scans plans or the wiki.
import { existsSync } from "node:fs";
import pc from "picocolors";
import { reconstructResumeState, readActiveTaskPointer } from "../core/task-record.js";
import { buildOrientEnvelope, type RepoRevisionProbe } from "../core/orient-envelope.js";
import { renderOrientContext } from "../core/orient-context-renderer.js";
import { resolveOwningRepo } from "../core/repo-context.js";

export interface OrientOptions {
	json?: boolean;
}

/** Current revision of a recorded repo identity, or null (non-git, missing, or any read error). */
function probeRevision(identity: string): string | null {
	try {
		if (!existsSync(identity)) return null;
		return resolveOwningRepo(identity).revision;
	} catch {
		return null; // stale/unreadable repo degrades to "unknown", never crashes orientation
	}
}

export function orient(opts: OrientOptions = {}): void {
	const projectRoot = process.cwd();
	const resume = reconstructResumeState(projectRoot);
	const pointer = readActiveTaskPointer(projectRoot);

	// Probe the current revision of every repo referenced by a live (non-done) record.
	const identities = new Set<string>();
	for (const r of resume.records) {
		if (r.status === "done") continue;
		for (const repo of r.repos) identities.add(repo.identity);
	}
	const probes: RepoRevisionProbe[] = [...identities].map((identity) => ({
		identity,
		currentRevision: probeRevision(identity),
	}));

	const envelope = buildOrientEnvelope(resume, pointer, probes);

	if (opts.json) {
		console.log(JSON.stringify(envelope, null, 2));
		return;
	}
	// Human output uses the bounded renderer (same boundary a hook would use).
	console.log(renderOrientContext(envelope, { projectRoot }));
	if (envelope.outcome === "ambiguous") {
		console.log(pc.dim("Multiple active tasks — resolve by setting the active-task pointer (activate one task)."));
	}
}
