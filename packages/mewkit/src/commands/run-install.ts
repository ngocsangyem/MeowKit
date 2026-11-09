// The one place a `mewkit init` run decides its target and delivery, runs the
// install, and records what produced it.
//
// It wraps `init` rather than living inside it, so the three concerns stay
// separable: `init` lays content down, this decides the shape and writes the
// record, and the dispatcher only parses flags. The practical gain is that the
// shape decision and the refusals are testable without running an install.
import { existsSync } from "node:fs";
import { join } from "node:path";

import pc from "picocolors";

import { readInstallMetadata } from "../core/install-metadata.js";
import { installOrigin, recordProvenance } from "../core/record-provenance.js";
import { init, type InitArgs } from "./init.js";
import { resolveTargetDelivery } from "./init-target-delivery.js";
import type { TargetDelivery } from "./init-target-delivery.js";
import { TARGET_SHAPES } from "../emit/target-shape.js";

export interface RunInstallArgs extends InitArgs {
	delivery?: string;
	offline?: boolean;
	cliVersion: string;
}

/**
 * The kit version the install just laid down.
 *
 * For an authored-bundle target it IS the CLI version: that bundle ships inside
 * the CLI package, so there is no second thing to version. For the release-kit
 * target it comes from the release the updater applied.
 */
function installedKitVersion(root: string, shape: TargetDelivery, cliVersion: string): string {
	if (TARGET_SHAPES[shape.target].source === "authored-bundle") return cliVersion;
	try {
		return readInstallMetadata(join(root, ".claude")).meta?.version ?? "unknown";
	} catch {
		return "unknown";
	}
}

/**
 * Validate the shape, install, record provenance.
 *
 * The plugin envelope is written by the projection itself, inside the install,
 * not here: `--delivery plugin` and `--delivery native` must come out of one
 * emitter, and a second writer in this file would be the parallel path that
 * lets the two drift.
 *
 * The shape is validated BEFORE the install, so a rejected combination writes
 * nothing at all — a user who mistyped a target should not be left with an
 * install they have to undo.
 */
export async function runInstall(args: RunInstallArgs): Promise<void> {
	const shape = resolveTargetDelivery(args.target, args.delivery);
	if ("error" in shape) {
		console.error(pc.red(shape.error));
		process.exitCode = 1;
		return;
	}

	await init(args);
	if (args.dryRun === true) return;

	const root = process.cwd();
	if (!existsSync(join(root, ".claude")) && shape.target === "claude-code") return;

	const kitVersion = installedKitVersion(root, shape, args.cliVersion);

	await recordProvenance(root, {
		kitVersion,
		cliVersion: args.cliVersion,
		target: shape.target,
		delivery: shape.delivery,
		origin: installOrigin(args.offline === true),
	});
}
