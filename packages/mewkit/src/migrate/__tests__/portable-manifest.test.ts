import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	filterApplicableManifestEntries,
	loadPortableEvolutionManifest,
	resolvePortableManifestPath,
	type PortableEvolutionManifest,
} from "../reconcile/portable-manifest.js";

function makeManifest(overrides: Partial<PortableEvolutionManifest> = {}): PortableEvolutionManifest {
	return {
		version: "1.0",
		mewkitVersion: "1.10.0",
		renames: [],
		providerPathMigrations: [],
		sectionRenames: [],
		...overrides,
	};
}

async function writeManifest(root: string, content: unknown): Promise<string> {
	await mkdir(join(root, ".claude"), { recursive: true });
	const manifestPath = join(root, "portable-manifest.json");
	await writeFile(manifestPath, JSON.stringify(content), "utf-8");
	return manifestPath;
}

describe("portable evolution manifest", () => {
	it("returns null when no manifest is present", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-portable-manifest-"));
		await mkdir(join(root, ".claude"), { recursive: true });

		await expect(loadPortableEvolutionManifest(join(root, ".claude"), {})).resolves.toBeNull();
	});

	it("loads a valid manifest next to the bundled .claude directory", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-portable-manifest-"));
		await writeManifest(root, makeManifest());

		const manifest = await loadPortableEvolutionManifest(join(root, ".claude"), {});

		expect(manifest?.mewkitVersion).toBe("1.10.0");
		expect(resolvePortableManifestPath(join(root, ".claude"))).toBe(join(root, "portable-manifest.json"));
	});

	it("fails closed on invalid JSON", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-portable-manifest-"));
		await mkdir(join(root, ".claude"), { recursive: true });
		await writeFile(join(root, "portable-manifest.json"), "{", "utf-8");

		await expect(loadPortableEvolutionManifest(join(root, ".claude"), {})).rejects.toThrow(
			"Invalid portable-manifest.json",
		);
	});

	it("rejects unknown fields and unsafe paths", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-portable-manifest-"));
		await writeManifest(root, {
			...makeManifest({
				renames: [{ from: "../skills/old", to: "skills/new", type: "skill", since: "1.10.0" }],
			}),
			extra: true,
		});

		await expect(loadPortableEvolutionManifest(join(root, ".claude"), {})).rejects.toThrow(
			"portable-manifest.json schema mismatch",
		);
	});

	it("filters entries already applied by registry version", () => {
		const manifest = makeManifest({
			mewkitVersion: "1.10.0",
			renames: [
				{ from: "agents/old.md", to: "agents/new.md", type: "agent", since: "1.9.0" },
				{ from: "commands/old.md", to: "commands/new.md", type: "command", since: "1.10.0" },
			],
		});

		const filtered = filterApplicableManifestEntries(manifest, { appliedManifestVersion: "1.9.0" });

		expect(filtered.renames).toEqual([
			{ from: "commands/old.md", to: "commands/new.md", type: "command", since: "1.10.0" },
		]);
	});
});
