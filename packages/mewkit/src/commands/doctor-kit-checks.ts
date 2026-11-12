// What `doctor` says about the kit's delivery: a baseline that has not been
// carried forward yet, and a project that carries two deliveries at once.
//
// A project whose ownership record is still the superseded file is owned, not
// unowned. Reporting it as unowned would send the user to adoption, which
// rebuilds a baseline it already has.
import { existsSync } from "node:fs";
import { join } from "node:path";

import { hasLegacyManifest, migrationPendingMessage } from "../core/legacy-manifest-migration.js";
import type { DiagResult } from "./doctor-checks.js";

/** Whether this project's ownership baseline still needs carrying forward. */
export function checkBaselineMigration(root: string | null): DiagResult {
	const name = "Ownership record";
	if (!root) return { name, status: "warn", detail: "Skipped — no project" };
	const claudeDir = join(root, ".claude");
	if (!existsSync(claudeDir)) return { name, status: "warn", detail: "No .claude/ — nothing is installed here." };
	if (!hasLegacyManifest(claudeDir)) {
		return { name, status: "pass", detail: "Canonical, with no superseded baseline left behind." };
	}
	return {
		name,
		status: "warn",
		detail: migrationPendingMessage(),
		fix: "mewkit upgrade — it snapshots first, carries the baseline forward, then retires the old file",
	};
}

/** Whether a project carries a native and a plugin install at the same time. */
export function checkMixedDelivery(root: string | null): DiagResult {
	const name = "Delivery shape";
	if (!root) return { name, status: "warn", detail: "Skipped — no project" };
	const hasNative = existsSync(join(root, ".claude", "skills"));
	const hasPlugin = existsSync(join(root, ".claude-plugin", "plugin.json"));
	if (!hasNative || !hasPlugin) {
		return { name, status: "pass", detail: hasPlugin ? "Plugin delivery." : "Native delivery." };
	}
	// Not repaired here. Which of the two the user meant to keep is a decision
	// about their project, and a guess that removes the wrong one destroys work
	// no snapshot taken by this command would cover.
	return {
		name,
		status: "fail",
		detail:
			"This project carries BOTH a native install (.claude/skills/) and a plugin install (.claude-plugin/plugin.json). " +
			"Two deliveries of the same kit means every skill, agent and hook is defined twice, and which one runs is not decided by anything you control.",
		fix: "Remove the delivery you do not want, then run `mewkit upgrade` to re-lay the one you keep. This command will not choose for you.",
	};
}
