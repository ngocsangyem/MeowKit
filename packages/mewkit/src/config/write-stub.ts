// Render `.meowkit/config.yaml`: a commented stub per key, and nothing turned on.
//
// Every preference is written commented out, so an uncommented line in a
// project's config is a decision someone made rather than a default the
// installer happened to pick. That matters because the file is committed: a
// reviewer reading the diff should see the project's choices, not a wall of
// values identical to the built-in ones.
//
// The `$schema` line is the one exception and is written live. It is not a
// preference and has no default to confuse: it is what makes an editor validate
// the file as it is typed, and a commented pointer validates nothing.
import { KEY_DOC, SCALAR_KEYS, SCHEMA_URL } from "./schema.js";

const HEADER = [
	"# MeowKit project configuration — committed, human-owned, schema-validated.",
	"#",
	"# Every setting below is commented out. Uncomment only what this project",
	"# decides, so the committed file reads as a list of choices rather than a",
	"# copy of the defaults.",
	"#",
	"# Two levels of keys; values are true/false, whole numbers or plain strings.",
	"# A gate is not a preference: there is no `gates.` or `paths.` key at any",
	"# scope, and an unknown key is an error rather than being ignored.",
];

const HOOKS_NOTE = [
	"# hooks.<name>: false switches one observer off. The seven hard-blocking",
	"# checks are absent on purpose — they cannot be disabled from this file.",
];

/**
 * An example value per numeric key. A stub a user uncomments has to be a value
 * the loader accepts: `0` would parse and then mean something nobody chose.
 *
 * The three budget examples are USD, the unit the tracker reads them in, and the
 * warn/block pair repeats the tracker's own defaults — a shipped example that
 * raised the hard block would hand a new project a weaker cost brake than it
 * would have had with no config at all.
 */
const EXAMPLE: Record<string, string> = {
	"budget.cap": "50",
	"budget.warn": "30",
	"budget.block": "100",
	"buildVerify.timeoutMs": "120000",
	"projectContext.maxBytes": "16000",
};

const leafOf = (key: string): string => (key.includes(".") ? key.slice(key.indexOf(".") + 1) : key);
const indentOf = (key: string): string => (key.includes(".") ? "  " : "");
/** The explanation above a stub, commented at the key's own depth. */
const docLine = (indent: string, doc: string): string => (indent === "" ? `# ${doc}` : `#${indent}# ${doc}`);

/** One `# key: value` stub line, prefixed by its one-line explanation. */
function stub(key: string): string[] {
	const indent = indentOf(key);
	const spec = SCALAR_KEYS[key];
	const choices = spec?.enum === undefined ? "" : `   # one of: ${spec.enum.join(", ")}`;
	const lines = [`#${indent}${leafOf(key)}: ${placeholderFor(key)}${choices}`];
	const doc = KEY_DOC[key];
	return doc === undefined ? lines : [docLine(indent, doc), ...lines];
}

function placeholderFor(key: string): string {
	const spec = SCALAR_KEYS[key];
	if (spec === undefined) return "false";
	if (spec.enum !== undefined) return spec.enum[0];
	if (spec.type === "boolean") return "false";
	if (spec.type === "integer") return EXAMPLE[key] ?? "0";
	return '""';
}

/**
 * The whole file. `observerNames` are the project's kebab-case observer keys, so
 * the stub cannot name a toggle that has no handler.
 */
export function renderConfigStub(observerNames: readonly string[], chosen: Record<string, string> = {}): string {
	const lines = [...HEADER, "", `$schema: ${SCHEMA_URL}`, ""];
	const groups = new Map<string, string[]>();
	const topLevel: string[] = [];

	for (const key of Object.keys(SCALAR_KEYS)) {
		const dot = key.indexOf(".");
		if (dot === -1) {
			topLevel.push(key);
			continue;
		}
		const parent = key.slice(0, dot);
		groups.set(parent, [...(groups.get(parent) ?? []), key]);
	}

	// A chosen value is written UNCOMMENTED: it arrived from a migration of a
	// file the user had already edited, so it is their choice and must keep
	// acting like one.
	const emit = (key: string): string[] => {
		const value = chosen[key];
		if (value === undefined) return stub(key);
		const leaf = leafOf(key);
		const indent = indentOf(key);
		const doc = KEY_DOC[key];
		return [...(doc === undefined ? [] : [docLine(indent, doc)]), `${indent}${leaf}: ${value}`];
	};

	for (const key of topLevel) lines.push(...emit(key), "");

	for (const [parent, keys] of groups) {
		const anyChosen = keys.some((k) => chosen[k] !== undefined);
		lines.push(anyChosen ? `${parent}:` : `#${parent}:`);
		for (const key of keys) lines.push(...emit(key));
		lines.push("");
	}

	const hookKeys = [...observerNames].sort();
	const anyHookChosen = hookKeys.some((name) => chosen[`hooks.${name}`] !== undefined);
	lines.push(...HOOKS_NOTE, anyHookChosen ? "hooks:" : "#hooks:");
	for (const name of hookKeys) {
		const value = chosen[`hooks.${name}`];
		lines.push(value === undefined ? `#  ${name}: false` : `  ${name}: ${value}`);
	}
	lines.push("");
	return lines.join("\n");
}
