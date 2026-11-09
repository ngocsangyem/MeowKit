// Reading `--target` and `--delivery`, and refusing by name rather than by
// silence.
//
// Every rejection here replaces a worse outcome. An unrecognized target used to
// fall through to the default install, so `--target claude-codee` produced a
// successful-looking run that built something the user did not ask for. And
// `--delivery` is meaningful for one target only: ignoring it on the others
// would mean `--delivery plugin --target codex` prints success while producing a
// native Codex bundle, which is the install the flag was passed to avoid.
//
// So: unknown values are named, the valid ones are listed, and a flag that
// cannot apply is an error instead of a no-op.

/** The runtimes an install can be laid down for. */
export const TARGETS = ["claude-code", "codex", "cursor"] as const;
export type InstallTarget = (typeof TARGETS)[number];

/** The on-disk shapes. Meaningful for Claude Code only; the others have one each. */
export const DELIVERIES = ["native", "plugin"] as const;
export type InstallDelivery = (typeof DELIVERIES)[number];

/** The one target whose on-disk shape is a choice. */
const DELIVERY_TARGET: InstallTarget = "claude-code";

export interface TargetDelivery {
	target: InstallTarget;
	delivery: InstallDelivery;
}

const isTarget = (value: string): value is InstallTarget => (TARGETS as readonly string[]).includes(value);
const isDelivery = (value: string): value is InstallDelivery => (DELIVERIES as readonly string[]).includes(value);

/**
 * Resolve the pair, or the reason the combination cannot be honored.
 *
 * An omitted target is Claude Code, which is what it has always been; omitting
 * it is not the same as asking for something unsupported.
 */
export function resolveTargetDelivery(
	target: string | undefined,
	delivery: string | undefined,
): TargetDelivery | { error: string } {
	const named = target === undefined || target.trim() === "" ? DELIVERY_TARGET : target.trim();
	if (!isTarget(named)) {
		return {
			error: `Unknown --target "${named}". The install targets are ${TARGETS.join(", ")}. Nothing was written.`,
		};
	}
	if (delivery === undefined || delivery.trim() === "") {
		return { target: named, delivery: "native" };
	}
	const namedDelivery = delivery.trim();
	if (named !== DELIVERY_TARGET) {
		return {
			error:
				`--delivery is meaningful for --target ${DELIVERY_TARGET} only, and "${named}" has a single on-disk shape, ` +
				`so passing --delivery ${namedDelivery} here would have no effect. Drop the flag, or change the target. Nothing was written.`,
		};
	}
	if (!isDelivery(namedDelivery)) {
		return {
			error: `Unknown --delivery "${namedDelivery}". The deliveries are ${DELIVERIES.join(", ")}. Nothing was written.`,
		};
	}
	return { target: named, delivery: namedDelivery };
}
