// Short names for the two authored-bundle calls the commands make, so each call
// site reads as "lay this target down" rather than as eight option lines.
//
// They exist to keep the projection the ONLY way in. A call site that had to
// spell out the whole request every time would eventually spell one of them
// differently, and `init` and `upgrade` would stop agreeing about what a Codex
// install is — which is exactly the divergence the one projection prevents.
import type { PackSelection } from "../migrate/modules/codex-skill-packs.js";
import type { ApplyBundleResult } from "../migrate/modules/codex-reconcile-apply.js";
import { emitTarget } from "./emit-target.js";
import type { EmitEntryPoint } from "./target-shape.js";
import type { InstallTarget } from "../commands/init-target-delivery.js";

export interface BundleEmitOptions {
	force?: boolean;
	dryRun?: boolean;
	global?: boolean;
	packs?: PackSelection;
	/** Apply only the entries the bundle marks active, overwriting converter output. */
	overlay?: boolean;
}

async function emitBundle(
	target: InstallTarget,
	entryPoint: EmitEntryPoint,
	projectRoot: string,
	moduleDir: string,
	options: BundleEmitOptions,
): Promise<ApplyBundleResult> {
	const result = await emitTarget({
		target,
		delivery: "native",
		entryPoint,
		projectRoot,
		moduleDir,
		...options,
	});
	if (result.bundle === undefined) {
		throw new Error(`The projection produced no ${target} bundle result.`);
	}
	return result.bundle;
}

/** Lay down the Codex shape. */
export const emitCodexTarget = (
	entryPoint: EmitEntryPoint,
	projectRoot: string,
	moduleDir: string,
	options: BundleEmitOptions = {},
): Promise<ApplyBundleResult> => emitBundle("codex", entryPoint, projectRoot, moduleDir, options);

/** Lay down the Cursor shape. */
export const emitCursorTarget = (
	entryPoint: EmitEntryPoint,
	projectRoot: string,
	moduleDir: string,
	options: BundleEmitOptions = {},
): Promise<ApplyBundleResult> => emitBundle("cursor", entryPoint, projectRoot, moduleDir, options);
