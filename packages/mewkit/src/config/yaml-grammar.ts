// The grammar guard the CLI applies before js-yaml sees the text.
//
// js-yaml speaks all of YAML: anchors, block scalars, sequences, flow
// collections, document markers. The config does not, and the reason is the
// other reader — a hook has no npm dependencies and parses this file by hand, so
// anything js-yaml would accept and the hand reader would not is a divergence
// waiting to be discovered in the one session where it matters.
//
// So the subset is enforced here, line by line, with the same error identifiers
// the hook reader uses, and only then is the text handed to js-yaml for its
// values. A fixture corpus asserts the two agree verdict for verdict.
export interface GrammarError {
	code: string;
	line: number;
	message: string;
}

/**
 * The one key allowed to start with `$`. It is a pointer to the published JSON
 * Schema rather than a setting, and it is what makes an editor validate the
 * file as it is typed — so it has to be a live line, not a comment.
 */
export const SCHEMA_KEY = "$schema";

const KEY = /^[A-Za-z][A-Za-z0-9_.-]*$/;

const fail = (code: string, line: number, message: string): GrammarError => ({ code, line, message });

// A value's SPELLING is where the two readers part company most quietly. js-yaml
// resolves `True`, `+5`, `0x1f`, `.inf` and `"LEA\x4E"`; the hand reader sees five
// strings, and the same committed file would then mean different things on either
// side of the kit. Every spelling outside the subset is therefore refused here by
// name, with the same identifiers the hand reader uses, and the message says what
// to write instead.
const DECIMAL_INT = /^-?(0|[1-9]\d*)$/;
const BOOLEAN_MISSPELLED = /^(True|TRUE|False|FALSE)$/;
const INTEGERISH = /^[-+]?(0[xXoObB][0-9A-Fa-f_]+|\d[\d_]*)$/;
const FLOATISH = /^[-+]?(\.\d+|\d+\.\d*|\d+(\.\d*)?[eE][-+]?\d+|\.(inf|Inf|INF|nan|NaN|NAN))$/;
const NULLISH = /^(null|Null|NULL|~)$/;

/** The first out-of-subset spelling in `text`, or `null` when it is inside it. */
function outOfSubsetScalar(text: string, line: number, path: string): GrammarError | null {
	const quote = text[0] === '"' || text[0] === "'" ? text[0] : "";
	if (quote !== "") {
		const body = text.slice(1);
		const close = body.indexOf(quote);
		if (close === -1)
			return fail("unterminated-quote", line, `${path} opens a quote and never closes it; add the closing ${quote}`);
		if (close !== body.length - 1) {
			return fail(
				"trailing-content-after-quote",
				line,
				`${path} has content after the closing quote; a value is one scalar, and the grammar has no '' escape`,
			);
		}
		if (quote === '"' && body.includes("\\")) {
			return fail(
				"escape-not-supported",
				line,
				`${path} uses a backslash escape; the grammar takes characters literally, so write the character itself or drop the quotes`,
			);
		}
		return null;
	}
	// Null and float are where the two readers would otherwise part company: the
	// full parser gives `null` and `1.5`, the hand reader sees the words. Neither
	// type is in the subset, so both refuse rather than guess.
	if (NULLISH.test(text))
		return fail("null-not-supported", line, `${path} has no value; remove the key instead of setting it to null`);
	if (BOOLEAN_MISSPELLED.test(text))
		return fail(
			"bad-boolean-spelling",
			line,
			`${path} is ${text}, which is not a boolean here; write true or false in lower case`,
		);
	if (FLOATISH.test(text))
		return fail(
			"float-not-supported",
			line,
			`${path} is ${text}; the config grammar has whole numbers and strings, not decimals`,
		);
	if (INTEGERISH.test(text) && !DECIMAL_INT.test(text)) {
		return fail(
			"non-decimal-integer",
			line,
			`${path} is ${text}; write decimal digits with no sign, no underscores and no 0x/0o/0b prefix`,
		);
	}
	return null;
}

/** Strip a trailing `#` comment that is not inside a quoted scalar. */
export function stripComment(text: string): string {
	let quote = "";
	for (let i = 0; i < text.length; i += 1) {
		const ch = text[i];
		if (quote !== "") {
			if (ch === quote) quote = "";
		} else if (ch === '"' || ch === "'") {
			quote = ch;
		} else if (ch === "#" && (i === 0 || /\s/.test(text[i - 1] as string))) {
			return text.slice(0, i);
		}
	}
	return text;
}

/** Normalise a BOM and CRLF away, so line numbers and keys match either source. */
export const normalize = (source: string): string => source.replace(/^﻿/, "").replace(/\r\n?/g, "\n");

/** The first grammar violation, or `null` when the text is inside the subset. */
export function checkGrammar(source: string): GrammarError | null {
	const lines = normalize(source).split("\n");
	const seen = new Set<string>();
	let parent = "";

	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i] as string;
		const lineNo = i + 1;
		if (line.includes("\t")) return fail("tab-indentation", lineNo, "tabs are not allowed; indent with two spaces");
		const body = stripComment(line);
		if (body.trim() === "") continue;

		const indent = body.length - body.trimStart().length;
		if (indent % 2 !== 0)
			return fail("odd-indentation", lineNo, `indentation must be a multiple of two spaces, found ${indent}`);
		const depth = indent / 2;
		if (depth > 1)
			return fail("nesting-too-deep", lineNo, "the config grammar allows two levels; this line is a third");

		const trimmed = body.trim();
		if (trimmed.startsWith("- ") || trimmed === "-")
			return fail("sequence-not-supported", lineNo, "lists are not part of the config grammar");
		if (trimmed.startsWith("---"))
			return fail("document-marker-not-supported", lineNo, "document markers are not part of the config grammar");

		const split = trimmed.indexOf(":");
		if (split < 1) return fail("not-a-key", lineNo, `expected "key: value", found ${JSON.stringify(trimmed)}`);
		const key = trimmed.slice(0, split).trim();
		// A dot in a key is how a dotted PATH is spelled, not part of a key's name.
		// Written flat, `budget.cap: 5` is one key to the hand reader and a nested
		// pair to js-yaml, so the flat spelling is refused on both sides instead.
		if (key !== SCHEMA_KEY && key.includes(".")) {
			const [head, ...tail] = key.split(".");
			return fail(
				"dotted-key",
				lineNo,
				`${key} is a path, not a key; write it nested — "${head}:" on its own line, then "  ${tail.join(".")}: …" indented under it`,
			);
		}
		if (key !== SCHEMA_KEY && !KEY.test(key))
			return fail("bad-key", lineNo, `${JSON.stringify(key)} is not a valid config key`);

		if (depth === 0) parent = "";
		else if (parent === "") return fail("orphan-nesting", lineNo, `${key} is indented but no parent key opened a map`);

		const path = depth === 0 ? key : `${parent}.${key}`;
		if (seen.has(path)) return fail("duplicate-key", lineNo, `${path} is set more than once`);
		seen.add(path);

		const rest = trimmed.slice(split + 1).trim();
		if (rest === "") {
			if (depth === 1) return fail("nesting-too-deep", lineNo, `${path} opens a third level; the grammar allows two`);
			parent = key;
			continue;
		}

		const first = rest[0] as string;
		if (first === "&" || first === "*")
			return fail("anchor-not-supported", lineNo, "YAML anchors and aliases are not part of the config grammar");
		if (first === "!")
			return fail(
				"tag-not-supported",
				lineNo,
				"YAML tags are not part of the config grammar; drop the tag and write the plain value",
			);
		if (first === "|" || first === ">")
			return fail("block-scalar-not-supported", lineNo, "multi-line scalars are not part of the config grammar");
		if (first === "[" || first === "{")
			return fail("flow-collection-not-supported", lineNo, "inline lists and maps are not part of the config grammar");
		const bad = outOfSubsetScalar(rest, lineNo, path);
		if (bad !== null) return bad;
	}

	return null;
}

/** Flatten a parsed document to the dotted paths both readers compare on. */
export function flatten(value: unknown, prefix = ""): Record<string, boolean | number | string> {
	const out: Record<string, boolean | number | string> = {};
	if (value === null || typeof value !== "object" || Array.isArray(value)) return out;
	for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
		const path = prefix === "" ? key : `${prefix}.${key}`;
		if (child !== null && typeof child === "object" && !Array.isArray(child)) {
			Object.assign(out, flatten(child, path));
		} else if (typeof child === "boolean" || typeof child === "number" || typeof child === "string") {
			out[path] = child;
		}
		// A null is a key that opened nothing. The hand reader records no value
		// for it either, so skipping it is what keeps the two in step.
	}
	return out;
}
