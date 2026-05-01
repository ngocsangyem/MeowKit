import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const orchvizWebRoot = resolve(__dirname, "src", "orchviz-web");

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: { "@": orchvizWebRoot },
	},
	test: {
		fileParallelism: false,
		include: [
			"tests/**/*.test.ts",
			"src/**/__tests__/**/*.test.{ts,tsx}",
			"packages/**/__tests__/**/*.test.{ts,tsx}",
		],
		environmentMatchGlobs: [
			["src/**/__tests__/**/*.test.tsx", "jsdom"],
			["packages/**/*.test.tsx", "jsdom"],
		],
	},
});
