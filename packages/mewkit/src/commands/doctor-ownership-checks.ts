// What `doctor` says about what the kit owns: per-class drift, the local kit
// cache, and the one place a density setting is NOT what a user expects.
//
// The cache rows exist because `uninstall` refuses without a usable cache, and a
// refusal whose cause is only visible inside that command is a dead end. Here
// the cause is a finding with `mewkit upgrade` named as the re-fetch.
import { existsSync } from "node:fs";
import { join } from "node:path";

import { loadConfigFile, projectConfigPath } from "../config/load-config.js";
import { observerNames } from "../config/observer-names.js";
import { CACHE_REL } from "../core/kit-cache.js";
import { assessCache } from "../core/kit-cache-trust.js";
import { classifyInstall } from "../core/ownership-classify.js";
import type { DiagResult } from "./doctor-checks.js";

/** Per-class drift counts, so an upgrade's blast radius is readable up front. */
export function checkDrift(root: string | null): DiagResult {
	const name = "Install drift";
	if (!root) return { name, status: "warn", detail: "Skipped — no project" };
	if (!existsSync(join(root, ".claude")))
		return { name, status: "warn", detail: "No .claude/ — nothing is installed here." };

	const c = classifyInstall(root);
	if (!c.hasBaseline) {
		return {
			name,
			status: "warn",
			detail: "No ownership baseline, so drift cannot be computed.",
			fix: "mewkit doctor --adopt — it rebuilds the baseline from the local kit cache",
		};
	}
	const count = (cls: string): number => c.paths.filter((p) => p.class === cls).length;
	const detail = `clean ${count("clean")}, modified ${count("modified")}, orphan ${count("orphan")}, missing ${count("missing")}, refused ${count("refused")}`;
	const dirty = count("modified") + count("orphan") + count("missing");
	return {
		name,
		status: dirty === 0 ? "pass" : "warn",
		detail,
		fix:
			dirty === 0
				? undefined
				: "mewkit uninstall (preview) lists each file by class; mewkit upgrade re-lays kit files that are still pristine",
	};
}

/** Whether the trusted kit source is usable, and what to run when it is not. */
export function checkKitCache(root: string | null): DiagResult {
	const name = "Local kit cache";
	if (!root) return { name, status: "warn", detail: "Skipped — no project" };

	const c = classifyInstall(root);
	const verdict = c.hasBaseline ? c.cache : assessCache(root, null);
	if (verdict.state === "ok") {
		return {
			name,
			status: "pass",
			detail: `${CACHE_REL} holds kit ${verdict.cachedVersion ?? "?"}, which is what this install records.`,
		};
	}
	return {
		name,
		status: "warn",
		detail: verdict.reason,
		fix: "mewkit upgrade — it re-fetches the kit and rewrites the cache; until then uninstall and doctor --adopt refuse rather than guess",
	};
}

/**
 * The one disclosure a density setting owes the user.
 *
 * `autobuild.mode: LEAN` in the project config sets density and NOTHING else —
 * it does not bypass the sprint-contract gate, which reads the environment only.
 * A user who sets it and then hits a contract block would have no way to connect
 * the two, so the gap is stated here rather than discovered.
 */
export function checkAutobuildModeDisclosure(root: string | null): DiagResult[] {
	if (!root) return [];
	const file = projectConfigPath(root);
	if (!existsSync(file)) return [];
	const result = loadConfigFile(file, observerNames(root), "project config");
	if (!result.ok) return [];
	const mode = result.values["autobuild.mode"];
	if (mode === undefined) return [];
	return [
		{
			name: "autobuild.mode in the project config",
			status: "pass",
			detail: `autobuild.mode is ${String(mode)}. It sets DENSITY only: the sprint-contract gate reads the environment, so a committed value — LEAN included — does not bypass it.`,
			fix: "export MEOWKIT_AUTOBUILD_MODE for a session that must bypass the contract gate; a committed file deliberately cannot",
		},
	];
}

export function ownershipChecks(root: string | null): DiagResult[] {
	return [checkDrift(root), checkKitCache(root), ...checkAutobuildModeDisclosure(root)];
}
