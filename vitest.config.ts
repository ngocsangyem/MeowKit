import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const orchvizWebRoot = resolve(__dirname, "packages", "mewkit", "src", "orchviz-web");

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: { "@": orchvizWebRoot },
		// Force a single React copy so hooks work under any installer layout.
		// pnpm's nested node_modules can resolve two React instances (react-dom
		// binds one, the component binds another) → null hooks dispatcher.
		dedupe: ["react", "react-dom"],
	},
	test: {
		fileParallelism: false,
		// plugin/** is a generated mirror of .claude/ (via `mewkit build-plugin`); its
		// test files are duplicates of source tests and must not be collected here.
		// `*.test.cjs` under `.claude/` are node-native `assert` tests (run via `node`/`node --test`
		// in CI), NOT vitest suites — Vitest would collect them and report "No test suite found".
		// Exclude the whole class here rather than one file at a time.
		// The authored Codex bundle under migrate/modules/codex/root is COPIED
		// `.claude/` skill data (its own scripts/tests come along verbatim); those are
		// data, not this package's suites, so exclude them from collection. (The bundle
		// was restructured to the `root/` mirror layout — `.agents/skills`, `.codex/…` —
		// so the exclude keys off `modules/codex/root/**`, not the old `.../skills/**`.)
		exclude: [
			"**/node_modules/**",
			"**/dist/**",
			".claude/**/*.test.cjs",
			"plugin/**",
			"**/migrate/modules/codex/root/**",
		],
		environmentMatchGlobs: [
			["packages/mewkit/src/**/__tests__/**/*.test.tsx", "jsdom"],
			["packages/**/*.test.tsx", "jsdom"],
		],
	},
});
