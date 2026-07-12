// Phase 5 slice 1: repo-context primitives. The acceptance crux is nested-repo resolution
// (a multi-repo parent like Aspire — each path resolves to its OWN repo) and per-path
// content-hash freshness (a repo advancing never marks another repo's untouched file stale).
// Fake git repos are built by writing .git/HEAD + refs directly — the resolver reads refs, no
// `git` binary is invoked.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	resolveOwningRepo,
	buildEvidenceRef,
	checkEvidenceFreshness,
	isSecretPath,
	isWithinBoundary,
} from "../repo-context.js";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

function makeRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "mewkit-repoctx-"));
	roots.push(root);
	return root;
}

/** Create a fake git repo at `dir` with a branch HEAD pointing at `sha`. */
function fakeGitRepo(dir: string, sha: string, branch = "main"): void {
	mkdirSync(join(dir, ".git", "refs", "heads"), { recursive: true });
	writeFileSync(join(dir, ".git", "HEAD"), `ref: refs/heads/${branch}\n`);
	writeFileSync(join(dir, ".git", "refs", "heads", branch), `${sha}\n`);
}

describe("resolveOwningRepo — nested repositories", () => {
	it("resolves a file to its owning git repo + HEAD revision", () => {
		const root = makeRoot();
		fakeGitRepo(root, "a".repeat(40));
		mkdirSync(join(root, "src"));
		writeFileSync(join(root, "src", "x.ts"), "code\n");
		const owner = resolveOwningRepo(join(root, "src", "x.ts"));
		expect(owner.isGit).toBe(true);
		expect(owner.identity).toBe(root);
		expect(owner.revision).toBe("a".repeat(40));
	});

	it("Aspire-style: each path resolves to its OWN nested repo, not the parent dir", () => {
		const aspire = makeRoot(); // parent dir containing multiple independent repos
		const repoA = join(aspire, "customer-frontend");
		const repoB = join(aspire, "aspire-api");
		mkdirSync(repoA, { recursive: true });
		mkdirSync(repoB, { recursive: true });
		fakeGitRepo(repoA, "a".repeat(40));
		fakeGitRepo(repoB, "b".repeat(40));
		writeFileSync(join(repoA, "app.ts"), "a\n");
		writeFileSync(join(repoB, "server.ts"), "b\n");

		const oa = resolveOwningRepo(join(repoA, "app.ts"), aspire);
		const ob = resolveOwningRepo(join(repoB, "server.ts"), aspire);
		expect(oa.identity).toBe(repoA);
		expect(oa.revision).toBe("a".repeat(40));
		expect(ob.identity).toBe(repoB);
		expect(ob.revision).toBe("b".repeat(40));
		// The parent is NOT treated as one repository.
		expect(oa.identity).not.toBe(aspire);
	});

	it("non-git path → boundary root identity, null revision (no fabrication)", () => {
		const root = makeRoot();
		mkdirSync(join(root, "docs"));
		writeFileSync(join(root, "docs", "note.md"), "n\n");
		const owner = resolveOwningRepo(join(root, "docs", "note.md"), root);
		expect(owner.isGit).toBe(false);
		expect(owner.identity).toBe(root);
		expect(owner.revision).toBeNull();
	});

	it("detached HEAD (raw SHA) resolves as the revision", () => {
		const root = makeRoot();
		mkdirSync(join(root, ".git"), { recursive: true });
		writeFileSync(join(root, ".git", "HEAD"), "c".repeat(40) + "\n");
		expect(resolveOwningRepo(join(root, "f.ts"), root).revision).toBe("c".repeat(40));
	});

	it("packed-refs fallback resolves the revision when no loose ref file exists", () => {
		const root = makeRoot();
		mkdirSync(join(root, ".git"), { recursive: true });
		writeFileSync(join(root, ".git", "HEAD"), "ref: refs/heads/main\n");
		writeFileSync(join(root, ".git", "packed-refs"), `# pack-refs\n${"d".repeat(40)} refs/heads/main\n`);
		expect(resolveOwningRepo(join(root, "f.ts"), root).revision).toBe("d".repeat(40));
	});

	it("`.git` FILE (gitdir pointer) is followed to the real metadata dir", () => {
		const root = makeRoot();
		const realGit = join(root, "realgit");
		mkdirSync(join(realGit, "refs", "heads"), { recursive: true });
		writeFileSync(join(realGit, "HEAD"), "ref: refs/heads/main\n");
		writeFileSync(join(realGit, "refs", "heads", "main"), "e".repeat(40) + "\n");
		writeFileSync(join(root, ".git"), `gitdir: ${realGit}\n`);
		expect(resolveOwningRepo(join(root, "f.ts"), root).revision).toBe("e".repeat(40));
	});
});

describe("per-path freshness", () => {
	it("fresh → stale (edited) → missing (deleted), independent of other repos", () => {
		const root = makeRoot();
		fakeGitRepo(root, "a".repeat(40));
		const f = join(root, "x.ts");
		writeFileSync(f, "v1\n");
		const ref = buildEvidenceRef(f, root);
		expect(checkEvidenceFreshness([ref])[0].status).toBe("fresh");

		writeFileSync(f, "v2 edited\n");
		expect(checkEvidenceFreshness([ref])[0].status).toBe("stale");

		rmSync(f);
		expect(checkEvidenceFreshness([ref])[0].status).toBe("missing");
	});

	it("a ref recorded as missing (null hash) reports stale until reacquired", () => {
		const root = makeRoot();
		const ref = buildEvidenceRef(join(root, "absent.ts"), root); // file doesn't exist
		expect(ref.contentHash).toBeNull();
		writeFileSync(join(root, "absent.ts"), "now here\n");
		expect(checkEvidenceFreshness([ref])[0].status).toBe("stale");
	});
});

describe("redaction + containment", () => {
	it("flags secret-shaped paths for redaction (incl. .env.*, SSH keys, keystores, npmrc, token)", () => {
		for (const p of [
			"/proj/.env",
			"/proj/.env.local",
			"/proj/.env.production",
			"/proj/config/credentials.json",
			"/proj/keys/server.pem",
			"/home/u/.ssh/id_rsa",
			"/proj/keys/cert.p12",
			"/proj/.npmrc",
			"/proj/config/access_token.json",
			"/proj/secrets/db.txt",
		]) {
			expect(isSecretPath(p), p).toBe(true);
		}
		for (const p of ["/proj/src/app.ts", "/proj/src/tokenizer.ts", "/proj/readme.md"]) {
			expect(isSecretPath(p), p).toBe(false);
		}
	});

	it("buildEvidenceRef marks a secret-shaped path redacted AND does not hash its content (L4)", () => {
		const root = makeRoot();
		writeFileSync(join(root, ".env"), "SECRET=x\n");
		const ref = buildEvidenceRef(join(root, ".env"), root);
		expect(ref.redacted).toBe(true);
		expect(ref.contentHash).toBeNull(); // secret content never hashed/persisted
	});

	it("isWithinBoundary rejects a path escaping the boundary", () => {
		const root = makeRoot();
		expect(isWithinBoundary(root, join(root, "src/x.ts"))).toBe(true);
		expect(isWithinBoundary(root, "/etc/passwd")).toBe(false);
	});
});

describe("security hardening", () => {
	it("H2: a crafted HEAD ref traversal never reads arbitrary file content into revision", () => {
		const root = makeRoot();
		writeFileSync(join(root, "secret.txt"), "TOP-SECRET-CONTENT\n");
		mkdirSync(join(root, "repo", ".git"), { recursive: true });
		// Malicious HEAD points a ref outside the git dir at the secret file.
		writeFileSync(join(root, "repo", ".git", "HEAD"), "ref: ../../secret.txt\n");
		const owner = resolveOwningRepo(join(root, "repo", "app.ts"), root);
		expect(owner.isGit).toBe(true);
		expect(owner.revision).toBeNull(); // NOT "TOP-SECRET-CONTENT"
	});

	it("H1: context freshness never stat/hashes an evidence path outside the boundary", () => {
		const root = makeRoot();
		const ref = {
			path: "/etc/passwd",
			contentHash: "deadbeef",
			owningRepoIdentity: "/etc",
			revision: null,
			provenance: "host-read" as const,
			redacted: false,
		};
		expect(checkEvidenceFreshness([ref], root)[0].status).toBe("out-of-scope");
	});
});
