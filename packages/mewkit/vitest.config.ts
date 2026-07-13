import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
	plugins: [react()],
	test: {
		fileParallelism: false,
		include: [
			"tests/**/*.test.ts",
			"src/**/__tests__/**/*.test.{ts,tsx}",
			"visual-plan-web/**/__tests__/**/*.test.{ts,tsx}",
		],
		environmentMatchGlobs: [
			["src/**/__tests__/**/*.test.tsx", "jsdom"],
			["visual-plan-web/**/__tests__/**/*.test.tsx", "jsdom"],
		],
	},
});
