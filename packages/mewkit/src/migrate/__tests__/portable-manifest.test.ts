import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	filterApplicableManifestEntries,
	loadPortableEvolutionManifest,
	resolvePortableManifestPath,
	type PortableEvolutionManifest,
} from "../reconcile/portable-manifest.js";

// The real shipped manifest lives at packages/mewkit/portable-manifest.json,
// four levels up from this test file (src/migrate/__tests__).
const SHIPPED_MANIFEST_PATH = fileURLToPath(new URL("../../../portable-manifest.json", import.meta.url));

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

	it("ships a schema-valid manifest recording the Codex rules path migration", async () => {
		// Guards the real published packages/mewkit/portable-manifest.json against
		// schema drift or a typo in the shipped data (the loader re-validates it).
		const manifest = await loadPortableEvolutionManifest(dirname(SHIPPED_MANIFEST_PATH), {});

		expect(manifest).not.toBeNull();

		const codexRulesMigration = manifest?.providerPathMigrations.find(
			(entry) => entry.provider === "codex" && entry.type === "rules",
		);
		expect(codexRulesMigration).toEqual({
			provider: "codex",
			type: "rules",
			from: ".codex/rules",
			to: "AGENTS.md",
			since: "1.14.0",
		});
	});

	it("ships the api-design skill rename so an upgrade cleans up the retired directory", async () => {
		const manifest = await loadPortableEvolutionManifest(dirname(SHIPPED_MANIFEST_PATH), {});

		expect(manifest?.renames).toContainEqual({
			from: "skills/api-design",
			to: "skills/api-design-principles",
			type: "skill",
			since: "2.3.1",
		});
	});

	it("every shipped entry is applicable at the manifest's own version", async () => {
		// The real invariant behind `isEntryApplicable`: an entry whose `since` is AHEAD of
		// the manifest version is filtered out and silently never applied. Checking every
		// entry catches that, where pinning one entry's `since` to the manifest version only
		// ever described the manifest at the moment it had a single entry.
		const manifest = await loadPortableEvolutionManifest(dirname(SHIPPED_MANIFEST_PATH), {});
		const entries = [
			...(manifest?.renames ?? []),
			...(manifest?.providerPathMigrations ?? []),
			...(manifest?.sectionRenames ?? []),
		];
		expect(entries.length).toBeGreaterThan(0);

		const applicable = filterApplicableManifestEntries(manifest!, {});
		const applicableCount =
			applicable.renames.length + applicable.providerPathMigrations.length + applicable.sectionRenames.length;
		expect(applicableCount).toBe(entries.length);
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
