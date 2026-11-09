// One cache, project-local, and an offline install that re-verifies what it
// finds there rather than trusting it for being local.
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { CACHE_REL } from "../../core/kit-cache.js";
import { hasStoredArtifact, readStoredArtifact } from "../kit-artifact-store.js";
import { OfflineUnavailableError } from "../kit-offline.js";
import { artifactStoreDir, recordVerificationFailure } from "../kit-quarantine.js";
import { KitVerificationError } from "../kit-refusal.js";
import { installFromArtifact, installOffline } from "../resolve-kit-content.js";
import type { KitArtifactBytes } from "../verify-kit-artifact.js";
import { craftKitBundle, ephemeralKitKeys } from "../../../tests/helpers/craft-kit-bundle.js";

const VERSION = "9.9.9";
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..", "..");

const roots: string[] = [];
afterAll(() => {
	for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function temp(): string {
	const dir = mkdtempSync(join(tmpdir(), "mewkit-offline-"));
	roots.push(dir);
	return dir;
}

const trusted = ephemeralKitKeys();
const KEYS = [trusted.publicPem];
const makeBundle = (): KitArtifactBytes =>
	craftKitBundle([{ name: ".claude/rules/a.md", body: "alpha\n" }], VERSION, trusted.privatePem);

describe("one project-local cache, and offline re-verification", () => {
	it("stores a verified artifact under the project cache and serves a later install with no network", async () => {
		const root = temp();
		await installFromArtifact(root, VERSION, makeBundle(), "verified-artifact", KEYS);
		expect(hasStoredArtifact(root, VERSION)).toBe(true);
		// The store is a subdirectory of the ONE cache, not a second cache.
		expect(artifactStoreDir(root, VERSION).startsWith(join(root, CACHE_REL))).toBe(true);

		const offline = await installOffline(root, VERSION, KEYS);
		expect(offline.origin).toBe("local-cache");
		expect(readFileSync(join(offline.sourceDir, ".claude", "rules", "a.md"), "utf8")).toBe("alpha\n");
	});

	it("refuses a corrupted cached artifact exactly as it refuses a corrupted download", async () => {
		const root = temp();
		await installFromArtifact(root, VERSION, makeBundle(), "verified-artifact", KEYS);
		const stored = readStoredArtifact(root, VERSION);
		const corrupted = Buffer.from(stored?.artifact ?? Buffer.alloc(0));
		corrupted[corrupted.length - 10] ^= 0x01;
		writeFileSync(join(artifactStoreDir(root, VERSION), "kit.tar.gz"), corrupted);

		await expect(installOffline(root, VERSION, KEYS)).rejects.toThrow(KitVerificationError);
	});

	it("refuses an offline install in a project whose cache is empty, naming both ways forward", async () => {
		const root = temp();
		let thrown: unknown;
		try {
			await installOffline(root, VERSION, KEYS);
		} catch (error) {
			thrown = error;
		}
		expect(thrown).toBeInstanceOf(OfflineUnavailableError);
		const message = (thrown as Error).message;
		expect(message).toMatch(/MEOWKIT_RELEASE_SOURCE/);
		expect(message).toMatch(/mewkit upgrade/);
		expect(message).toMatch(/No network request was made/);
	});

	it("reports a recorded refusal instead of installing the quarantined bytes", async () => {
		const root = temp();
		await installFromArtifact(root, VERSION, makeBundle(), "verified-artifact", KEYS);
		recordVerificationFailure(root, VERSION, "artifact-digest", `meowkit-kit-${VERSION}.tar.gz`);

		// The store still holds a good artifact. The record wins anyway: it means an
		// attempt at this version already failed, and convenience is not a reason to
		// install from bytes beside a failure record.
		await expect(installOffline(root, VERSION, KEYS)).rejects.toThrow(OfflineUnavailableError);
	});

	it("puts no kit cache under the home directory, anywhere in the kit modules", () => {
		const kitDir = join(REPO, "packages", "mewkit", "src", "kit");
		for (const name of readdirSync(kitDir)) {
			if (!name.endsWith(".ts")) continue;
			const source = readFileSync(join(kitDir, name), "utf8");
			// A home cache would be shared by every project on the machine, so one
			// project's download would sit where another project's deletion decisions
			// are checked against.
			expect(source).not.toMatch(/homedir\(\)|process\.env\.HOME|\$HOME|~\/\.meowkit/);
		}
	});

	it("keeps the cache untracked, which is the property the deletion decisions rely on", () => {
		// Asserted against the committed ignore rules rather than against a scratch
		// project: the rule is what a pull request would have to change.
		const ignore = join(REPO, ".meowkit", ".gitignore");
		expect(existsSync(ignore)).toBe(true);
		expect(readFileSync(ignore, "utf8")).toMatch(/^\*$/m);
	});
});
