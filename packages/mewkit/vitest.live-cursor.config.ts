import { defineConfig } from "vitest/config";

// Separate test project for live-Cursor integration tests (real installed
// Cursor IDE/CLI, per phase-04's Step 6: "each gate blocks/allows as designed;
// skip-not-fail when Cursor absent"). Kept in its own config/command
// (`npm run test:live-cursor`) so a hanging live fixture can NEVER stall the
// serialized unit suite in vitest.config.ts, which explicitly excludes
// `**/*.live.test.ts`. `passWithNoTests` is on because this suite is allowed
// to be empty until a later phase authors real `*.live.test.ts` files.
export default defineConfig({
	test: {
		fileParallelism: false,
		maxConcurrency: 1,
		testTimeout: 60000,
		passWithNoTests: true,
		include: ["src/**/__tests__/**/*.live.test.ts", "tests/**/*.live.test.ts"],
	},
});
