// What `doctor` says about the kit's delivery: a baseline that has not been
// carried forward yet, and a version that cannot be installed at all.
//
// Both exist because the cause is otherwise only visible inside the command
// that fails. A project whose ownership record is still the superseded file is
// owned, not unowned — reporting it as unowned would send the user to adoption,
// which rebuilds a baseline it already has. And a version whose artifact failed
// verification blocks every install of that version until a new release is cut;
// told only "download failed", the user retries forever.
//
// The blocked-version row reads the record a refused attempt left in the project
// and NOTHING else. No request is made: a diagnostic that reaches the network to
// explain a failure is a diagnostic that cannot run where the failure happened.
import { existsSync } from "node:fs";
import { join } from "node:path";

import { hasLegacyManifest, migrationPendingMessage } from "../core/legacy-manifest-migration.js";
import { listVerificationFailures } from "../kit/kit-quarantine.js";
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

/** Any version this project tried to install and refused, read with no network. */
export function checkRefusedVersions(root: string | null): DiagResult {
	const name = "Kit verification";
	if (!root) return { name, status: "warn", detail: "Skipped — no project" };
	const failures = listVerificationFailures(root);
	if (failures.length === 0) {
		return { name, status: "pass", detail: "No refused kit version recorded in this project." };
	}
	const latest = failures[0];
	return {
		name,
		status: "fail",
		detail: `${latest.message} Kit ${latest.version} cannot be installed in this project until a new release is published.`,
		fix: "Wait for a new release, then run `mewkit upgrade`. Re-running this version will refuse again.",
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
