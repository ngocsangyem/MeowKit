#!/usr/bin/env node
/**
 * Build templates from system/ for npm packaging.
 * Cross-platform replacement for build-templates.sh (no rsync dependency).
 * Uses Node.js stdlib only: fs.cpSync, fs.mkdirSync, fs.writeFileSync.
 */
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_DIR = resolve(__dirname, "..");
const SYSTEM_DIR = resolve(PKG_DIR, "..", "..", "system");
const SOURCE_CLAUDE = join(SYSTEM_DIR, "claude");
const TEMPLATES = join(PKG_DIR, "templates");

/** Patterns to exclude from copy */
const SKIP_PATTERNS = [
  "__pycache__",
  "node_modules",
  ".DS_Store",
  ".pyc",
  ".env",
  ".venv",
  "venv",
];

function shouldSkip(src) {
  if (SKIP_PATTERNS.some((p) => src.includes(p))) return true;
  // Skip internal docs not needed in user projects
  if (src.endsWith("_INDEX.md")) return true;
  if (src.endsWith("SKILLS_ATTRIBUTION.md")) return true;
  return false;
}

// Validate source exists
if (!existsSync(SOURCE_CLAUDE)) {
  console.error(`ERROR: system/claude/ not found at ${SOURCE_CLAUDE}`);
  process.exit(1);
}

console.log(`Building templates from ${SYSTEM_DIR} ...`);

// Clean previous templates
if (existsSync(TEMPLATES)) {
  rmSync(TEMPLATES, { recursive: true });
}
mkdirSync(join(TEMPLATES, "claude"), { recursive: true });

// Copy core system directories
const CORE_DIRS = ["agents", "commands", "hooks", "modes", "rules", "scripts", "skills"];

for (const dir of CORE_DIRS) {
  const src = join(SOURCE_CLAUDE, dir);
  const dest = join(TEMPLATES, "claude", dir);
  if (existsSync(src)) {
    cpSync(src, dest, {
      recursive: true,
      filter: (s) => !shouldSkip(s),
    });
  }
}

// Copy settings.json
const settingsSrc = join(SOURCE_CLAUDE, "settings.json");
if (existsSync(settingsSrc)) {
  cpSync(settingsSrc, join(TEMPLATES, "claude", "settings.json"));
}

// Copy tasks/ directory (templates, guidelines, etc.)
const TASKS_SRC = join(SYSTEM_DIR, "tasks");
if (existsSync(TASKS_SRC)) {
  cpSync(TASKS_SRC, join(TEMPLATES, "tasks"), {
    recursive: true,
    filter: (s) => !shouldSkip(s),
  });
}

// Create empty memory directory marker
mkdirSync(join(TEMPLATES, "claude", "memory"), { recursive: true });
writeFileSync(join(TEMPLATES, "claude", "memory", ".gitkeep"), "");

// Create CLAUDE.md template with optional description placeholder
const realClaude = join(SYSTEM_DIR, "CLAUDE.md");

if (existsSync(realClaude)) {
  let content = readFileSync(realClaude, "utf-8");
  writeFileSync(join(TEMPLATES, "claude-md.template"), content);
} else {
  console.warn(`WARNING: CLAUDE.md not found at ${realClaude}`);
  writeFileSync(
    join(TEMPLATES, "claude-md.template"),
    "# AI Agent Workflow System\n\nSee .claude/ for agents, skills, commands, modes, rules, and hooks.\n"
  );
}

// Create config.json template
writeFileSync(
  join(TEMPLATES, "meowkit-config.json.template"),
  JSON.stringify(
    {
      $schema: "https://meowkit.dev/schema/config.json",
      version: "1.0.0",
      project: { description: "__MEOWKIT_DESCRIPTION__" },
      features: { costTracking: "__MEOWKIT_COST_TRACKING__", memory: "__MEOWKIT_MEMORY_ENABLED__" },
    },
    null,
    2
  )
    .replace(/"__MEOWKIT_COST_TRACKING__"/g, "__MEOWKIT_COST_TRACKING__")
    .replace(/"__MEOWKIT_MEMORY_ENABLED__"/g, "__MEOWKIT_MEMORY_ENABLED__") +
    "\n"
);

// Copy static files from system/
for (const file of ["env.example", "mcp.json.example", "gitignore.meowkit"]) {
  const src = join(SYSTEM_DIR, file);
  if (existsSync(src)) {
    cpSync(src, join(TEMPLATES, file));
  } else {
    console.warn(`WARNING: ${file} not found in system/`);
  }
}

// Count results
let fileCount = 0;
function countFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) countFiles(join(dir, entry.name));
    else fileCount++;
  }
}
countFiles(TEMPLATES);

console.log(`Templates built: ${fileCount} files`);
