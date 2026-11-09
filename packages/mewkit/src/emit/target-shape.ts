// What each target's on-disk shape IS, declared once.
//
// Before this, "what does a Codex install look like" was answerable only by
// reading three commands and noticing they agreed. They agreed because the same
// reconciler happened to be called from each — not because anything said so, and
// nothing would have noticed if one of them had drifted.
//
// So the shape is a declaration, the emitter reads it, and every entry point
// goes through the emitter. A target's shape changes in one place or not at all.
import type { InstallDelivery, InstallTarget } from "../commands/init-target-delivery.js";

/** The three entry points that can ask for a target to be laid down. */
export type EmitEntryPoint = "init" | "upgrade" | "migrate";

/** How a target's bytes are produced. One value per target; no target has two. */
export type ShapeSource =
	/** The release's own kit content, applied by the ownership-aware updater. */
	| "release-kit"
	/** An authored bundle shipped inside the CLI package, applied by its reconciler. */
	| "authored-bundle";

export interface TargetShape {
	target: InstallTarget;
	source: ShapeSource;
	/** Deliveries this target accepts. Exactly one unless the host offers a choice. */
	deliveries: readonly InstallDelivery[];
	/**
	 * Entry points that can address this target. `migrate` exports to EXTERNAL
	 * tools, so it cannot address the kit's own runtime — which is why
	 * `migrate claude-code` is refused by name rather than treated as unknown.
	 */
	entryPoints: readonly EmitEntryPoint[];
	/** Top-level paths the target owns, for the report and for the mixed-install check. */
	writes: readonly string[];
}

export const TARGET_SHAPES: Record<InstallTarget, TargetShape> = {
	"claude-code": {
		target: "claude-code",
		source: "release-kit",
		// The one target whose on-disk shape is a choice: the same content either
		// as the host's own directory or as a plugin the host loads.
		deliveries: ["native", "plugin"],
		entryPoints: ["init", "upgrade"],
		writes: [".claude", ".meowkit"],
	},
	codex: {
		target: "codex",
		source: "authored-bundle",
		deliveries: ["native"],
		entryPoints: ["init", "upgrade", "migrate"],
		writes: ["AGENTS.md", ".codex", ".agents"],
	},
	cursor: {
		target: "cursor",
		source: "authored-bundle",
		deliveries: ["native"],
		entryPoints: ["init", "upgrade", "migrate"],
		writes: ["AGENTS.md", ".cursor", ".agents"],
	},
};

/** Every target + entry-point pair that can actually be invoked. */
export function invocableCombinations(): Array<{ target: InstallTarget; entryPoint: EmitEntryPoint }> {
	const out: Array<{ target: InstallTarget; entryPoint: EmitEntryPoint }> = [];
	for (const shape of Object.values(TARGET_SHAPES)) {
		for (const entryPoint of shape.entryPoints) out.push({ target: shape.target, entryPoint });
	}
	return out;
}

/** Whether an entry point can address a target at all. */
export const canAddress = (target: InstallTarget, entryPoint: EmitEntryPoint): boolean =>
	TARGET_SHAPES[target].entryPoints.includes(entryPoint);
