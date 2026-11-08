// The rejections a project config is subject to, CLI side.
//
// Every one rejects the WHOLE file. A config that applied the keys parsed before
// the bad one would hand the user a half-configured session whose behaviour
// matches no file they can read, and the error identifiers below exist so the
// hook reader and this one can be asserted to agree on which rule fired rather
// than merely that both said no.
//
// Each message names the key, the scope it came from, and what to do instead,
// because "invalid config" tells a user nothing they can act on.
import { FORBIDDEN_NAMESPACES, PROTECTED_HOOKS, STATE_ONLY_KEYS, USER_SCOPE_ONLY_KEY, knownKeys } from "./schema.js";

export type ConfigScope = "project config" | "user config";

export interface RuleError {
	code: string;
	key: string;
	message: string;
	fix: string;
}

export type ConfigValues = Record<string, boolean | number | string>;

export type RuleResult = { ok: true; values: ConfigValues } | { ok: false; error: RuleError };

/** A committed file must not hold a secret, however the user spelled the key. */
const SECRET_WORD = /keys|token|secret|password/i;

/** POSIX `/etc/x` and Windows `C:\x`. A machine-specific path is not shareable. */
const ABSOLUTE_PATH = /^(\/|[A-Za-z]:[\\/])/;

const HATCH_ENV = "MEOWKIT_GATE1_PRESENCE_ONLY";

const reject = (code: string, key: string, message: string, fix: string): RuleResult => ({ ok: false, error: { code, key, message, fix } });

/** `{ ok, values }` for an already-parsed flat map, or the first rule that fired. */
export function applyRules(values: ConfigValues, observerNames: readonly string[], scope: ConfigScope = "project config"): RuleResult {
	const keys = knownKeys(observerNames);

	for (const [key, value] of Object.entries(values)) {
		if (key === "$schema") continue;
		const namespace = key.split(".")[0] as string;

		if (Object.hasOwn(FORBIDDEN_NAMESPACES, namespace)) {
			return reject(
				"forbidden-namespace",
				key,
				`${key} in the ${scope}: the "${namespace}" namespace does not exist, because ${FORBIDDEN_NAMESPACES[namespace]}`,
				`remove ${key}`,
			);
		}

		if (SECRET_WORD.test(key) || (typeof value === "string" && SECRET_WORD.test(value))) {
			return reject(
				"secret-in-config",
				key,
				`${key} in the ${scope} looks like a credential, and the config is committed`,
				"move the value to the environment or to .meowkit/.env, which is never committed",
			);
		}

		if (typeof value === "string" && ABSOLUTE_PATH.test(value)) {
			return reject(
				"absolute-path",
				key,
				`${key} in the ${scope} is an absolute path (${value}), which resolves differently on a teammate's machine`,
				"use a path relative to the project root, or drop the key",
			);
		}

		if (namespace === "hooks") {
			const name = key.slice("hooks.".length);
			if (Object.hasOwn(PROTECTED_HOOKS, name)) {
				return reject(
					"protected-hook",
					key,
					`${name} cannot be disabled from the ${scope}: ${PROTECTED_HOOKS[name]}`,
					"remove the key; a safety check is not a preference",
				);
			}
		}

		if (Object.hasOwn(STATE_ONLY_KEYS, key)) {
			return reject(
				"state-only-key",
				key,
				`${key} is not a config key in the ${scope}: ${STATE_ONLY_KEYS[key]}`,
				`remove the key and run .claude/scripts/bin/workflow-config set ${key} true, which records it in .meowkit/state/`,
			);
		}

		if (key === USER_SCOPE_ONLY_KEY) {
			if (scope === "user config") continue;
			return reject(
				"user-scope-only",
				key,
				`${key} is not a project-config key: a committed file must not be able to downgrade Gate 1`,
				`move it to ~/.meowkit/config.yaml, or export ${HATCH_ENV} for one session`,
			);
		}

		if (!Object.hasOwn(keys, key)) {
			return reject(
				"unknown-key",
				key,
				`${key} in the ${scope} is not a config key`,
				"check the spelling against .meowkit/config.yaml, whose commented stubs list every key",
			);
		}

		const spec = keys[key];
		if (spec.type === "boolean" && typeof value !== "boolean") {
			return reject("wrong-type", key, `${key} in the ${scope} must be true or false, not ${JSON.stringify(value)}`, `set ${key} to true or false`);
		}
		if (spec.type === "integer" && !Number.isInteger(value)) {
			return reject("wrong-type", key, `${key} in the ${scope} must be a whole number, not ${JSON.stringify(value)}`, `set ${key} to a whole number`);
		}
		if (spec.type === "string" && typeof value !== "string") {
			const allowed = spec.enum ? spec.enum.join(", ") : "the documented values";
			return reject("wrong-type", key, `${key} in the ${scope} must be a string, not ${JSON.stringify(value)}`, `set ${key} to one of ${allowed}`);
		}
		if (spec.enum && !spec.enum.includes(value as string)) {
			return reject(
				"not-in-enum",
				key,
				`${key} in the ${scope} is ${JSON.stringify(value)}, which is not one of ${spec.enum.join(", ")}`,
				`set ${key} to one of ${spec.enum.join(", ")}`,
			);
		}
	}

	return { ok: true, values };
}
