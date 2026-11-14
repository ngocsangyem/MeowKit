#!/usr/bin/env node
// A stand-in for the kit's worktree action in the `review prepare` parity
// cases. A static fixture cannot host the real git repository the action
// provisions a worktree in, so this answers `review-pr` with the manifest that
// action would have written, and lets the case choose the failure to rehearse
// through STUB_WORKTREE. It is deliberately dumb: the thing under comparison is
// how each CLI READS this output, not how a worktree is made.
const fs = require("node:fs");
const path = require("node:path");

const args = process.argv.slice(2);
const flag = (name) => {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] : undefined;
};
const mode = process.env.STUB_WORKTREE || "ok";

if (args[0] !== "review-pr") {
	console.log(JSON.stringify({ success: false, error: { code: "UNSUPPORTED", message: `stub: ${args[0]}` } }, null, 2));
	process.exit(1);
}
if (mode === "fail") {
	console.error("REVIEW_PR_SETUP_FAILED: could not fetch pull/9/head from upstream");
	process.exit(1);
}
if (mode === "garbage") {
	console.log("this is not json");
	process.exit(0);
}

const pr = flag("--pr");
const session = flag("--session");
const worktreePath = `.worktrees/review-pr-${pr}-${session}`;
const manifest = {
	schemaVersion: "1.0.0",
	session,
	nonce: "owner-nonce",
	worktreePath,
	pr: Number(pr),
	ref: `refs/mewkit/review-pr-${pr}-${session}`,
	headSha: "h".repeat(40),
	baseSha: "b".repeat(40),
	baseBranch: "main",
	baseRemote: flag("--remote"),
	host: "github",
	owner: "acme",
	repo: "widget",
	createdAt: "2026-11-13T00:00:00Z",
};
if (mode === "unschemad") {
	// Nothing is provisioned: the worktree directory carries the random session
	// id in its NAME, and a case whose file trees are compared literally must
	// not grow one.
	manifest.ref = "refs/heads/not-a-review-ref";
} else {
	// The caller search runs INSIDE the provisioned worktree, so it has to
	// exist — and the stubs have to be reachable from there, because the case
	// puts them on PATH as a RELATIVE entry that every process resolves against
	// its own working directory.
	fs.mkdirSync(path.join(process.cwd(), worktreePath), { recursive: true });
	fs.cpSync(path.join(process.cwd(), "stub-bin"), path.join(process.cwd(), worktreePath, "stub-bin"), {
		recursive: true,
	});
	fs.writeFileSync(
		path.join(process.cwd(), worktreePath, ".mewkit-review.json"),
		JSON.stringify({ session, nonce: manifest.nonce, pr: manifest.pr }, null, 2),
	);
}
console.log(JSON.stringify({ manifest }, null, 2));
