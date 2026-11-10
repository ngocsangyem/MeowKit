// A member's path is recorded in two fixed-width ustar fields that are NOT
// NUL-terminated when full, and the archive is what the manifest is derived
// from — so a path shortened by one byte on its way into the header is the path
// that gets hashed, listed and signed. Verification would then pass on an
// artifact that installs one file at the wrong path and leaves the right path
// missing, which is the failure the writer's refusal is supposed to prevent.
//
// The boundary is pinned in its own file because the longest path the kit ships
// today is 90 bytes: nothing else in the suite would notice it moving, and
// nothing here needs the signing key or the release fixtures the build tests do.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { readKitArchive } from "../kit-archive-reader.js";
// The writer under test, through the same reader the install uses: a round-trip
// is only meaningful if the two agree.
import { buildTar, gzipDeterministic } from "../../../../../scripts/kit-tar-writer.cjs";

const roots: string[] = [];
afterAll(() => {
	for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function temp(prefix: string): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	roots.push(dir);
	return dir;
}

describe("member path length", () => {
	/** A file at `root` whose repo-relative path is exactly `bytes` long. */
	function fileOfPathLength(root: string, bytes: number): string {
		const head = ".claude/skills/";
		const ext = ".md";
		const name = head + "a".repeat(bytes - head.length - ext.length) + ext;
		expect(Buffer.byteLength(name)).toBe(bytes);
		const abs = join(root, name);
		mkdirSync(dirname(abs), { recursive: true });
		writeFileSync(abs, "member body\n");
		return name;
	}

	function roundTrip(name: string, root: string): string {
		return readKitArchive(gzipDeterministic(buildTar(root, [name]))).members[0].path;
	}

	for (const bytes of [99, 100, 101]) {
		it(`round-trips a ${bytes}-byte path exactly`, () => {
			const root = temp("mewkit-kit-name-");
			const name = fileOfPathLength(root, bytes);
			expect(roundTrip(name, root)).toBe(name);
		});
	}

	it("round-trips a path long enough to need the prefix field", () => {
		const root = temp("mewkit-kit-name-split-");
		// Split across prefix and name: the separator is not stored, so this is
		// representable even though it exceeds the 100-byte name field.
		const name = `.claude/skills/${"d".repeat(80)}/${"b".repeat(90)}.md`;
		expect(Buffer.byteLength(name)).toBeGreaterThan(100);
		const abs = join(root, name);
		mkdirSync(dirname(abs), { recursive: true });
		writeFileSync(abs, "member body\n");
		expect(roundTrip(name, root)).toBe(name);
	});

	it("refuses a path with no legal split point rather than shortening it", () => {
		const root = temp("mewkit-kit-name-long-");
		// Over the name field with no `/` that would leave a legal base, so ustar
		// cannot represent it at all.
		const name = `.claude/${"z".repeat(140)}.md`;
		const abs = join(root, name);
		mkdirSync(dirname(abs), { recursive: true });
		writeFileSync(abs, "member body\n");
		expect(() => buildTar(root, [name])).toThrow(/too long for ustar/);
	});

	it("refuses a component that overflows its field rather than shortening it", () => {
		const root = temp("mewkit-kit-name-over-");
		// A base longer than the name field, reached through a legal prefix.
		const name = `.claude/skills/${"c".repeat(110)}.md`;
		const abs = join(root, name);
		mkdirSync(dirname(abs), { recursive: true });
		writeFileSync(abs, "member body\n");
		expect(() => buildTar(root, [name])).toThrow(/too long for ustar/);
	});
});
