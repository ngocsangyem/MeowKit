// The things an upgrade settles around the update itself: carrying a superseded
// ownership baseline forward, reading the installed shape, and re-stamping what
// produced the install. None of them is release-flow logic; each is true before
// or after the content moves.
import { join } from "node:path";

import { readInstallMetadata } from "../core/install-metadata.js";
import { migrateLegacyBaseline } from "../core/legacy-manifest-migration.js";
import { installOrigin, recordProvenance } from "../core/record-provenance.js";
import type { InstallDelivery } from "./init-target-delivery.js";

/** What the caller should say, line by line, about a baseline it carried forward. */
export async function carryBaselineForward(root: string): Promise<string[]> {
	const migration = await migrateLegacyBaseline(root);
	if (migration === null) return [];
	return [
		`Carried ${migration.carried} recorded path(s) into the canonical ownership record.`,
		...migration.uncarried.map((item) => `  could not carry ${item.path}: ${item.reason}`),
	];
}

export interface InstalledShape {
	packs: string[] | undefined;
	profile: string | undefined;
	/**
	 * The delivery the install chose, so an upgrade does not quietly convert a
	 * plugin-delivered project back to the native one. Absent provenance means an
	 * older install, which was native by definition.
	 */
	delivery: InstallDelivery;
}

/**
 * What this project's record says it is, for an upgrade to preserve.
 *
 * Corrupt or absent metadata reads as "no narrowing and the default shape" rather
 * than raising: aborting here would abort the very upgrade that repairs the
 * record.
 */
export function readInstalledShape(root: string): InstalledShape {
	try {
		const { meta } = readInstallMetadata(join(root, ".claude"));
		return {
			packs: meta?.packs,
			profile: meta?.profile,
			delivery: meta?.provenance?.delivery === "plugin" ? "plugin" : "native",
		};
	} catch {
		return { packs: undefined, profile: undefined, delivery: "native" };
	}
}

/**
 * Re-stamp provenance with THIS run's facts.
 *
 * The updater carries the prior record forward so an upgrade never drops it, but
 * the kit version and the origin are properties of this run and would otherwise
 * still name the install's.
 */
export async function restampProvenance(
	root: string,
	facts: { kitVersion: string; cliVersion: string; delivery: InstallDelivery },
): Promise<void> {
	await recordProvenance(root, {
		kitVersion: facts.kitVersion,
		cliVersion: facts.cliVersion,
		target: "claude-code",
		delivery: facts.delivery,
		origin: installOrigin(),
	});
}
