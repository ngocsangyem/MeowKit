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
		exclude: ["**/node_modules/**", "**/dist/**", ".claude/hooks/__tests__/**/*.cjs", "plugin/**"],
		environmentMatchGlobs: [
			["packages/mewkit/src/**/__tests__/**/*.test.tsx", "jsdom"],
			["packages/**/*.test.tsx", "jsdom"],
		],
	},
});
