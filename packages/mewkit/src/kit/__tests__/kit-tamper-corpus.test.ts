// Ten tamper shapes, ten refusals, and nothing written outside quarantine for
// any of them.
//
// The destination tree is hashed before and after every attempt and required to
// be byte-identical. That is what makes "verify before extract" a property of
// the code rather than a claim about it: a reordering that checked digests after
// writing would still refuse, and still fail this.
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { FAILURE_RECORD_FILENAME, quarantineDir } from "../kit-quarantine.js";
import type { KitCheck } from "../kit-refusal.js";
import { KitVerificationError } from "../kit-refusal.js";
import { installFromArtifact } from "../resolve-kit-content.js";
import type { KitArtifactBytes } from "../verify-kit-artifact.js";
import type { CraftedMember } from "../../../tests/helpers/craft-kit-bundle.js";
import {
	craftKitBundle,
	ephemeralKitKeys,
	flipOneBit,
	resignBundle,
	sha256,
	signBytes,
} from "../../../tests/helpers/craft-kit-bundle.js";

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

const trusted = ephemeralKitKeys();
const KEYS = [trusted.publicPem];
const makeBundle = (members: CraftedMember[]): KitArtifactBytes => craftKitBundle(members, VERSION, trusted.privatePem);

const GOOD: CraftedMember[] = [
	{ name: ".claude/rules/a.md", body: "alpha\n" },
	{ name: ".claude/rules/b.md", body: "beta\n" },
];

/** A content hash of the whole destination tree, so a single byte shows up. */
function treeHash(dir: string): string {
	if (!existsSync(dir)) return "absent";
	const parts: string[] = [];
	const walk = (current: string, rel: string): void => {
		for (const name of readdirSync(current).sort()) {
			const full = join(current, name);
			if (statSync(full).isDirectory()) walk(full, `${rel}/${name}`);
			else parts.push(`${rel}/${name}:${sha256(readFileSync(full))}`);
		}
	};
	walk(dir, "");
	return sha256(Buffer.from(parts.join("\n"), "utf8"));
}

/** The ten variants, each with the check it must be refused by. */
function variants(): Array<{ name: string; check: KitCheck; bytes: KitArtifactBytes }> {
	const good = makeBundle(GOOD);
	const manifest = JSON.parse(good.manifestBytes.toString("utf8")) as {
		files: Array<{ path: string; sha256: string; size: number }>;
	};

	const perFileMismatch = structuredClone(manifest) as typeof manifest;
	perFileMismatch.files[0].sha256 = "0".repeat(64);

	const traversal = makeBundle([{ name: "../escaped.md", body: "x\n" }]);
	const absolute = makeBundle([{ name: "/etc/escaped.md", body: "x\n" }]);
	const symlink = makeBundle([...GOOD, { name: ".claude/link", body: "", typeFlag: "2", linkName: "../../outside" }]);

	return [
		{
			name: "a flipped bit in the artifact",
			check: "artifact-digest",
			bytes: { ...good, artifact: flipOneBit(good.artifact, good.artifact.length - 20) },
		},
		{
			name: "a flipped bit in the manifest",
			check: "signature-untrusted-key",
			bytes: { ...good, manifestBytes: flipOneBit(good.manifestBytes, 40) },
		},
		{
			name: "a signature from an unlisted key",
			check: "signature-untrusted-key",
			bytes: { ...good, signature: signBytes(good.manifestBytes, ephemeralKitKeys().privatePem) },
		},
		{
			name: "a truncated artifact",
			check: "artifact-digest",
			bytes: { ...good, artifact: good.artifact.subarray(0, good.artifact.length - 40) },
		},
		{
			name: "a truncated manifest",
			check: "signature-untrusted-key",
			bytes: { ...good, manifestBytes: good.manifestBytes.subarray(0, good.manifestBytes.length - 30) },
		},
		{ name: "a missing signature", check: "signature-absent", bytes: { ...good, signature: null } },
		{ name: "a member escaping via ..", check: "member-path-unsafe", bytes: traversal },
		{ name: "a member with an absolute path", check: "member-path-unsafe", bytes: absolute },
		{ name: "a symlink member pointing outside", check: "member-path-unsafe", bytes: symlink },
		{
			name: "an inner file that no longer matches its digest",
			check: "file-digest",
			bytes: resignBundle(
				good,
				Buffer.from(`${JSON.stringify({ ...manifest, files: perFileMismatch.files }, null, 2)}\n`, "utf8"),
				trusted.privatePem,
			),
		},
	];
}

describe("kit artifact tamper corpus", () => {
	it("installs the untampered bundle, so the refusals below are about the tampering", async () => {
		const root = temp("mewkit-tamper-ok-");
		const result = await installFromArtifact(root, VERSION, makeBundle(GOOD), "verified-artifact", KEYS);
		expect(readFileSync(join(result.sourceDir, ".claude", "rules", "a.md"), "utf8")).toBe("alpha\n");
	});

	for (const variant of variants()) {
		it(`refuses ${variant.name}, writing nothing outside quarantine`, async () => {
			const root = temp("mewkit-tamper-");
			const destination = join(root, "destination");
			mkdirSync(destination, { recursive: true });
			writeFileSync(join(destination, "untouched.md"), "pre-existing\n");
			const before = treeHash(destination);

			let thrown: unknown;
			try {
				await installFromArtifact(root, VERSION, variant.bytes, "verified-artifact", KEYS);
			} catch (error) {
				thrown = error;
			}

			expect(thrown).toBeInstanceOf(KitVerificationError);
			const refusal = thrown as KitVerificationError;
			expect(refusal.check).toBe(variant.check);
			// Names the failed check, what it was checking, and one next action.
			expect(refusal.message).toMatch(/was not installed/);
			expect(refusal.message).toMatch(/stopped rather than downgraded/);
			// No stack frame, internal class name, temp path or raw crypto string.
			expect(refusal.message).not.toMatch(/\bat \S+:\d+|KitVerificationError|\/var\/folders|\/tmp\//);

			expect(treeHash(destination)).toBe(before);
			// The one permitted write, and only inside quarantine: never an
			// extracted tree.
			const quarantine = quarantineDir(root, VERSION);
			expect(existsSync(quarantine) ? readdirSync(quarantine) : []).toEqual([FAILURE_RECORD_FILENAME]);
			const record = JSON.parse(readFileSync(join(quarantine, FAILURE_RECORD_FILENAME), "utf8")) as {
				version: string;
				check: string;
			};
			expect(record.version).toBe(VERSION);
			expect(record.check).toBe(variant.check);
		});
	}

	it("executes nothing from the artifact: an executable member is written, never run", async () => {
		const root = temp("mewkit-tamper-exec-");
		const canary = join(root, "canary-ran");
		const bundle = makeBundle([{ name: ".claude/scripts/canary.sh", body: `#!/usr/bin/env bash\ntouch ${canary}\n` }]);
		const result = await installFromArtifact(root, VERSION, bundle, "verified-artifact", KEYS);
		expect(existsSync(join(result.sourceDir, ".claude", "scripts", "canary.sh"))).toBe(true);
		expect(existsSync(canary)).toBe(false);
	});

	it("reaches the filesystem only through the module that verifies first", () => {
		// An external extractor decides for itself what a member path, a symlink or a
		// device entry means — and those are exactly the decisions the refusals above
		// depend on making here. Asserted on what the install path IMPORTS, because a
		// comment promising not to spawn anything is not a constraint.
		const reader = readFileSync(join(import.meta.dirname, "..", "kit-archive-reader.ts"), "utf8");
		const verifier = readFileSync(join(import.meta.dirname, "..", "verify-kit-artifact.ts"), "utf8");
		const imports = (source: string): string[] =>
			[...source.matchAll(/^import .*?from "([^"]+)";$/gm)].map((m) => m[1]);
		for (const module of [...imports(reader), ...imports(verifier)]) {
			expect(module).not.toMatch(/child_process|node:vm|node:module/);
		}
		// Nor by any other route into a subprocess.
		for (const source of [reader, verifier]) {
			expect(source).not.toMatch(/execFileSync?\(|execSync\(|spawnSync?\(|createRequire\(|eval\(/);
		}
	});
});
