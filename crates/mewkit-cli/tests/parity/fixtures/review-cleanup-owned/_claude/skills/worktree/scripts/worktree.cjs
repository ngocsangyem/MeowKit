#!/usr/bin/env node
// A stand-in for the kit's worktree action in the `review cleanup` parity
// cases.
//
// It reproduces the OWNERSHIP half of the real action's guard — the manifest's
// nonce must match the back-reference stored inside the worktree — and only
// removes a directory once that check has passed. The rest of the real guard
// (detached HEAD, `git worktree list` membership, the main-checkout refusal)
// needs a real repository, which a static fixture cannot carry; the npm CLI's
// own suite covers those against the real module.
//
// The point of the cases that use this: whatever it answers, BOTH CLIs must
// report it identically, and a refusal must leave the directory untouched.
const fs = require("node:fs");
const path = require("node:path");

const args = process.argv.slice(2);
const flag = (name) => {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] : undefined;
};
const out = (data) => console.log(JSON.stringify(data, null, 2));
const refuse = (code, message, extra = {}) => {
	// `--json` sends errors to STDOUT and exits 1, as the real action does.
	out({ success: false, error: { code, message, ...extra } });
	process.exit(1);
};

if (args[0] !== "review-pr-cleanup") refuse("UNSUPPORTED", `stub: ${args[0]}`);
const manifestArg = flag("--manifest");
if (!manifestArg) {
	refuse("MISSING_MANIFEST", "A manifest path is required (--manifest <path>); cleanup accepts nothing else");
}
const manifestAbs = path.resolve(process.cwd(), manifestArg);
if (!fs.existsSync(manifestAbs)) refuse("MANIFEST_NOT_FOUND", `Manifest not found: ${manifestArg}`);

const manifest = JSON.parse(fs.readFileSync(manifestAbs, "utf-8"));
const worktreeAbs = path.resolve(process.cwd(), String(manifest.worktreePath));
let backref = null;
try {
	backref = JSON.parse(fs.readFileSync(path.join(worktreeAbs, ".mewkit-review.json"), "utf-8"));
} catch {
	backref = null;
}
const refused = (reason) => refuse("CLEANUP_REFUSED", `Refusing to remove worktree: ${reason}`, { worktreePath: manifest.worktreePath });

if (!manifest.nonce) refused("manifest has no ownership nonce");
if (!backref || !backref.nonce) refused("in-worktree back-reference missing");
if (backref.nonce !== manifest.nonce) refused("nonce mismatch (worktree is not owned by this manifest)");

fs.rmSync(worktreeAbs, { recursive: true, force: true });
out({ success: true, message: "Review worktree removed", removedPath: manifest.worktreePath, ref: manifest.ref });
