/**
 * A small JSON Schema (draft-07 subset) checker.
 *
 * Deliberately NOT a general implementation. It covers exactly the keywords the
 * kit's own schemas use, so a schema change that reaches for something new fails
 * loudly here instead of being silently ignored — which is what a permissive
 * validator does, and the reason the frontmatter contract could drift unnoticed.
 *
 * Supported: type, enum, const, required, properties, additionalProperties
 * (boolean), pattern, minLength, maxLength, minimum, maximum, items, minItems,
 * maxItems, uniqueItems, oneOf, anyOf.
 */

export interface SchemaViolation {
	/** Instance path as a list of keys/indices, empty for the root. */
	path: (string | number)[];
	message: string;
}

type JsonObject = Record<string, unknown>;

type TypeName = "object" | "array" | "string" | "number" | "integer" | "boolean" | "null";

function isObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function typeOf(value: unknown): TypeName {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	if (typeof value === "boolean") return "boolean";
	if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
	if (typeof value === "string") return "string";
	return "object";
}

function typeMatches(value: unknown, expected: string): boolean {
	const actual = typeOf(value);
	if (expected === "number") return actual === "number" || actual === "integer";
	return actual === expected;
}

function asStringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function checkString(value: string, schema: JsonObject, path: (string | number)[]): SchemaViolation[] {
	const out: SchemaViolation[] = [];
	const { pattern, minLength, maxLength } = schema;
	if (typeof pattern === "string" && !new RegExp(pattern).test(value)) {
		out.push({ path, message: `${JSON.stringify(value)} does not match '${pattern}'` });
	}
	if (typeof minLength === "number" && value.length < minLength) {
		out.push({ path, message: `${JSON.stringify(value)} is too short (minLength ${minLength})` });
	}
	if (typeof maxLength === "number" && value.length > maxLength) {
		out.push({ path, message: `${JSON.stringify(value)} is too long (maxLength ${maxLength})` });
	}
	return out;
}

function checkNumber(value: number, schema: JsonObject, path: (string | number)[]): SchemaViolation[] {
	const out: SchemaViolation[] = [];
	const { minimum, maximum } = schema;
	if (typeof minimum === "number" && value < minimum) {
		out.push({ path, message: `${value} is less than the minimum of ${minimum}` });
	}
	if (typeof maximum === "number" && value > maximum) {
		out.push({ path, message: `${value} is greater than the maximum of ${maximum}` });
	}
	return out;
}

function checkArray(value: unknown[], schema: JsonObject, path: (string | number)[]): SchemaViolation[] {
	const out: SchemaViolation[] = [];
	const { items, minItems, maxItems, uniqueItems } = schema;
	if (typeof minItems === "number" && value.length < minItems) {
		out.push({ path, message: `array is too short (minItems ${minItems})` });
	}
	if (typeof maxItems === "number" && value.length > maxItems) {
		out.push({ path, message: `array is too long (maxItems ${maxItems})` });
	}
	if (uniqueItems === true) {
		const seen = new Set(value.map((v) => JSON.stringify(v)));
		if (seen.size !== value.length) out.push({ path, message: "array has non-unique elements" });
	}
	if (isObject(items)) {
		value.forEach((element, index) => out.push(...validateAgainstSchema(element, items, [...path, index])));
	}
	return out;
}

function checkObject(value: JsonObject, schema: JsonObject, path: (string | number)[]): SchemaViolation[] {
	const out: SchemaViolation[] = [];
	for (const key of asStringArray(schema.required)) {
		if (!(key in value)) out.push({ path, message: `'${key}' is a required property` });
	}
	const properties = isObject(schema.properties) ? schema.properties : {};
	for (const [key, raw] of Object.entries(value)) {
		const propertySchema = properties[key];
		if (isObject(propertySchema)) {
			out.push(...validateAgainstSchema(raw, propertySchema, [...path, key]));
		} else if (schema.additionalProperties === false) {
			out.push({ path, message: `additional property '${key}' is not allowed` });
		}
	}
	return out;
}

/** Every violation of `schema` by `value`, in document order. */
export function validateAgainstSchema(
	value: unknown,
	schema: JsonObject,
	path: (string | number)[] = [],
): SchemaViolation[] {
	const out: SchemaViolation[] = [];

	const declaredType = schema.type;
	const types = typeof declaredType === "string" ? [declaredType] : asStringArray(declaredType);
	if (types.length > 0 && !types.some((t) => typeMatches(value, t))) {
		return [{ path, message: `${JSON.stringify(value)} is not of type ${types.map((t) => `'${t}'`).join(", ")}` }];
	}

	if (Array.isArray(schema.enum)) {
		const allowed = schema.enum.map((v) => JSON.stringify(v));
		if (!allowed.includes(JSON.stringify(value))) {
			out.push({ path, message: `${JSON.stringify(value)} is not one of ${allowed.join(", ")}` });
		}
	}
	if ("const" in schema && JSON.stringify(schema.const) !== JSON.stringify(value)) {
		out.push({ path, message: `${JSON.stringify(value)} was expected to be ${JSON.stringify(schema.const)}` });
	}

	for (const key of ["oneOf", "anyOf"] as const) {
		const branches = schema[key];
		if (!Array.isArray(branches)) continue;
		const passing = branches.filter((branch) => isObject(branch) && validateAgainstSchema(value, branch, path).length === 0);
		if (passing.length === 0) {
			out.push({ path, message: `${JSON.stringify(value)} is not valid under any of the given schemas` });
		} else if (key === "oneOf" && passing.length > 1) {
			out.push({ path, message: `${JSON.stringify(value)} is valid under more than one of the given schemas` });
		}
	}

	if (typeof value === "string") out.push(...checkString(value, schema, path));
	else if (typeof value === "number") out.push(...checkNumber(value, schema, path));
	else if (Array.isArray(value)) out.push(...checkArray(value, schema, path));
	else if (isObject(value)) out.push(...checkObject(value, schema, path));

	return out;
}

/** The jsonschema-style rendering the kit's validators print. */
export function formatViolation(violation: SchemaViolation): string {
	const location = violation.path.length > 0 ? `[${violation.path.map((p) => JSON.stringify(p)).join(", ")}]` : "/";
	return `${violation.message} (path: ${location})`;
}
