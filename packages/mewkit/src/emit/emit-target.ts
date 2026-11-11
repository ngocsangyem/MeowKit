// The one projection from kit content to a target's on-disk shape.
//
// One projection, three entry points. `init`, `upgrade` and `migrate` all come
// through here, and none of them writes a target's shape itself any more. That
// is the whole point: three commands each calling their own writer agreed only
// because they happened to call the same one, and nothing would have noticed if
// one had drifted — a user would find out when an upgrade produced a different
// tree from the install that preceded it.
//
// Every passage is RECORDED, so "each command goes through the projection" is
// checkable rather than asserted. Comparing the three commands' outputs would
// not prove it: identical output is what two independent writers look like right
// up until the day one of them changes.
//
// What this does NOT decide: whether the request is sensible. The target and
// delivery pair is resolved and refused before anything gets here, so by this
// point the shape is known to exist.
import type { PackSelection } from "../migrate/modules/codex-skill-packs.js";
import type { SmartUpdateOptions } from "../core/smart-update.js";
// Through the barrel the commands already used, so the projection resolves the
// same module binding they did and a test that substitutes the updater still
// reaches the code under test rather than the real filesystem.
import { smartUpdate } from "../core/index.js";
import type { UpdateStats, UserConfig } from "../core/index.js";
import type { ApplyBundleResult } from "../migrate/modules/codex-reconcile-apply.js";
import { reconcileApplyCodexBundle } from "../migrate/modules/codex-reconcile-apply.js";
import { reconcileApplyCursorBundle } from "../migrate/modules/cursor-reconcile-apply.js";
import type { InstallDelivery, InstallTarget } from "../commands/init-target-delivery.js";
import { emitPluginDelivery } from "./emit-plugin-delivery.js";
import type { EmitEntryPoint } from "./target-shape.js";
import { TARGET_SHAPES } from "./target-shape.js";
import { assertNotMewkitNext } from "../commands/mewkit-next-ownership-guard.js";

export interface EmitRequest {
	target: InstallTarget;
	delivery: InstallDelivery;
	entryPoint: EmitEntryPoint;
	/** Where the target is laid down. The ledger and the plugin manifest resolve from it. */
	projectRoot: string;
	dryRun?: boolean;
	force?: boolean;
	global?: boolean;
	packs?: PackSelection;
	/**
	 * Overlay mode: apply only the entries the bundle marks active, overwriting
	 * machine-generated converter output. What `migrate` needs, because the
	 * converter has already written the surfaces the bundle does not own.
	 */
	overlay?: boolean;
	/** Authored-bundle targets: the bundle directory inside the installed package. */
	moduleDir?: string;
	/** Release-kit targets: the extracted release, plus what the updater needs. */
	release?: {
		sourceDir: string;
		config: UserConfig;
		options: SmartUpdateOptions;
	};
	/** The kit version to stamp on a plugin manifest. */
	kitVersion?: string;
}

export interface EmitResult {
	target: InstallTarget;
	delivery: InstallDelivery;
	entryPoint: EmitEntryPoint;
	/** Set for a release-kit target. */
	stats?: UpdateStats;
	/** Set for an authored-bundle target. */
	bundle?: ApplyBundleResult;
	/** Path of the plugin manifest, when the plugin delivery wrote one. */
	pluginManifest?: string;
}

const passages: EmitResult[] = [];

/** Every passage through the projection in this process, oldest first. */
export const emitterPassages = (): readonly EmitResult[] => passages;

/** Forget recorded passages. For a test that wants to count one command's own. */
export const resetEmitterPassages = (): void => {
	passages.length = 0;
};

/**
 * Lay down one target's shape, and record that it happened here.
 *
 * Dispatch is on the SHAPE's declared source, never on the entry point: an
 * entry point that wanted a different source would be asking for a second shape
 * for the same target, which is the drift this module exists to prevent.
 */
export async function emitTarget(request: EmitRequest): Promise<EmitResult> {
	// Every write of a target passes here, from init, upgrade and migrate alike.
	assertNotMewkitNext(request.entryPoint, request.projectRoot, request.target, request.global === true);
	const shape = TARGET_SHAPES[request.target];
	const result: EmitResult = {
		target: request.target,
		delivery: request.delivery,
		entryPoint: request.entryPoint,
	};

	if (shape.source === "release-kit") {
		if (request.release === undefined) {
			throw new Error(`Laying down ${request.target} needs an extracted release, and none was resolved.`);
		}
		result.stats = await smartUpdate(
			request.release.config,
			request.release.sourceDir,
			request.projectRoot,
			request.dryRun === true,
			request.force === true,
			request.release.options,
		);
		// The plugin delivery is an ENVELOPE around the same content, written by
		// this same projection rather than by a parallel writer — which is what
		// keeps `--delivery native` and `--delivery plugin` from drifting apart.
		if (request.delivery === "plugin" && request.dryRun !== true) {
			result.pluginManifest = await emitPluginDelivery(request.projectRoot, request.kitVersion ?? "");
		}
	} else {
		if (request.moduleDir === undefined) {
			throw new Error(`Laying down ${request.target} needs its authored bundle, and none was resolved.`);
		}
		const options = {
			force: request.overlay === true ? true : request.force === true,
			dryRun: request.dryRun === true,
			global: request.global,
			projectRoot: request.projectRoot,
			packs: request.packs,
			onlyActive: request.overlay === true,
		};
		result.bundle =
			request.target === "codex"
				? await reconcileApplyCodexBundle(request.moduleDir, request.projectRoot, options)
				: await reconcileApplyCursorBundle(request.moduleDir, request.projectRoot, options);
	}

	passages.push(result);
	return result;
}
