// The build produces one artifact whose digest is an identity for its content,
// a manifest derived from that artifact, and a signature the pipeline cannot run
// without.
//
// Reproducibility is checked across SEPARATE source roots with a clock gap and
// with each source of filesystem non-determinism perturbed. Two builds back to
// back in one process would pass trivially — nothing has had the chance to vary
// — so that form of the check proves nothing and is not used.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, cpSync, mkdirSync, readFileSync, readdirSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { generateKeyPairSync } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { readKitArchive } from "../kit-archive-reader.js";
import { gitTrackTree } from "./helpers/git-track-tree.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..", "..");
const BUILD_SCRIPT = join(REPO, "scripts", "build-kit-artifact.cjs");
const VERSION = "9.9.9";

const roots: string[] = [];
afterAll(() => {
	for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function temp(prefix: string): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	roots.push(dir);
	return dir;
}

/** An ephemeral signing key, generated per run. No key material is committed. */
function ephemeralKeyPem(): string {
	return generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

/** A minimal source tree with the roots and the exclusion field a build needs. */
function makeSourceRoot(exclude: string[] = [".claude/logs/*"]): string {
	const root = temp("mewkit-kit-src-");
	mkdirSync(join(root, ".claude", "rules"), { recursive: true });
	mkdirSync(join(root, ".claude", "scripts"), { recursive: true });
	mkdirSync(join(root, ".meowkit"), { recursive: true });
	mkdirSync(join(root, ".claude", "logs"), { recursive: true });
	writeFileSync(join(root, ".claude", "rules", "a.md"), "alpha\n");
	writeFileSync(join(root, ".claude", "rules", "b.md"), "beta\n");
	writeFileSync(join(root, ".claude", "scripts", "run.sh"), "#!/usr/bin/env bash\necho hi\n");
	writeFileSync(join(root, ".claude", "logs", "secret.md"), "unpatched detail\n");
	writeFileSync(join(root, "release-manifest.json"), JSON.stringify({ version: VERSION, files: [] }));
	writeFileSync(
		join(root, ".meowkit", "pack-manifest.json"),
		JSON.stringify({
			schemaVersion: "1.0",
			base: { files: [], globs: [], commands: [], exclude },
			packs: {},
			profiles: {},
		}),
	);
	gitTrackTree(root);
	return root;
}

function build(sourceRoot: string, outDir: string, env: Record<string, string | undefined> = {}): void {
	execFileSync(process.execPath, [BUILD_SCRIPT, VERSION, outDir], {
		cwd: sourceRoot,
		env: { ...process.env, MEOWKIT_KIT_SIGNING_KEY: ephemeralKeyPem(), ...env },
		stdio: "pipe",
	});
}

const sha256 = (buffer: Buffer): string => createHash("sha256").update(buffer).digest("hex");

const artifactPath = (outDir: string): string => join(outDir, `meowkit-kit-${VERSION}.tar.gz`);

interface BuiltManifest {
	version: string;
	artifact: { name: string; sha256: string; size: number };
	files: Array<{ path: string; sha256: string; size: number }>;
}

const readManifest = (outDir: string): BuiltManifest =>
	JSON.parse(readFileSync(join(outDir, "kit-manifest.json"), "utf8")) as BuiltManifest;

describe("kit artifact build", () => {
	it("derives the manifest from the artifact, entry for entry, in both directions", () => {
		const out = temp("mewkit-kit-out-");
		build(makeSourceRoot(), out);

		const artifact = readFileSync(artifactPath(out));
		const manifest = readManifest(out);
		const members = readKitArchive(artifact).members;

		expect(manifest.version).toBe(VERSION);
		expect(manifest.artifact.sha256).toBe(sha256(artifact));
		// Both directions: no entry for a file that is absent, and no file without
		// an entry. One direction alone lets a manifest describe a smaller archive.
		expect(manifest.files.length).toBe(members.length);
		const entries = new Map(manifest.files.map((f) => [f.path, f.sha256]));
		for (const member of members) {
			expect(entries.get(member.path)).toBe(sha256(member.content));
		}
		for (const entry of manifest.files) {
			expect(members.some((m) => m.path === entry.path)).toBe(true);
		}
	});

	it("reproduces identical digests from separate source roots with the clock, mtimes and modes perturbed", () => {
		const first = makeSourceRoot();
		const second = temp("mewkit-kit-src2-");
		cpSync(first, second, { recursive: true });

		// Each of the four sources of non-determinism, perturbed: member mtimes,
		// member mode, the input walk order (readdir order follows creation order on
		// a fresh copy), and the wall clock the gzip header would otherwise record.
		const pinTimes = (entry: string): void => {
			if (statSync(entry).isDirectory()) {
				for (const name of readdirSync(entry)) pinTimes(join(entry, name));
			}
			utimesSync(entry, new Date(0), new Date(0));
		};
		pinTimes(second);
		chmodSync(join(second, "release-manifest.json"), 0o755);

		const outA = temp("mewkit-kit-outa-");
		build(first, outA);
		// A clock gap, so a build that let the current second reach the archive
		// would differ. Short enough not to slow the suite, long enough to cross
		// the one-second resolution a gzip header records.
		const waitUntil = Date.now() + 1100;
		while (Date.now() < waitUntil) {
			/* deliberate wall-clock gap between the two builds */
		}
		const outB = temp("mewkit-kit-outb-");
		build(second, outB);

		expect(sha256(readFileSync(artifactPath(outB)))).toBe(sha256(readFileSync(artifactPath(outA))));
		expect(readFileSync(join(outB, "kit-manifest.json"), "utf8")).toBe(
			readFileSync(join(outA, "kit-manifest.json"), "utf8"),
		);
	});

	it("takes its ship set from the pack manifest, so an added pattern drops the file", () => {
		const withReport = temp("mewkit-kit-out-in-");
		build(makeSourceRoot([]), withReport);
		expect(readManifest(withReport).files.some((f) => f.path === ".claude/logs/secret.md")).toBe(true);

		const withoutReport = temp("mewkit-kit-out-ex-");
		build(makeSourceRoot([".claude/logs/*"]), withoutReport);
		expect(readManifest(withoutReport).files.some((f) => f.path === ".claude/logs/secret.md")).toBe(false);
	});
});
