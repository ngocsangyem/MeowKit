// The `migrate` entry point's way into the one projection.
//
// An export has already written the converter's output by the time this runs, so
// the authored bundle goes on top in overlay mode: only the entries the bundle
// marks active, overwriting machine-generated output rather than preserving it.
// The alternative — letting `migrate` write its own version of the target's
// authored shape — is a second definition of that shape, and the two would drift
// until `migrate codex` and `init --target codex` produced different trees.
//
// A missing bundle is reported as "nothing to overlay" rather than raised. An
// export to several providers must not abort for all of them because one
// provider's bundle is absent from this install; the per-target install paths
// fail closed instead, where there is only one provider to fail.
import { existsSync } from "node:fs";
import { join } from "node:path";

import type { InstallTarget } from "../commands/init-target-delivery.js";
import type { ApplyBundleResult } from "../migrate/modules/codex-reconcile-apply.js";
import { resolveCodexModuleDir } from "../migrate/modules/codex-authored-bundle.js";
import { resolveCursorModuleDir } from "../migrate/modules/cursor-authored-bundle.js";
import { emitCodexTarget, emitCursorTarget } from "./emit-bundle-target.js";

type ExternalTarget = Extract<InstallTarget, "codex" | "cursor">;

const moduleDirFor = (target: ExternalTarget): string =>
	target === "codex" ? resolveCodexModuleDir() : resolveCursorModuleDir();

/**
 * Overlay one external target's authored bundle onto an export, or null when
 * this install ships no bundle for it.
 */
export async function emitActiveOverlay(
	target: ExternalTarget,
	scopeRoot: string,
	global: boolean,
	/** Bundle directory override, for a caller holding a fixture bundle. */
	moduleDirOverride?: string,
): Promise<ApplyBundleResult | null> {
	const moduleDir = moduleDirOverride ?? moduleDirFor(target);
	if (!existsSync(join(moduleDir, "manifest.json"))) return null;
	const emit = target === "codex" ? emitCodexTarget : emitCursorTarget;
	return emit("migrate", scopeRoot, moduleDir, { overlay: true, global });
}
