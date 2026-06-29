import fs from "node:fs";
import path from "node:path";
import type { InventoryRegistrar } from "../application/ports.js";

// Registers wiki harness artifacts into .claude/harness-inventory.json under an existing
// taxonomy value. The wiki IS long-term project memory, so it reuses "project-memory" — no
// new taxonomy enum value is needed (decided, not assumed). Idempotent: re-registering the
// same path is a no-op, so `mewkit inventory --substrate` shows no drift on repeat runs.

/** The wiki serves the existing "project-memory" responsibility (see core/substrate.ts TAXONOMY). */
export const WIKI_RESPONSIBILITY = "project-memory";

interface InventoryFile {
	schema_version: number;
	artifacts: Record<string, Record<string, unknown>>;
}

export class InventoryAdapter implements InventoryRegistrar {
	constructor(private readonly claudeDir: string) {}

	private file(): string {
		return path.join(this.claudeDir, "harness-inventory.json");
	}

	register(artifactPath: string, meta: { criticality?: string; status?: string } = {}): void {
		const file = this.file();
		if (!fs.existsSync(file)) return; // no registry in this tree — nothing to tag
		let parsed: InventoryFile;
		try {
			parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as InventoryFile;
		} catch {
			return; // tolerant: a malformed registry is not this adapter's to repair
		}
		if (!parsed.artifacts || typeof parsed.artifacts !== "object") return;

		const desired = {
			owner: "lifecycle",
			criticality: meta.criticality ?? "medium",
			status: meta.status ?? "active",
			runtime: "portable",
			responsibility: WIKI_RESPONSIBILITY,
		};
		const existing = parsed.artifacts[artifactPath];
		if (existing && JSON.stringify(existing) === JSON.stringify(desired)) return; // idempotent

		parsed.artifacts[artifactPath] = desired;
		const tmp = file + ".tmp-" + process.pid;
		fs.writeFileSync(tmp, JSON.stringify(parsed, null, 2) + "\n", "utf-8");
		fs.renameSync(tmp, file);
	}
}
