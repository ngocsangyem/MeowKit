import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const orchvizWebRoot = resolve(__dirname, "packages", "mewkit", "src", "orchviz-web");

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: { "@": orchvizWebRoot },
	},
	test: {
		fileParallelism: false,
		// plugin/** is a generated mirror of .claude/ (via `mewkit build-plugin`); its
		// test files are duplicates of source tests and must not be collected here.
		// `*.test.cjs` under `.claude/` are node-native `assert` tests (run via `node`/`node --test`
		// in CI), NOT vitest suites — Vitest would collect them and report "No test suite found".
		// Exclude the whole class here rather than one file at a time.
		exclude: ["**/node_modules/**", "**/dist/**", ".claude/**/*.test.cjs", "plugin/**"],
		environmentMatchGlobs: [
			["packages/mewkit/src/**/__tests__/**/*.test.tsx", "jsdom"],
			["packages/**/*.test.tsx", "jsdom"],
		],
	},
});
