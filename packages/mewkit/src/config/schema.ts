// The project config surface: one declaration, used for validation and for the
// JSON Schema the config's own `$schema` points at.
//
// Observer toggles are not written out here. They are derived from the handler
// registry, so an observer cannot exist without a toggle and a toggle cannot
// name a handler that does not exist. The consequence is that the schema is
// built per project rather than being a constant.
//
// What is deliberately absent matters as much as what is present. There is no
// `gates.*` and no `paths.*` property, at any scope: a configurable workflow path
// would move writes out of the rules Gate 1 keys off, and a gate is not a
// preference. `additionalProperties` is false at every level, so a future
// unknown key is a loud error rather than a silently ignored one.
import { z } from "zod";

/** Where the published JSON Schema lives, for the config's own `$schema` line. */
export const SCHEMA_URL = "https://meowkit.dev/schemas/config-v1.json";

/** Namespaces that are rejected by name rather than merely being unknown. */
export const FORBIDDEN_NAMESPACES: Record<string, string> = {
	gates: "gate behaviour is not configurable from any file, at any scope",
	paths: "a configurable workflow path would move writes out of the gate rules that key off it",
};

/** Hooks that may never be switched off, and why, for the rejection message. */
export const PROTECTED_HOOKS: Record<string, string> = {
	"gate-enforcement": "Gate 1 blocks source writes before the plan is approved",
	"privacy-block": "it blocks reads of credential files",
	"pre-ship": "it proves Gate 2 before a commit, push or merge",
	"gate2-check": "it is the Gate 2 proof the ship path runs",
	"check-careful": "it is a hard-blocking guard",
	"check-freeze": "it is a hard-blocking guard",
	"check-report-path": "it is a hard-blocking guard",
};

/**
 * The key that downgrades Gate 1 to a plan-presence check. Legal in the USER
 * file only; the gate reads it through its own single-key reader and never
 * through this schema.
 */
export const USER_SCOPE_ONLY_KEY = "gate1PresenceOnly";

/**
 * Settings that live in session state and may never become config keys, with
 * the reason each one stays out. A committed key here would let a pull request
 * suppress a review step for everyone, which is a different thing from a user
 * opting out on their own machine — so the refusal names the state command
 * rather than reporting an unknown key.
 */
export const STATE_ONLY_KEYS: Record<string, string> = {
	skip_eng_review:
		"it suppresses the review step that gates shipping, so it is a per-project choice rather than a committed one",
};

export const AUTOBUILD_MODES = ["MINIMAL", "FULL", "LEAN"] as const;
export const TELEMETRY_MODES = ["off", "community", "anonymous"] as const;

/** One commented stub line per key, so an uncommented file is the user's choices. */
export const KEY_DOC: Record<string, string> = {
	tdd: "strict test-first mode. MEOWKIT_TDD in the environment still outranks this.",
	"autobuild.mode": "density preset. Sets density only; it cannot bypass the contract gate.",
	"budget.cap": "overrides the hard block, in USD — lower or higher than budget.block.",
	"budget.warn": "estimated session cost in USD at which a warning is printed.",
	"budget.block": "estimated session cost in USD at which work is blocked.",
	"buildVerify.timeoutMs": "how long the post-write build check may take.",
	"projectContext.maxBytes": "ceiling on the project-context file injected at session start.",
	"workflow.telemetry": "off, community or anonymous.",
	"workflow.proactive": "whether skills volunteer suggestions.",
};

/** The scalar half of the surface, with the JSON-Schema type for each key. */
export const SCALAR_KEYS: Record<string, { type: "boolean" | "integer" | "string"; enum?: readonly string[] }> = {
	tdd: { type: "boolean" },
	"autobuild.mode": { type: "string", enum: AUTOBUILD_MODES },
	"budget.cap": { type: "integer" },
	"budget.warn": { type: "integer" },
	"budget.block": { type: "integer" },
	"buildVerify.timeoutMs": { type: "integer" },
	"projectContext.maxBytes": { type: "integer" },
	"workflow.telemetry": { type: "string", enum: TELEMETRY_MODES },
	"workflow.proactive": { type: "boolean" },
};

/** Nest the flat scalar table into the two-level shape the file is written in. */
function nestedShape(): Record<string, z.ZodTypeAny> {
	const groups = new Map<string, Record<string, z.ZodTypeAny>>();
	const top: Record<string, z.ZodTypeAny> = {};
	for (const [key, spec] of Object.entries(SCALAR_KEYS)) {
		const leaf =
			spec.enum !== undefined
				? z.enum(spec.enum as [string, ...string[]])
				: spec.type === "boolean"
					? z.boolean()
					: z.number().int();
		const dot = key.indexOf(".");
		if (dot === -1) {
			top[key] = leaf.optional();
			continue;
		}
		const parent = key.slice(0, dot);
		const child = key.slice(dot + 1);
		const group = groups.get(parent) ?? {};
		group[child] = leaf.optional();
		groups.set(parent, group);
	}
	for (const [parent, group] of groups) top[parent] = z.object(group).strict().optional();
	return top;
}

/**
 * The schema for one project. `observerNames` are the kebab-case toggle keys of
 * that project's registry; each becomes an optional boolean under `hooks`.
 */
export function buildConfigSchema(
	observerNames: readonly string[],
	scope: "project" | "user" = "project",
): z.ZodTypeAny {
	const hooks: Record<string, z.ZodTypeAny> = {};
	for (const name of [...observerNames].sort()) hooks[name] = z.boolean().optional();
	// The hatch key exists in the user file only. Admitting it to the project
	// shape would make a committed gate downgrade merely discouraged rather than
	// unrepresentable.
	const shape: Record<string, z.ZodTypeAny> = {
		$schema: z.string().optional(),
		...nestedShape(),
		hooks: z.object(hooks).strict().optional(),
	};
	if (scope === "user") shape[USER_SCOPE_ONLY_KEY] = z.boolean().optional();
	return z.object(shape).strict();
}

/** Every legal dotted key for one project, scalars plus one toggle per observer. */
export function knownKeys(
	observerNames: readonly string[],
): Record<string, { type: "boolean" | "integer" | "string"; enum?: readonly string[] }> {
	const keys = { ...SCALAR_KEYS };
	for (const name of observerNames) keys[`hooks.${name}`] = { type: "boolean" };
	return keys;
}
