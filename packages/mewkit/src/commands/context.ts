// `mewkit context resolve|check` — inspect the repository-context evidence ledger (Phase 5).
// `resolve` builds an evidence ref for a path (owning repo, revision, hash, redaction);
// `check` re-hashes a recorded envelope's evidence and reports per-path freshness. MeowKit
// records + verifies evidence; the host's own tools acquire content.
import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import {
	buildEvidenceRef,
	checkEvidenceFreshness,
	ContextEnvelopeSchema,
	isWithinBoundary,
} from "../core/repo-context.js";

export interface ContextOptions {
	subcommand?: string;
	target?: string;
	root?: string;
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
		if (args.json) {
			console.log(JSON.stringify({ repoIdentity: envelope.repoIdentity, results }, null, 2));
			return;
		}
		const needsAction = results.filter((r) => r.status !== "fresh");
		console.log(pc.bold(pc.cyan(`Context freshness — ${envelope.repoIdentity}`)));
		for (const r of results) {
			const tag =
				r.status === "fresh"
					? pc.green("fresh")
					: r.status === "stale"
						? pc.yellow("stale")
						: r.status === "out-of-scope"
							? pc.red("out-of-scope")
							: pc.red("missing");
			console.log(`  [${tag}] ${r.path}`);
		}
		if (needsAction.length > 0) {
			console.log(pc.dim(`\n  ${needsAction.length} evidence path(s) need reacquisition or are out of scope.`));
			process.exit(1);
		}
		return;
	}

	console.error(pc.red(`Unknown context subcommand "${sub}". Expected resolve|check.`));
	process.exit(1);
}
