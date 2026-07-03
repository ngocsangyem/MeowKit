import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { discoverEnvKeys } from "../discovery/config-discovery.js";
import {
	emitShellEnvPolicyScaffold,
	isSecretLikeKey,
	SHELL_ENV_POLICY_PLACEHOLDER,
} from "../providers/codex/shell-env-policy-emitter.js";

const SENTINEL = "SUPER_SECRET_SENTINEL_VALUE_do_not_leak_9f3c2a";

describe("shell_environment_policy scaffold emitter", () => {
	it("classifies secret-like key names case-insensitively", () => {
		for (const key of ["MY_SECRET", "api_token", "DB_PASSWORD", "PASS", "OPENAI_API_KEY", "SIGNING_KEY", "AWS_CREDENTIAL"]) {
			expect(isSecretLikeKey(key)).toBe(true);
		}
		for (const key of ["DATABASE_URL", "LOG_LEVEL", "PROJECT_ID", "FEATURE_FLAG"]) {
			expect(isSecretLikeKey(key)).toBe(false);
		}
	});

	it("emits inert placeholders for non-secret keys and an anti-commit warning", () => {
		const scaffold = emitShellEnvPolicyScaffold({
			sourcePath: "/tmp/.env",
			keys: ["DATABASE_URL", "LOG_LEVEL"],
		});

		expect(scaffold.includedKeys).toEqual(["DATABASE_URL", "LOG_LEVEL"]);
		expect(scaffold.content).toContain("[shell_environment_policy]");
		expect(scaffold.content).toContain(`DATABASE_URL = ${JSON.stringify(SHELL_ENV_POLICY_PLACEHOLDER)}`);
		expect(scaffold.content).toContain(`LOG_LEVEL = ${JSON.stringify(SHELL_ENV_POLICY_PLACEHOLDER)}`);
		// Inert placeholder only — no real value form.
		expect(scaffold.content).toContain("<fill-me>");
		// Anti-commit warning comment in the scaffold body.
		expect(scaffold.content).toContain("do NOT commit real values into config.toml");
		expect(scaffold.omittedSecretCount).toBe(0);
	});

	it("EXCLUDES secret-like keys from the scaffold AND records only an aggregate count", () => {
		const scaffold = emitShellEnvPolicyScaffold({
			sourcePath: "/tmp/.env",
			keys: ["DATABASE_URL", "OPENAI_API_KEY", "DB_PASSWORD", "AUTH_TOKEN"],
		});

		expect(scaffold.includedKeys).toEqual(["DATABASE_URL"]);
		expect(scaffold.omittedSecretCount).toBe(3);
		// Secret NAMES must NOT appear anywhere in the scaffold output.
		expect(scaffold.content).not.toContain("OPENAI_API_KEY");
		expect(scaffold.content).not.toContain("DB_PASSWORD");
		expect(scaffold.content).not.toContain("AUTH_TOKEN");
		// The report/warning is aggregate-only — count present, names absent.
		const warning = scaffold.warnings.join(" ");
		expect(warning).toContain("3 secret-like key(s) omitted");
		expect(warning).not.toContain("OPENAI_API_KEY");
		expect(warning).not.toContain("DB_PASSWORD");
		expect(warning).toContain("https://developers.openai.com/codex/config-advanced");
	});

	it("emits an empty scaffold (aggregate-only) when every key is secret-like", () => {
		const scaffold = emitShellEnvPolicyScaffold({
			sourcePath: "/tmp/.env",
			keys: ["API_KEY", "JWT_SECRET"],
		});
		expect(scaffold.content).toBe("");
		expect(scaffold.includedKeys).toEqual([]);
		expect(scaffold.omittedSecretCount).toBe(2);
	});

	it("returns an empty scaffold for null/empty discovery", () => {
		expect(emitShellEnvPolicyScaffold(null).content).toBe("");
		expect(emitShellEnvPolicyScaffold({ sourcePath: "/tmp/.env", keys: [] }).content).toBe("");
	});

	it("end-to-end: source .env values NEVER reach the emitted scaffold (sentinel proof)", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-shell-env-"));
		const envPath = join(root, ".env");
		await writeFile(
			envPath,
			[`DATABASE_URL=${SENTINEL}`, `OPENAI_API_KEY=${SENTINEL}`, `LOG_LEVEL=${SENTINEL}`].join("\n"),
		);

		const discovery = await discoverEnvKeys(envPath);
		const scaffold = emitShellEnvPolicyScaffold(discovery);

		// The scaffold contains ZERO values from the source .env.
		expect(scaffold.content).not.toContain(SENTINEL);
		expect(JSON.stringify(scaffold)).not.toContain(SENTINEL);
		// And the secret-named key is excluded, non-secret key scaffolded inert.
		expect(scaffold.content).toContain("DATABASE_URL = \"<fill-me>\"");
		expect(scaffold.content).not.toContain("OPENAI_API_KEY");
		expect(scaffold.omittedSecretCount).toBe(1);
	});
});
