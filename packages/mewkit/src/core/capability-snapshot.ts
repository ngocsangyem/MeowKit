// Provider projections need the same semantic manifest as a `.claude/` install, but must not
// depend on that source tree remaining present. A snapshot is data-only: provider-native
// invocation remains owned by trusted adapter constants.
import fs from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { buildCapabilities } from "./build-capabilities.js";
import {
	CapabilityManifestSchema,
	KNOWN_INVOCATION_IDS,
	type CapabilityEntry,
	type CapabilityManifest,
} from "./capability.js";

export const CODEX_CAPABILITY_SNAPSHOT_FILENAME = "capabilities.json";

export interface CapabilitySource {
	kind: "claude-directory" | "codex-snapshot";
	path: string;
	entries: CapabilityEntry[];
}

export function capabilityManifestFromClaude(claudeDir: string): CapabilityManifest {
	return { schemaVersion: "1.0", entries: buildCapabilities(claudeDir) };
}

function validateSnapshot(manifest: CapabilityManifest, snapshotPath: string): CapabilityEntry[] {
	for (const entry of manifest.entries) {
		if (!KNOWN_INVOCATION_IDS.has(entry.invocation.id)) {
			throw new Error(
				`Capability snapshot at ${snapshotPath} contains unknown invocation id for ${entry.id}. Regenerate it with \`npx mewkit migrate codex\`.`,
			);
		}
	}
	return manifest.entries;
}

export function readCapabilitySnapshot(snapshotPath: string): CapabilityEntry[] {
	let raw: unknown;
	try {
		raw = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		throw new Error(
			`Could not read capability snapshot at ${snapshotPath}: ${detail}. Regenerate it with \`npx mewkit migrate codex\`.`,
		);
	}
	const parsed = CapabilityManifestSchema.safeParse(raw);
	if (!parsed.success) {
		throw new Error(
			`Capability snapshot at ${snapshotPath} is invalid: ${parsed.error.issues[0]?.message ?? "schema validation failed"}. Regenerate it with \`npx mewkit migrate codex\`.`,
		);
	}
	return validateSnapshot(parsed.data, snapshotPath);
}

/** Source preference is intentional: a live `.claude/` installation is canonical; a Codex
 * snapshot is only the portable projection when that source surface is absent. */
export function findCapabilitySource(cwd = process.cwd()): CapabilitySource | null {
	const claudeDir = path.join(cwd, ".claude");
	if (fs.existsSync(claudeDir) && fs.statSync(claudeDir).isDirectory()) {
		return { kind: "claude-directory", path: claudeDir, entries: buildCapabilities(claudeDir) };
	}

	const projectSnapshot = path.join(cwd, ".codex", CODEX_CAPABILITY_SNAPSHOT_FILENAME);
	if (fs.existsSync(projectSnapshot)) {
		return { kind: "codex-snapshot", path: projectSnapshot, entries: readCapabilitySnapshot(projectSnapshot) };
	}

	const globalSnapshot = path.join(homedir(), ".codex", CODEX_CAPABILITY_SNAPSHOT_FILENAME);
	if (fs.existsSync(globalSnapshot)) {
		return { kind: "codex-snapshot", path: globalSnapshot, entries: readCapabilitySnapshot(globalSnapshot) };
	}
	return null;
}
