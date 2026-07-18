import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
	plugins: [react()],
	resolve: {
		// Force a single React copy so hooks work under any installer layout.
		// pnpm's nested node_modules can resolve two React instances (react-dom
		// binds one, the component binds another) → null hooks dispatcher.
		dedupe: ["react", "react-dom"],
	},
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
