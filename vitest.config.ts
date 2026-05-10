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
		exclude: ["**/node_modules/**", "**/dist/**", ".claude/hooks/__tests__/**/*.cjs"],
		environmentMatchGlobs: [
			["packages/mewkit/src/**/__tests__/**/*.test.tsx", "jsdom"],
			["packages/**/*.test.tsx", "jsdom"],
		],
	},
});
