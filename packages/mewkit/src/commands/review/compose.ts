import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveAnchor } from "../../review/anchors.js";
import { FindingSchema, type Finding } from "../../review/schema.js";
import { computeVerdict, type ComputedVerdict } from "../../review/verdict.js";
import { reviewCoverage, type CoverageReport } from "./coverage.js";

// `mewkit review compose --session <id>` — the MECHANICAL coverage→verdict gate.
// It (1) verifies the immutable diff hash, (2) re-runs coverage and HARD-REFUSES
// (non-zero, no verdict) on any gap, (3) validates every finding against the Zod
// schema, (4) applies the deterministic cap table, (5) resolves inline anchors by
// snippet against the captured diff (never agent line numbers), and (6) emits a
// verdict-gate-compatible proof bundle (embedding the coverage report + its hash) and
// a SubmitPayload. A PASS is impossible without complete, session-observed coverage —
// this coupling lives in CLI code, not only in step-file prose.

type Exec = (file: string, args: string[], cwd?: string) => { ok: boolean; out: string };
const realExec: Exec = (file, args, cwd) => {
	try { return { ok: true, out: execFileSync(file, args, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).toString() }; }
	catch { return { ok: false, out: "" }; }
};

export interface ComposeOptions {
	session: string;
	cwd?: string;
	json?: boolean;
	deps?: { exec?: Exec; coverage?: (session: string, cwd: string) => Promise<CoverageReport> };
}

export interface ComposeResult {
	ok: boolean;
	error?: string;
	decision?: ComputedVerdict["decision"];
	event?: ComputedVerdict["event"];
	reasons?: string[];
	verdictPath?: string;
}

const readJson = (p: string) => JSON.parse(fs.readFileSync(p, "utf-8"));

// CI status from the captured `gh pr checks` text (best-effort, fixture-testable).
function ciStatus(text: string | null): { red: boolean; allSkipped: boolean } {
	if (!text || !text.trim()) return { red: false, allSkipped: false };
	const red = /\bfail|failing|failure|error\b/i.test(text);
	const lines = text.split("\n").filter((l) => l.trim());
	const allSkipped = lines.length > 0 && lines.every((l) => /skip/i.test(l));
	return { red, allSkipped };
}

export async function reviewCompose(options: ComposeOptions): Promise<ComposeResult> {
	const cwd = options.cwd ?? process.cwd();
	const exec = options.deps?.exec ?? realExec;
	const sessionDir = path.join(cwd, "tasks", "reviews", options.session);
	const emit = (r: ComposeResult): ComposeResult => {
		if (options.json) console.log(JSON.stringify(r, null, 2));
		else if (r.error) console.error(`✗ ${r.error}`);
		else console.log(`${r.decision === "PASS" ? "✓" : r.decision === "BLOCKED" ? "✗" : "⚠"} ${r.decision} (${r.event}) — ${r.reasons?.length ? r.reasons.join("; ") : "clean"}`);
		if (!r.ok) process.exitCode = 1;
		return r;
	};
	const bail = (error: string) => emit({ ok: false, error });

	if (!fs.existsSync(path.join(sessionDir, "manifest.json"))) return bail(`no review session at ${path.relative(cwd, sessionDir)}`);
	const manifest = readJson(path.join(sessionDir, "manifest.json"));

	// 1. Tamper-evident diff: recompute the hash and refuse on mismatch (restart).
	const diffPath = path.join(sessionDir, "diff.patch");
	const diffText = fs.existsSync(diffPath) ? fs.readFileSync(diffPath, "utf-8") : "";
	const diffSha = crypto.createHash("sha256").update(diffText).digest("hex");
	if (manifest.diffSha256 && manifest.diffSha256 !== diffSha) return bail("diff.patch hash does not match the manifest — the captured diff was modified; restart the review");

	// 2. Re-run coverage; HARD-REFUSE (no verdict) on any gap. This is the mechanical
	//    coverage→verdict gate: a PASS cannot exist without complete coverage.
	const coverage = options.deps?.coverage
		? await options.deps.coverage(options.session, cwd)
		: await reviewCoverage({ session: options.session, cwd, silent: true });
	if (!coverage.ok || !coverage.complete) return bail(`coverage incomplete (${coverage.gaps.length} gap(s)) — complete reviewer coverage before composing; run 'mewkit review coverage --session ${options.session}'`);

	// 3. Validate findings against the Zod schema.
	const findingsPath = path.join(sessionDir, "findings.json");
	const findings: Finding[] = [];
	if (fs.existsSync(findingsPath)) {
		const raw = readJson(findingsPath);
		if (!Array.isArray(raw)) return bail("findings.json must be an array");
		for (const f of raw) {
			const parsed = FindingSchema.safeParse(f);
			if (!parsed.success) return bail(`invalid finding: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
			findings.push(parsed.data);
		}
	}

	// 4. Cap table (pure). CI + self-PR + context feed the caps.
	const ci = ciStatus(fs.existsSync(path.join(sessionDir, "untrusted", "ci-checks.txt")) ? fs.readFileSync(path.join(sessionDir, "untrusted", "ci-checks.txt"), "utf-8") : null);
	let selfPR = false;
	try {
		const me = exec("gh", ["api", "user", "--jq", ".login"], cwd);
		const meta = fs.existsSync(path.join(sessionDir, "untrusted", "pr-metadata.json")) ? readJson(path.join(sessionDir, "untrusted", "pr-metadata.json")) : null;
		const author = meta?.author?.login ?? meta?.author;
		if (me.ok && author && me.out.trim() === String(author).trim()) selfPR = true;
	} catch { /* selfPR stays false when identity is unavailable */ }

	const verdict = computeVerdict({
		confirmedCritical: findings.some((f) => f.severity === "CRITICAL"),
		coverageComplete: coverage.complete,
		evidenceLevel: coverage.evidenceLevel,
		ciRed: ci.red,
		ciAllSkipped: ci.allSkipped,
		contextUnavailable: Array.isArray(manifest.contextUnavailable) ? manifest.contextUnavailable : [],
		selfPR,
	});

	// 5. Resolve inline anchors by snippet; ambiguous/not-found → keep in body only.
	const inline = findings
		.filter((f) => typeof (f as Record<string, unknown>).snippet === "string")
		.map((f) => {
			const r = resolveAnchor(diffText, f.location.split(":")[0], String((f as Record<string, unknown>).snippet));
			return r.ok ? { ...f, anchor: r.anchor } : { ...f, anchorUnresolved: r.reason };
		});

	// 6. Emit proof bundle (verdict-gate compatible) + SubmitPayload.
	const coverageBlock = { report: coverage, sha256: crypto.createHash("sha256").update(JSON.stringify(coverage)).digest("hex") };
	const dimensionVerdict = verdict.decision === "BLOCKED" ? "FAIL" : verdict.decision === "PASS_WITH_RISK" ? "WARN" : "PASS";
	const proof = {
		schema_version: "1.0.0",
		slug: options.session,
		gate: "review" as const,
		decision: verdict.decision,
		dimensions: [{ name: "Review", verdict: dimensionVerdict, note: verdict.reasons.join("; ") || undefined }],
		evidence_refs: [`tasks/reviews/${options.session}/impact-map.json`, `tasks/reviews/${options.session}/evidence.jsonl`],
		created_at: manifest.createdAt ?? new Date().toISOString(),
		review_session: options.session,
		coverage: coverageBlock,
		findings: inline,
	};
	const submitPayload = {
		host: manifest.host, owner: manifest.owner, repo: manifest.repo, pr: manifest.pr,
		headSha: manifest.headSha, event: verdict.event,
		body: `${verdict.decision}${verdict.reasons.length ? ` — ${verdict.reasons.join("; ")}` : ""}`,
	};
	fs.writeFileSync(path.join(sessionDir, `${options.session}-verdict.json`), `${JSON.stringify(proof, null, 2)}\n`);
	fs.writeFileSync(path.join(sessionDir, "submit-payload.json"), `${JSON.stringify(submitPayload, null, 2)}\n`);
	fs.writeFileSync(path.join(sessionDir, "verdict.md"), `# Review verdict — ${verdict.decision}\n\nEvent: ${verdict.event}\nEvidence level: ${coverage.evidenceLevel}\n${verdict.reasons.length ? `\nCaps/risks:\n${verdict.reasons.map((r) => `- ${r}`).join("\n")}\n` : ""}`);

	return emit({ ok: true, decision: verdict.decision, event: verdict.event, reasons: verdict.reasons, verdictPath: path.relative(cwd, path.join(sessionDir, `${options.session}-verdict.json`)) });
}
