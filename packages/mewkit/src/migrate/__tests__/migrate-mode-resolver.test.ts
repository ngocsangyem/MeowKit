import { afterEach, describe, expect, it, vi } from "vitest";
import {
	MewkitMigrateError,
	selectProviders,
	validateFlags,
	warnUnverifiedProviders,
} from "../migrate-mode-resolver.js";
import { applyMewkitOverrides } from "../provider-overrides.js";
import { providers } from "../provider-registry.js";

describe("migrate-mode-resolver", () => {
	it("rejects unknown/removed tool names, listing the supported targets", async () => {
		await expect(selectProviders({ tool: "roo" })).rejects.toMatchObject<MewkitMigrateError>({
			exitCode: 2,
		});
	});

	describe("deprecated-provider enforcement", () => {
		const originalSupportLevel = providers.cursor.supportLevel;
		const originalSupportReason = providers.cursor.supportReason;

		afterEach(() => {
			providers.cursor.supportLevel = originalSupportLevel;
			providers.cursor.supportReason = originalSupportReason;
		});

		it("rejects a deprecated provider unless forced", async () => {
			providers.cursor.supportLevel = "deprecated";
			await expect(selectProviders({ tool: "cursor" })).rejects.toMatchObject<MewkitMigrateError>({
				exitCode: 2,
			});
		});

		it("allows a deprecated provider when forced", async () => {
			providers.cursor.supportLevel = "deprecated";
			await expect(selectProviders({ tool: "cursor", force: true })).resolves.toEqual(["cursor"]);
		});
	});

	it("rejects unused source-version flag", () => {
		expect(() => validateFlags({ sourceVersion: "1.9.0" }, [])).toThrow("--source-version is not used");
	});

	it("warns for experimental providers", () => {
		applyMewkitOverrides();
		const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
		warnUnverifiedProviders(["codex"]);
		expect(spy).toHaveBeenCalledWith(expect.stringContaining("Codex support is EXPERIMENTAL"));
		spy.mockRestore();
	});
});
