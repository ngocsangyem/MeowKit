// Carry a v2 `.meowkit/config.json` across to the committed `config.yaml`.
//
// The old file is an install descriptor: a version, a project description and a
// `features` block. Most of it has no equivalent in a preference file, and the
// temptation is to delete it and move on. That loses whatever the user had
// deliberately turned off, silently. So every value with an equivalent is
// carried across and written UNCOMMENTED — it is the user's explicit choice now
// — and every value without one is reported BY NAME, so nothing is dropped
// without being said out loud.
import { existsSync, readFileSync } from "node:fs";

import { renderConfigStub } from "./write-stub.js";

/** A v2 key that maps onto a config key, and the mapping. */
interface Mapping {
	/** Dotted path inside the old descriptor. */
	from: string;
	/** The config key it becomes. */
	to: string;
	render: (value: unknown) => string | null;
}

const asBoolean = (value: unknown): string | null => (typeof value === "boolean" ? String(value) : null);

const MAPPINGS: Mapping[] = [
	// `features.costTracking` was the on/off switch for the budget observer, so
	// the preference it expressed is "run the budget tracker at all".
	{ from: "features.costTracking", to: "hooks.budget-tracker", render: asBoolean },
	{ from: "features.memory", to: "hooks.learning-observer", render: asBoolean },
	// The one descriptor switch that kept its meaning exactly: strict test-first
	// mode is a config key by the same name.
	{ from: "features.tdd", to: "tdd", render: asBoolean },
];

function at(document: Record<string, unknown>, path: string): unknown {
	let cursor: unknown = document;
	for (const part of path.split(".")) {
		if (typeof cursor !== "object" || cursor === null) return undefined;
		cursor = (cursor as Record<string, unknown>)[part];
	}
	return cursor;
}

/** Every leaf path in the descriptor, so "not carried" can be stated by name. */
function leaves(value: unknown, prefix = ""): string[] {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return prefix === "" ? [] : [prefix];
	const out: string[] = [];
	for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
		out.push(...leaves(child, prefix === "" ? key : `${prefix}.${key}`));
	}
	return out;
}

export interface MigrationPlan {
	/** The config keys that will be set, and the values they take. */
	carried: { from: string; to: string; value: string }[];
	/** Descriptor paths with no equivalent, each with why it has none. */
	uncarried: { from: string; why: string }[];
	/** The `config.yaml` body to write. */
	body: string;
	/** False when the descriptor could not be read as JSON at all. */
	readable: boolean;
}

const WHY: Record<string, string> = {
	$schema: "a pointer to the old descriptor's own schema; the new file carries its own",
	version: "the installed version is recorded in .meowkit/metadata.json, which is where it belongs",
	"project.description": "a project description is not a setting; keep it in the project's README",
	name: "the project's own name is not a kit setting",
	description: "a project description is not a setting; keep it in the project's README",
	buildDate: "when the kit was built is recorded in .meowkit/metadata.json",
	"repository.type": "the remote is git's to know, not a kit setting",
	"repository.url": "the remote is git's to know, not a kit setting",
	"features.harness": "the harness is selected per run by the autobuild density, not by a stored switch",
	"features.conversationSummary": "no observer reads it; the behaviour it named is gone",
};

/**
 * Work out what migrating one descriptor would do. Pure — it writes nothing, so
 * `upgrade --dry-run` and `doctor` can both report it.
 */
export function planDescriptorMigration(descriptorFile: string, observerNames: readonly string[]): MigrationPlan {
	let document: Record<string, unknown> = {};
	let readable = true;
	if (existsSync(descriptorFile)) {
		try {
			const parsed: unknown = JSON.parse(readFileSync(descriptorFile, "utf-8"));
			if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
				document = parsed as Record<string, unknown>;
			} else readable = false;
		} catch {
			readable = false;
		}
	}

	const carried: MigrationPlan["carried"] = [];
	const chosen: Record<string, string> = {};
	const handled = new Set<string>();
	for (const mapping of MAPPINGS) {
		const raw = at(document, mapping.from);
		if (raw === undefined) continue;
		handled.add(mapping.from);
		const rendered = mapping.render(raw);
		if (rendered === null) continue;
		chosen[mapping.to] = rendered;
		carried.push({ from: mapping.from, to: mapping.to, value: rendered });
	}

	const uncarried = leaves(document)
		.filter((path) => !handled.has(path))
		.map((path) => ({ from: path, why: WHY[path] ?? "no equivalent key exists in the committed config" }));

	return { carried, uncarried, body: renderConfigStub(observerNames, chosen), readable };
}
