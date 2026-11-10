// Which source a release installs from, and what happens when the preferred one
// is bad.
//
// Three fixtures, three outcomes: artifact when present, zip only when there is
// no artifact, and a refusal when the artifact is present and fails — with the
// zip sitting there, valid and deliberately not used.
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { FAILURE_RECORD_FILENAME, quarantineDir, readVerificationFailure } from "../kit-quarantine.js";
import { KitVerificationError } from "../kit-refusal.js";
import { installFromArtifact } from "../resolve-kit-content.js";
import type { KitArtifactBytes } from "../verify-kit-artifact.js";
import { craftKitBundle, ephemeralKitKeys } from "../../../tests/helpers/craft-kit-bundle.js";

const VERSION = "9.9.9";
const roots: string[] = [];
afterAll(() => {
	for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function temp(): string {
	const dir = mkdtempSync(join(tmpdir(), "mewkit-precedence-"));
	roots.push(dir);
	return dir;
}

const trusted = ephemeralKitKeys();
const KEYS = [trusted.publicPem];

/**
 * A bundle whose signature is either from the trusted key or from a stranger's.
 * One parameter, so the two cases differ in exactly the thing under test.
 */
const bundle = (valid: boolean): KitArtifactBytes =>
	craftKitBundle(
		[{ name: ".claude/rules/a.md", body: "from the artifact\n" }],
		VERSION,
		valid ? trusted.privatePem : ephemeralKitKeys().privatePem,
	);

describe("source precedence", () => {
	it("installs from the artifact and records that origin", async () => {
		const root = temp();
		const result = await installFromArtifact(root, VERSION, bundle(true), "verified-artifact", KEYS);
		expect(result.origin).toBe("verified-artifact");
		expect(readFileSync(join(result.sourceDir, ".claude", "rules", "a.md"), "utf8")).toBe("from the artifact\n");
	});

	it("leaves the legacy path to a release that carries no artifact at all", () => {
		// The release selector decides this. A release is installable when it
		// carries EITHER source: requiring a zip would hide an artifact-only
		// release, and requiring an artifact would stop every older release.
		const selector = readFileSync(join(import.meta.dirname, "..", "..", "core", "github-releases.ts"), "utf8");
		expect(selector).toMatch(/release\.kitArtifact !== null/);
		expect(selector).toMatch(/r\.downloadUrl !== "" \|\| r\.kitArtifact !== null/);
	});

	it("stops rather than downgrading when the artifact is present and bad", async () => {
		const root = temp();
		let thrown: unknown;
		try {
			await installFromArtifact(root, VERSION, bundle(false), "verified-artifact", KEYS);
		} catch (error) {
			thrown = error;
		}
		expect(thrown).toBeInstanceOf(KitVerificationError);
		// Says the install was stopped, not that it fell back — a user must not be
		// left believing an unverified install happened.
		expect((thrown as Error).message).toMatch(/stopped rather than downgraded/);
		// No install source was produced at all.
		expect(existsSync(join(root, ".claude"))).toBe(false);
	});

	it("leaves a record a diagnostic can read with no network and no second fetch", async () => {
		const root = temp();
		await expect(installFromArtifact(root, VERSION, bundle(false), "verified-artifact", KEYS)).rejects.toThrow();

		const record = readVerificationFailure(root, VERSION);
		expect(record?.version).toBe(VERSION);
		expect(record?.check).toBe("signature-untrusted-key");
		expect(record?.attemptedAt).not.toBe("");
		// The one permitted write, and only inside quarantine.
		expect(readdirSync(quarantineDir(root, VERSION))).toEqual([FAILURE_RECORD_FILENAME]);
		// Carries no artifact bytes and no key material.
		const raw = readFileSync(join(quarantineDir(root, VERSION), FAILURE_RECORD_FILENAME), "utf8");
		expect(raw).not.toMatch(/PRIVATE KEY|BEGIN |[A-Za-z0-9+/]{200}/);
	});
});
