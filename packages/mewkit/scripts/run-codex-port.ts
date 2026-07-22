// One-time runner: port the authored `.claude/` tree into the `modules/codex/`
// bundle (agents/ + skills/). Authored AGENTS.md / config.toml / hooks.json /
// hooks/ and manifest.json are left in place; only the derived agents/ and skills/
// trees are regenerated. Run: `npx tsx packages/mewkit/scripts/run-codex-port.ts`.
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { portAll } from "../src/migrate/modules/porter/port-claude-to-codex.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const claudeDir = join(repoRoot, ".claude");
const outDir = join(here, "..", "src", "migrate", "modules", "codex");

for (const derived of ["agents", "skills"]) rmSync(join(outDir, derived), { recursive: true, force: true });
const summary = portAll(claudeDir, outDir);
console.log(`Ported → ${outDir}`);
console.log(JSON.stringify(summary, null, 2));
