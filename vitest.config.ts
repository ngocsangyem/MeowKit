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
		// Many suites here spawn real subprocesses (hooks, python, git). Running tests
		// within a file concurrently (vitest's default) bursts several subprocess-heavy
		// tests at once, and under load the OS kills some (a hook returns exit `null`),
		// which surfaces as a load-dependent flake. `fileParallelism: false` already
		// serializes files; this serializes tests WITHIN a file too, so peak subprocess
		// contention stays bounded. Determinism over raw speed for an integration suite.
		maxConcurrency: 1,
		// Integration tests here shell out to real hooks, python, git, and migrations,
		// which legitimately take 6-30s (e.g. doctor-hard-gates already sets a 30000ms
		// per-test timeout and passes at ~28s). Vitest's 5000ms default is too low for
		// this suite and produces load-dependent timeout flakes — and a mid-migration
		// timeout cascades into a sibling assertion failure. Raise the global ceiling to
		// match the slowest legitimate test rather than sprinkle per-test overrides.
		// This is not masking: the tests complete and pass well under this ceiling; only
		// the ceiling was wrong.
		testTimeout: 30000,
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
