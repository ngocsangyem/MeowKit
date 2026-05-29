import { describe, expect, it, vi } from "vitest";
import { MewkitMigrateError, selectProviders, validateFlags, warnUnverifiedProviders } from "../migrate-mode-resolver.js";
import { applyMewkitOverrides } from "../provider-overrides.js";

describe("migrate-mode-resolver", () => {
	it("rejects deprecated providers unless forced", async () => {
		await expect(selectProviders({ tool: "roo" })).rejects.toMatchObject<MewkitMigrateError>({
			exitCode: 2,
		});
	});

	it("allows deprecated providers when forced", async () => {
		await expect(selectProviders({ tool: "roo", force: true })).resolves.toEqual(["roo"]);
	});

	it("rejects unused source-version flag", () => {
		expect(() => validateFlags({ sourceVersion: "1.9.0" }, [])).toThrow("--source-version is not used");
	});

	it("warns for experimental and unverified providers", () => {
		applyMewkitOverrides();
		const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
		warnUnverifiedProviders(["codex", "kilo"]);
		expect(spy).toHaveBeenCalledWith(expect.stringContaining("Codex support is EXPERIMENTAL"));
		expect(spy).toHaveBeenCalledWith(expect.stringContaining("Kilo Code support is EXPERIMENTAL"));
		expect(spy).toHaveBeenCalledWith(expect.stringContaining("Kilo Code support is UNVERIFIED"));
		spy.mockRestore();
	});
});
