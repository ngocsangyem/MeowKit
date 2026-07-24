import fs from "node:fs";
import path from "node:path";
import type { CheckResult } from "../../commands/validate.js";
import type { TargetProfile } from "./target-profile.js";
import { meowkitStatePaths } from "../../state/meowkit-state-paths.js";

// Post-install quality gate for a GENERATED Cursor project. Read-only. Validates the target's
// own artifacts only. This phase's authored bundle is a minimal skeleton (AGENTS.md +
// `.meowkit/README.md`), so the checks are deliberately narrow — richer structural checks
// (native agents, hooks, rules, skills) land alongside that content in later phases, mirroring
// how codex-target.ts grew with the codex bundle.

const SECTION = "Target" as const;
function pass(name: string, detail: string): CheckResult {
	return { name, status: "pass", detail, section: SECTION };
}
function fail(name: string, detail: string): CheckResult {
	return { name, status: "fail", detail, section: SECTION };
}

export const cursorTargetProfile: TargetProfile = {
	name: "cursor",
	detect(dir: string): boolean {
		// The authored marker is the cursor reconciliation ledger — the one artifact that
		// distinguishes an authored install from a bare `.cursor/` (e.g. legacy-converter
		// output, or a project that only has user-authored `.cursor/rules`). AGENTS.md alone
		// is not a safe signal here: the Codex bundle also installs a root `AGENTS.md`.
		return fs.existsSync(meowkitStatePaths(path.join(dir, ".meowkit")).cursorLedger);
	},
	async check(dir: string): Promise<CheckResult[]> {
		const results: CheckResult[] = [];
		results.push(
			fs.existsSync(path.join(dir, "AGENTS.md"))
				? pass("Cursor AGENTS.md present", "instruction surface exists")
				: fail("Cursor AGENTS.md present", `Missing: ${path.join(dir, "AGENTS.md")}`),
		);
		results.push(
			fs.existsSync(path.join(dir, ".meowkit", "README.md"))
				? pass("Cursor .meowkit/README.md present", "state-directory pointer exists")
				: fail("Cursor .meowkit/README.md present", `Missing: ${path.join(dir, ".meowkit", "README.md")}`),
		);
		const ledgerPath = meowkitStatePaths(path.join(dir, ".meowkit")).cursorLedger;
		results.push(
			fs.existsSync(ledgerPath)
				? pass("Cursor reconciliation ledger present", "authored-install marker exists")
				: fail("Cursor reconciliation ledger present", `Missing: ${ledgerPath}`),
		);
		return results;
	},
};
