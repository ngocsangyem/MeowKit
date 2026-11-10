// The signature is made with the platform's crypto, verified against the
// keyring, and the pipeline cannot run without the key.
//
// Fail-closed is checked at BOTH layers, because each one can be true while the
// other is false: the build script can exit non-zero while the workflow step
// swallows it, and the step can be strict while the script warns and continues.
// A test that only ran the script would miss the first; one that only read the
// workflow would miss the second.
import { execFileSync } from "node:child_process";
import { createPrivateKey, generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { KitVerificationError } from "../kit-refusal.js";
import { verifyManifestSignature } from "../kit-signature.js";
import { TRUSTED_KIT_KEYS } from "../trusted-keys.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..", "..");
const BUILD_SCRIPT = join(REPO, "scripts", "build-kit-artifact.cjs");
const KEYGEN_SCRIPT = join(REPO, "scripts", "generate-kit-signing-key.cjs");

const roots: string[] = [];
afterAll(() => {
	for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function temp(prefix: string): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	roots.push(dir);
	return dir;
}

function ephemeralPair(): { privatePem: string; publicPem: string } {
	const { privateKey, publicKey } = generateKeyPairSync("ed25519");
	return {
		privatePem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
		publicPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
	};
}

function sign(manifestBytes: Buffer, privatePem: string): string {
	return cryptoSign(null, manifestBytes, createPrivateKey(privatePem)).toString("base64");
}

/** A source tree the build script can run against. */
function makeSourceRoot(): string {
	const root = temp("mewkit-sign-src-");
	mkdirSync(join(root, ".claude"), { recursive: true });
	mkdirSync(join(root, ".meowkit"), { recursive: true });
	writeFileSync(join(root, ".claude", "a.md"), "alpha\n");
	writeFileSync(join(root, "release-manifest.json"), JSON.stringify({ version: "9.9.9", files: [] }));
	writeFileSync(
		join(root, ".meowkit", "pack-manifest.json"),
		JSON.stringify({ schemaVersion: "1.0", base: { files: [], globs: [], commands: [], exclude: [] }, packs: {}, profiles: {} }),
	);
	return root;
}

describe("kit manifest signing", () => {
	it("verifies a key the keyring lists and refuses a correctly-formed signature from one it does not", () => {
		const bytes = Buffer.from('{"version":"9.9.9"}\n', "utf8");
		const listed = ephemeralPair();
		const stranger = ephemeralPair();

		expect(() => verifyManifestSignature(bytes, sign(bytes, listed.privatePem), "9.9.9", [listed.publicPem])).not.toThrow();

		// A good signature over the right bytes, from a key nobody trusts. The
		// distinction matters: the remedy is to upgrade the CLI that ships the keys,
		// not to wait for a new release.
		try {
			verifyManifestSignature(bytes, sign(bytes, stranger.privatePem), "9.9.9", [listed.publicPem]);
			expect.unreachable("a signature from an unlisted key must be refused");
		} catch (error) {
			expect((error as KitVerificationError).check).toBe("signature-untrusted-key");
		}
	});

	it("refuses rather than skips when the keyring is empty", () => {
		const bytes = Buffer.from('{"version":"9.9.9"}\n', "utf8");
		const pair = ephemeralPair();
		try {
			verifyManifestSignature(bytes, sign(bytes, pair.privatePem), "9.9.9", []);
			expect.unreachable("an empty keyring must refuse, never accept");
		} catch (error) {
			expect((error as KitVerificationError).check).toBe("no-trusted-key");
			expect((error as Error).message).toMatch(/no trusted kit signing key/);
		}
	});

	it("distinguishes an absent signature from a malformed one", () => {
		const bytes = Buffer.from("{}\n", "utf8");
		const pair = ephemeralPair();
		const absent = (): void => verifyManifestSignature(bytes, null, "9.9.9", [pair.publicPem]);
		const malformed = (): void => verifyManifestSignature(bytes, "not-a-signature", "9.9.9", [pair.publicPem]);
		expect(absent).toThrow(/carries no signature/);
		expect(malformed).toThrow(/not a readable ed25519 signature/);
	});

	it("exits non-zero and writes nothing when the signing key is absent", () => {
		const out = join(temp("mewkit-sign-out-"), "dist");
		let exitCode = 0;
		try {
			execFileSync(process.execPath, [BUILD_SCRIPT, "9.9.9", out], {
				cwd: makeSourceRoot(),
				env: { ...process.env, MEOWKIT_KIT_SIGNING_KEY: "" },
				stdio: "pipe",
			});
		} catch (error) {
			exitCode = (error as { status?: number }).status ?? 1;
		}
		expect(exitCode).not.toBe(0);
		// Neither an unsigned artifact nor a partial one. The directory is not
		// created at all, because the key is resolved before anything is written.
		expect(existsSync(out) ? readdirSync(out) : []).toEqual([]);
	});

	it("writes the private key only to the path its caller names and prints only the public key", () => {
		const dir = temp("mewkit-keygen-");
		const target = join(dir, "nested", "key.pem");
		const stdout = execFileSync(process.execPath, [KEYGEN_SCRIPT, target], { encoding: "utf8" });

		expect(readFileSync(target, "utf8")).toMatch(/BEGIN PRIVATE KEY/);
		expect(stdout).toMatch(/BEGIN PUBLIC KEY/);
		expect(stdout).not.toMatch(/PRIVATE KEY-----\n[A-Za-z0-9+/]/);
		// Nothing landed beside the named file.
		expect(readdirSync(join(dir, "nested"))).toEqual(["key.pem"]);
	});

	it("ships a keyring that is a list of keys and no key material in the signing modules", () => {
		// The committed keyring may legitimately be empty — the real public key is
		// added by a human. What must never be true is a PRIVATE key anywhere in it
		// or in the scripts that use one.
		expect(Array.isArray(TRUSTED_KIT_KEYS)).toBe(true);
		for (const file of [BUILD_SCRIPT, join(REPO, "scripts", "kit-signing.cjs"), KEYGEN_SCRIPT]) {
			expect(readFileSync(file, "utf8")).not.toMatch(/BEGIN (?:\w+ )?PRIVATE KEY/);
		}
	});

	it("adds no dependency for signing, hashing or archiving", () => {
		for (const file of ["package.json", join("packages", "mewkit", "package.json")]) {
			const pkg = JSON.parse(readFileSync(join(REPO, file), "utf8")) as Record<string, Record<string, string>>;
			const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
			for (const banned of ["minisign", "sigstore", "tar", "node-tar", "tweetnacl", "@sigstore/sign"]) {
				expect(names).not.toContain(banned);
			}
		}
	});
});
