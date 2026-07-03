import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { discoverEnvKeys, parseEnvKeyNames } from "../discovery/config-discovery.js";

// A unique, unmistakable sentinel value. If ANY output contains this string,
// the keys-only reader leaked a value — the hard security gate has failed.
const SENTINEL = "SUPER_SECRET_SENTINEL_VALUE_do_not_leak_9f3c2a";

describe("keys-only .env discovery", () => {
	it("parses key NAMES only and discards every value (sentinel never appears)", () => {
		const content = [
			`# a comment`,
			``,
			`DATABASE_URL=${SENTINEL}`,
			`export API_BASE=${SENTINEL}`,
			`  FEATURE_FLAG = ${SENTINEL} `,
			`MALFORMED`,
			`=novalue`,
			`9BAD=${SENTINEL}`,
			`DATABASE_URL=${SENTINEL}`, // duplicate → deduped
		].join("\n");

		const keys = parseEnvKeyNames(content);

		expect(keys).toEqual(["DATABASE_URL", "API_BASE", "FEATURE_FLAG"]);
		// Hard gate: no value from the source ever surfaces in the output.
		expect(JSON.stringify(keys)).not.toContain(SENTINEL);
	});

	it("the discovery structure holds ZERO values from the source file", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-env-keys-"));
		const envPath = join(root, ".env");
		await writeFile(
			envPath,
			[`OPENAI_API_KEY=${SENTINEL}`, `PROJECT_ID=${SENTINEL}`, `LOG_LEVEL=${SENTINEL}`].join("\n"),
		);

		const discovery = await discoverEnvKeys(envPath);

		expect(discovery).not.toBeNull();
		expect(discovery?.keys).toEqual(["OPENAI_API_KEY", "PROJECT_ID", "LOG_LEVEL"]);
		// Serialize the ENTIRE structure — the sentinel value must be absent from
		// every field. This is the input-side leak proof.
		expect(JSON.stringify(discovery)).not.toContain(SENTINEL);
	});

	it("returns null when the file does not exist", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-env-keys-missing-"));
		expect(await discoverEnvKeys(join(root, ".env"))).toBeNull();
	});
});
