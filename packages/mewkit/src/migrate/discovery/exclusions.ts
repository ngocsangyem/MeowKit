// MeowKit-internal exclusion list. Hard-coded — no override.
// These are mewkit's framework dirs/files that must NEVER be migrated to external tools.
export const MEOWKIT_INTERNAL_DIRS = new Set([
	"memory",
	"session-state",
	"modes",
	"rubrics",
	"benchmarks",
	"logs",
	"node_modules",
	".git",
	"dist",
	"build",
	".venv",
	"__pycache__",
]);

export const MEOWKIT_INTERNAL_FILES = new Set([
	"metadata.json",
	"meowkit.config.json",
	"statusline.cjs",
	"mcp.json.example",
	"gitignore.meowkit",
	"settings.json.bak",
]);

export function isExcludedDir(name: string): boolean {
	return MEOWKIT_INTERNAL_DIRS.has(name) || name.startsWith(".");
}

export function isExcludedFile(name: string): boolean {
	return MEOWKIT_INTERNAL_FILES.has(name) || name.startsWith(".");
}
