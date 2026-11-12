import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		fileParallelism: false,
		// Match the root config: integration tests here shell out to real subprocesses
		// (hooks, python, git, migrations) that legitimately run 6-30s; the 5000ms default
		// produces load-dependent timeout flakes, and within-file concurrency bursts
		// subprocesses so the OS kills some under load. See vitest.config.ts (root).
		testTimeout: 30000,
		maxConcurrency: 1,
		include: [
			"tests/**/*.test.ts",
			"src/**/__tests__/**/*.test.ts",
		],
		// Live-Cursor integration tests (real IDE/CLI, only runnable when Cursor is
		// installed) live in their own `*.live.test.ts` files and run via the
		// separate `npm run test:live-cursor` command (vitest.live-cursor.config.ts)
		// — never in this serialized unit suite, so a hanging live fixture can never
		// stall it.
		exclude: ["**/*.live.test.ts"],
	},
});
