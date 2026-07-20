import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { safeParseSubmitPayload } from "../../review/schema.js";

// `mewkit review submit --session <id> --reply --confirm <payload-hash>` — the ONLY
// GitHub write path. Guards (all mechanical): (1) --reply is required (sole write
// authority); (2) a confirmation bound to the CURRENT payload hash is required — a
// stale/absent token refuses (the skill obtains the human confirmation via
// AskUserQuestion AFTER showing the composed body, then passes the hash here); (3) the
// PR head SHA is re-fetched and a change since prepare aborts without posting; (4) an
// idempotency marker prevents a double-post on retry. The re-fetch→post window is a
// documented small TOCTOU, not eliminated.
//
// HONESTY: the CLI cannot prove a human (not the agent) produced --confirm; it proves
// the confirmation is bound to this exact payload. Host-authenticated approval is
// deferred (same gate-authority limit as Gate 2).

type Exec = (file: string, args: string[], cwd?: string) => { ok: boolean; out: string; err: string };
const realExec: Exec = (file, args, cwd) => {
	try {
		return {
			ok: true,
			out: execFileSync(file, args, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).toString(),
			err: "",
		};
	} catch (e) {
		const x = e as { stdout?: Buffer; stderr?: Buffer; message?: string };
		return { ok: false, out: x.stdout?.toString() ?? "", err: x.stderr?.toString() ?? x.message ?? "exec failed" };
	}
};

const EVENT_FLAG: Record<string, string> = {
	APPROVE: "--approve",
	REQUEST_CHANGES: "--request-changes",
	COMMENT: "--comment",
};

export interface SubmitOptions {
	session: string;
	reply?: boolean;
	confirm?: string; // must equal the current payload hash
	cwd?: string;
	json?: boolean;
	deps?: { exec?: Exec };
}

export interface SubmitResult {
	ok: boolean;
	error?: string;
	posted?: boolean;
	alreadyPosted?: boolean;
	payloadHash?: string;
}

const payloadHashOf = (payload: unknown) => crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");

export async function reviewSubmit(options: SubmitOptions): Promise<SubmitResult> {
	const cwd = options.cwd ?? process.cwd();
	const exec = options.deps?.exec ?? realExec;
	const sessionDir = path.join(cwd, "tasks", "reviews", options.session);
	const emit = (r: SubmitResult): SubmitResult => {
		if (options.json) console.log(JSON.stringify(r, null, 2));
		else if (r.error) console.error(`✗ ${r.error}`);
		else console.log(r.alreadyPosted ? "✓ already submitted (idempotent no-op)" : "✓ review posted");
		if (!r.ok) process.exitCode = 1;
		return r;
	};
	const bail = (error: string) => emit({ ok: false, error });

	// 1. --reply is the sole write authority.
	if (!options.reply)
		return bail("submit requires --reply (the only GitHub write authority); without it the run is review-only");

	const payloadPath = path.join(sessionDir, "submit-payload.json");
	if (!fs.existsSync(payloadPath)) return bail("no submit-payload.json — run 'mewkit review compose' first");
	const payload = JSON.parse(fs.readFileSync(payloadPath, "utf-8"));
	const parsed = safeParseSubmitPayload(payload);
	if (!parsed.success)
		return bail(`submit payload failed schema: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
	const hash = payloadHashOf(payload);

	// 2. Confirmation bound to THIS payload.
	if (!options.confirm)
		return bail(
			`submit requires --confirm <payload-hash> after the user approves the composed body. Current payload hash: ${hash}`,
		);
	if (options.confirm !== hash)
		return bail("confirmation does not match the current payload (stale or recomposed) — re-confirm the shown body");

	// 3. Idempotency: never double-post.
	const marker = path.join(sessionDir, "submitted.json");
	if (fs.existsSync(marker)) {
		try {
			if (JSON.parse(fs.readFileSync(marker, "utf-8")).payloadHash === hash)
				return emit({ ok: true, posted: false, alreadyPosted: true, payloadHash: hash });
		} catch {
			/* fall through to re-post */
		}
	}

	// 4. Re-fetch the PR head SHA; a change since prepare aborts WITHOUT posting.
	const head = exec(
		"gh",
		["api", `repos/${payload.owner}/${payload.repo}/pulls/${payload.pr}`, "--jq", ".head.sha"],
		cwd,
	);
	if (!head.ok) return bail(`could not re-fetch PR head SHA: ${head.err}`);
	if (head.out.trim() !== payload.headSha)
		return bail(
			`PR head changed since prepare (reviewed ${payload.headSha.slice(0, 12)}, now ${head.out.trim().slice(0, 12)}) — restart the review; NOT posting`,
		);

	// 5. Post exactly one formal review.
	const flag = EVENT_FLAG[payload.event];
	if (!flag) return bail(`unknown review event: ${payload.event}`);
	const res = exec(
		"gh",
		["pr", "review", String(payload.pr), "--repo", `${payload.owner}/${payload.repo}`, flag, "--body", payload.body],
		cwd,
	);
	if (!res.ok) return bail(`gh pr review failed: ${res.err}`);

	fs.writeFileSync(
		marker,
		`${JSON.stringify({ payloadHash: hash, headSha: payload.headSha, event: payload.event, at: new Date().toISOString() }, null, 2)}\n`,
	);
	return emit({ ok: true, posted: true, payloadHash: hash });
}
