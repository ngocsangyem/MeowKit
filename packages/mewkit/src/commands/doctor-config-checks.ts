// What `doctor` says about the project config and about a shell that is still
// exporting a variable the config replaced.
//
// The second half is the interesting one. A setting that stops being read goes
// quiet by default: the shell keeps exporting it, nothing reads it, and the
// behaviour the user asked for simply does not happen. For a preference that is
// annoying; for an enforcement mode it is dangerous. So an exported name with no
// reader is a finding that names the replacement key and the file to edit, and
// the run exits non-zero — an error with a pointer, never a silent fallback.
import { existsSync } from "node:fs";
import { join, relative } from "node:path";

import { loadConfigFile, projectConfigPath } from "../config/load-config.js";
import { observerNames } from "../config/observer-names.js";
import { REMOVED_ENV_NAMES } from "../config/removed-env-names.js";
import { LEGACY_DESCRIPTOR_REL } from "../state/resolve-config-path.js";
import type { DiagResult } from "./doctor-checks.js";

const show = (root: string, file: string): string => relative(root, file) || file;

/**
 * The project config's validation result.
 *
 * A failure reports the file and, when the grammar is what failed, the line —
 * "invalid config" on its own leaves the user opening the file and guessing.
 * A project still carrying only the v2 descriptor is migration-pending rather
 * than misconfigured, and the next action is named.
 */
export function checkProjectConfig(root: string | null): DiagResult {
	const name = "Project config";
	if (!root) return { name, status: "warn", detail: "Skipped — no project" };

	const file = projectConfigPath(root);
	const legacy = join(root, LEGACY_DESCRIPTOR_REL);

	if (!existsSync(file)) {
		if (existsSync(legacy)) {
			return {
				name,
				status: "warn",
				detail: `${show(root, legacy)} is the v2 descriptor and ${show(root, file)} does not exist yet — migration pending.`,
				fix: "mewkit upgrade — it snapshots the old file, carries every value that has an equivalent across, and names the ones that do not",
			};
		}
		return {
			name,
			status: "pass",
			detail: `${show(root, file)} absent — every setting is at its default.`,
		};
	}

	const result = loadConfigFile(file, observerNames(root), "project config");
	if (result.ok) {
		const count = Object.keys(result.values).filter((k) => k !== "$schema").length;
		return { name, status: "pass", detail: `${show(root, file)} valid — ${count} key(s) set.` };
	}
	// The loader prefixes its own message with the absolute path, which is right
	// for a message read on its own and redundant under a line that already says
	// where. Said twice, the second one reads as a second problem — so the same
	// `:line` suffix builds both the heading and the prefix being stripped.
	const at = result.error.line === undefined ? "" : `:${result.error.line}`;
	const where = `${show(root, file)}${at}`;
	const subject = result.error.key === undefined ? "" : ` (${result.error.key})`;
	const absolute = `${file}${at}: `;
	const why = result.error.message.startsWith(absolute)
		? result.error.message.slice(absolute.length)
		: result.error.message;
	return {
		name,
		status: "fail",
		detail: `${where}${subject}: ${why} [${result.error.code}]`,
		fix: result.error.fix,
	};
}

/**
 * One finding per environment name the shell still exports and nothing reads.
 *
 * `.meowkit/.env` is not consulted: the question is what this session's
 * environment actually carries, and a name a file sets but the shell never
 * exported is not affecting this session.
 */
export function checkRemovedEnvNames(root: string | null, env: NodeJS.ProcessEnv = process.env): DiagResult[] {
	const configFile = root === null ? ".meowkit/config.yaml" : show(root, projectConfigPath(root));
	const findings: DiagResult[] = [];
	for (const removed of REMOVED_ENV_NAMES) {
		const value = env[removed.name];
		if (value === undefined || value === "") continue;
		const replaced = removed.replacement !== "";
		findings.push({
			name: `Removed setting: ${removed.name}`,
			status: "fail",
			detail: replaced
				? `${removed.name} is exported in this shell and nothing reads it. The setting moved to ${removed.replacement} in ${configFile}, so the exported value is being ignored.`
				: `${removed.name} is exported in this shell and nothing reads it. Nothing replaced it — the behaviour it selected is gone.`,
			fix: replaced
				? `set ${removed.replacement} in ${configFile}, then unset ${removed.name} in your shell profile`
				: `unset ${removed.name} in your shell profile`,
		});
	}
	return findings;
}
