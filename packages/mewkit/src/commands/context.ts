// `mewkit context resolve|check|record` — inspect + record the repository-context evidence
// ledger (Phase 5). `resolve` builds an evidence ref for a path (owning repo, revision, hash,
// redaction); `check` re-hashes a recorded envelope's evidence and reports per-path freshness;
// `record` merges an envelope's owning repos + evidence paths into an active durable task record
// (advisory, best-effort). MeowKit records + verifies evidence; the host's own tools acquire it.
import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import {
	buildEvidenceRef,
	checkEvidenceFreshness,
	ContextEnvelopeSchema,
	distinctRepos,
	isWithinBoundary,
} from "../core/repo-context.js";
import { recordContextEvidence } from "../core/task-record.js";

export interface ContextOptions {
	subcommand?: string;
	target?: string;
	root?: string;
	/** `context record`: the active durable task id to merge the envelope's evidence into. */
	task?: string;
	json?: boolean;
}

export async function context(args: ContextOptions = {}): Promise<void> {
	const sub = args.subcommand ?? "resolve";
	const boundary = args.root ? path.resolve(args.root) : process.cwd();

	if (sub === "resolve") {
		if (!args.target) {
			console.error(pc.red("`context resolve` requires a path."));
			process.exit(1);
		}
		const abs = path.resolve(boundary, args.target);
		if (!isWithinBoundary(boundary, abs)) {
			console.error(pc.red(`Path escapes the boundary root: ${args.target}`));
			process.exit(1);
		}
		const ref = buildEvidenceRef(abs, boundary);
		if (args.json) {
			console.log(JSON.stringify(ref, null, 2));
			return;
		}
		console.log(pc.bold(pc.cyan(`Evidence: ${path.relative(boundary, abs) || abs}`)));
		console.log(`  owning repo: ${ref.owningRepoIdentity}`);
		console.log(`  revision:    ${ref.revision ?? pc.dim("(non-git / unresolved)")}`);
		console.log(`  content:     ${ref.contentHash ?? pc.yellow("(missing)")}`);
		console.log(`  redacted:    ${ref.redacted ? pc.yellow("yes (secret-shaped path)") : "no"}`);
		return;
	}

	if (sub === "check") {
		if (!args.target) {
			console.error(pc.red("`context check` requires an envelope JSON path."));
			process.exit(1);
		}
		const envPath = path.resolve(boundary, args.target);
		if (!fs.existsSync(envPath)) {
			console.error(pc.red(`Envelope not found: ${args.target}`));
			process.exit(1);
		}
		let envelope;
		try {
			envelope = ContextEnvelopeSchema.parse(JSON.parse(fs.readFileSync(envPath, "utf-8")));
		} catch (err) {
			console.error(pc.red(`Invalid context envelope: ${(err as Error).message.split("\n")[0]}`));
			process.exit(1);
		}
		// Boundary-scope the freshness check: an untrusted envelope's evidence paths are never
		// stat-ed/hashed outside the boundary (no arbitrary-path existence/hash oracle).
		const results = checkEvidenceFreshness(envelope.evidence, boundary);
		// Pair each result with its evidence ref (1:1, same order) to group BY OWNING REPO.
		const paired = results.map((r, i) => ({ ...r, ref: envelope.evidence[i] }));
		if (args.json) {
			console.log(
				JSON.stringify(
					{ boundaryRoot: envelope.boundaryRoot, repos: distinctRepos(envelope.evidence), results },
					null,
					2,
				),
			);
			return;
		}
		const tagFor = (s: string): string =>
			s === "fresh"
				? pc.green("fresh")
				: s === "stale"
					? pc.yellow("stale")
					: s === "out-of-scope"
						? pc.red("out-of-scope")
						: pc.red("missing");
		console.log(pc.bold(pc.cyan(`Context freshness — scope: ${envelope.boundaryRoot}`)));
		// Per-repo grouping: each owning repo (with its own revision) is reported separately, so a
		// multi-repo task never loses which repo an evidence file — and its freshness — belongs to.
		for (const repo of distinctRepos(envelope.evidence)) {
			console.log(pc.bold(`  ${repo.identity} ${pc.dim(`@ ${repo.revision ?? "(non-git)"}`)}`));
			for (const p of paired.filter((x) => x.ref.owningRepoIdentity === repo.identity)) {
				console.log(`    [${tagFor(p.status)}] ${p.ref.path}`);
			}
		}
		const needsAction = results.filter((r) => r.status !== "fresh");
		if (needsAction.length > 0) {
			console.log(pc.dim(`\n  ${needsAction.length} evidence path(s) need reacquisition or are out of scope.`));
			process.exit(1);
		}
		return;
	}

	if (sub === "record") {
		if (!args.task) {
			console.error(pc.red("`context record` requires --task <id> (the active durable task to record into)."));
			process.exit(1);
		}
		if (!args.target) {
			console.error(pc.red("`context record` requires an envelope JSON path."));
			process.exit(1);
		}
		const envPath = path.resolve(boundary, args.target);
		if (!fs.existsSync(envPath)) {
			console.error(pc.red(`Envelope not found: ${args.target}`));
			process.exit(1);
		}
		let envelope;
		try {
			envelope = ContextEnvelopeSchema.parse(JSON.parse(fs.readFileSync(envPath, "utf-8")));
		} catch (err) {
			console.error(pc.red(`Invalid context envelope: ${(err as Error).message.split("\n")[0]}`));
			process.exit(1);
		}
		// Advisory + best-effort (task-state-emission Rule 3): merge the envelope's owning repos +
		// evidence paths into the CONSUMER PROJECT's task record (cwd-keyed, per task-record.ts).
		// A missing/incompatible record surfaces non-zero but is never fatal to the caller's flow.
		try {
			const rec = await recordContextEvidence(process.cwd(), args.task, envelope, new Date().toISOString());
			if (args.json) {
				console.log(JSON.stringify({ taskId: rec.taskId, repos: rec.repos, evidenceRefs: rec.evidenceRefs }, null, 2));
				return;
			}
			console.log(pc.bold(pc.cyan(`Recorded context evidence → task ${rec.taskId}`)));
			for (const r of rec.repos) console.log(`  repo: ${r.identity} ${pc.dim(`@ ${r.revision ?? "(non-git)"}`)}`);
			console.log(pc.dim(`  ${rec.evidenceRefs.length} evidence path(s) tracked`));
			return;
		} catch (err) {
			console.error(pc.yellow(`context record skipped (advisory): ${(err as Error).message}`));
			process.exit(1);
		}
	}

	console.error(pc.red(`Unknown context subcommand "${sub}". Expected resolve|check|record.`));
	process.exit(1);
}
