#!/usr/bin/env node
/**
 * seed-ownership-metadata.cjs
 *
 * One-shot IDEMPOTENT seeder that applies governance metadata to every harness artifact:
 *   - Skills  (.claude/skills/{name}/SKILL.md):  injects owner/criticality/status/runtime into YAML frontmatter
 *   - Agents  (.claude/agents/{name}.md):        same
 *   - Rules, commands, hooks:                    writes entries into .claude/harness-inventory.json
 *
 * Safe to re-run — already-present fields are not overwritten; registry entries are merged.
 * NOT wired to CI. Run once, then hand-promote critical/high values as needed.
 *
 * Governance owner is distinct from install-metadata.ts owner (install provenance).
 * See .claude/schemas/harness-metadata-schema.json for allowed enum values.
 *
 * Usage (from meowkit/ root):
 *   node scripts/seed-ownership-metadata.cjs [--dry-run]
 */

"use strict";

const fs   = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// js-yaml resolution: try packages/mewkit then repo root node_modules
// ---------------------------------------------------------------------------
let yaml;
try {
  yaml = require(require.resolve("js-yaml", {
    paths: [
      path.join(__dirname, "../packages/mewkit/node_modules"),
      path.join(__dirname, "../node_modules"),
    ],
  }));
} catch (e) {
  console.error("Cannot resolve js-yaml. Run: npm install in packages/mewkit or repo root.");
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const DRY_RUN = process.argv.includes("--dry-run");
const ROOT     = path.resolve(__dirname, "..");
const CLAUDE   = path.join(ROOT, ".claude");

// Known runtime-only dirs that should be skipped (no SKILL.md expected)
const SKILLS_DENYLIST = new Set([".venv", "__pycache__", "node_modules", "SKILLS_ATTRIBUTION.md"]);

// ---------------------------------------------------------------------------
// Owner heuristics — derive from directory/file name patterns
// ---------------------------------------------------------------------------
function deriveOwner(name) {
  // name = skill dir name, agent basename, rule basename, command basename, or hook basename
  if (/^jira/.test(name))              return "jira";
  if (/^confluence/.test(name))        return "confluence";
  if (/^(gate-enforcement|privacy-block|secret-scrub|control-probe)/.test(name)) return "security";
  if (/^(memory|mk-loop)/.test(name))  return "memory";
  if (/^(cook|plan-creator|plan-ceo-review|planning-engine|workflow-orchestrator|ship|review|autobuild|validate-plan|agent-detector|bootstrap|pack|freeze)/.test(name)) return "lifecycle";
  if (/^(scout|investigate|sequential-thinking|brainstorming|decision-framework|elicit|problem-solving|office-hours|party|careful|intake|help|nyquist|henshin|chom|mk-loop|lazy-agent-loader)/.test(name)) return "research";
  if (/^(testing|benchmark|qa|qa-manual|playwright-cli|verify|lint-and-validate|build-fix|rubric|evaluate)/.test(name)) return "testing";
  if (/^(docs-finder|docs-init|document-release|project-context|project-organization|llms|web-to-markdown|retro|preview|session-continuation|fix|simplify|context-audit|prompt-enhancer)/.test(name)) return "docs";
  if (/^(git-manager|worktree|ship|task-queue|team-config)/.test(name) && !/^ship/.test(name)) return "git";
  if (/^(trace-analyze|append-trace|learning-observer|post-session|posttoolfailure-probe|precompact-probe|pre-task-check)/.test(name)) return "observability";
  if (/^(portability|skill-creator|skill-template-secure|api-design|scale-routing)/.test(name)) return "portability";
  if (/^(sprint-contract|story-sizer|breakdown)/.test(name)) return "lifecycle";
  if (/^(typescript|angular|vue|react-patterns|frontend-design|ui-design-system|figma|database|clean-code|development|multimodal|cso|vulnerability-scanner)/.test(name)) return "utility";
  // Hooks by pattern
  if (/^(pre-implement|pre-ship|pre-completion-check|post-write|tdd-flag-detector|ensure-skills-venv|project-context-loader|jira-env-loader)/.test(name)) return "lifecycle";
  if (/^(append-trace|learning-observer|post-session|posttoolfailure-probe|precompact-probe|pre-task-check|control-probe)/.test(name)) return "observability";
  // Agents by role
  if (/^(orchestrator|planner|developer|architect|brainstormer|project-manager|story-sizer)/.test(name)) return "lifecycle";
  if (/^(security|reviewer|evaluator|tester)/.test(name)) return "testing";
  if (/^(researcher)/.test(name)) return "research";
  if (/^(documenter|journal-writer|analyst|ui-ux-designer)/.test(name)) return "docs";
  if (/^(git-manager|shipper)/.test(name)) return "git";
  return "utility";
}

// Runtime heuristic — skills and agents require Claude Code; hooks do too
function deriveRuntime(/* name */) {
  return "claude-code";
}

// ---------------------------------------------------------------------------
// YAML frontmatter parse + rewrite (idempotent field injection)
// ---------------------------------------------------------------------------
const FM_REGEX = /^---\r?\n([\s\S]*?)\r?\n---/;

function parseFm(text) {
  const m = text.match(FM_REGEX);
  if (!m) return { hasFm: false, fmText: "", rest: text, parsed: {} };
  const fmText = m[1];
  try {
    const parsed = yaml.load(fmText) || {};
    const rest = text.slice(m[0].length);
    return { hasFm: true, fmText, rest, parsed };
  } catch (e) {
    return { hasFm: false, fmText: "", rest: text, parsed: {} };
  }
}

/**
 * Inject governance fields into a parsed frontmatter object.
 * Idempotent: already-set fields are NOT overwritten.
 * Returns { changed: boolean, updated: object }
 */
function injectGovernanceFields(parsed, defaults) {
  let changed = false;
  const updated = Object.assign({}, parsed);

  for (const [key, val] of Object.entries(defaults)) {
    if (!(key in updated)) {
      updated[key] = val;
      changed = true;
    }
  }

  // Promote context_cost from meowkit block to top-level (keep nested copy intact)
  if (!("context_cost" in updated) && updated.meowkit && typeof updated.meowkit === "object") {
    const nested = updated.meowkit.context_cost;
    if (nested) {
      updated.context_cost = nested;
      changed = true;
    }
  }

  return { changed, updated };
}

/**
 * Rewrite SKILL.md / agent .md with updated frontmatter.
 * Preserves existing key order: new governance fields append after existing content.
 */
function rewriteWithFm(originalText, updatedParsed) {
  const m = originalText.match(FM_REGEX);
  const rest = m ? originalText.slice(m[0].length) : `\n${originalText}`;
  const newFm = yaml.dump(updatedParsed, { lineWidth: -1, quotingType: '"', forceQuotes: false }).trimEnd();
  return `---\n${newFm}\n---${rest}`;
}

// ---------------------------------------------------------------------------
// Skills enumeration
// ---------------------------------------------------------------------------
function collectSkills(skillsRoot) {
  const results = [];
  if (!fs.existsSync(skillsRoot)) return results;
  for (const entry of fs.readdirSync(skillsRoot)) {
    if (SKILLS_DENYLIST.has(entry)) continue;
    const skillMd = path.join(skillsRoot, entry, "SKILL.md");
    if (fs.existsSync(skillMd)) {
      results.push({ name: entry, mdPath: skillMd });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Agents enumeration
// ---------------------------------------------------------------------------
function collectAgents(agentsRoot) {
  const results = [];
  if (!fs.existsSync(agentsRoot)) return results;
  for (const entry of fs.readdirSync(agentsRoot)) {
    if (!entry.endsWith(".md")) continue;
    // Skip INDEX files per spec
    if (/_INDEX\.md$/.test(entry)) continue;
    const mdPath = path.join(agentsRoot, entry);
    if (fs.statSync(mdPath).isFile()) {
      results.push({ name: entry.replace(/\.md$/, ""), mdPath });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Rules, rules-conditional, commands, hooks enumeration
// ---------------------------------------------------------------------------
function collectRegistryArtifacts(claudeRoot) {
  const artifacts = [];

  // Rules
  const rulesDir = path.join(claudeRoot, "rules");
  if (fs.existsSync(rulesDir)) {
    for (const f of fs.readdirSync(rulesDir)) {
      if (f.endsWith(".md")) {
        artifacts.push({ registryKey: `rules/${f}`, name: f.replace(/\.md$/, "") });
      }
    }
  }

  // Rules-conditional
  const rulesCondDir = path.join(claudeRoot, "rules-conditional");
  if (fs.existsSync(rulesCondDir)) {
    for (const f of fs.readdirSync(rulesCondDir)) {
      if (f.endsWith(".md")) {
        artifacts.push({ registryKey: `rules-conditional/${f}`, name: f.replace(/\.md$/, "") });
      }
    }
  }

  // Commands under commands/mk/
  const commandsDir = path.join(claudeRoot, "commands", "mk");
  if (fs.existsSync(commandsDir)) {
    for (const f of fs.readdirSync(commandsDir)) {
      if (f.endsWith(".md")) {
        artifacts.push({ registryKey: `commands/mk/${f}`, name: f.replace(/\.md$/, "") });
      }
    }
  }

  // Hooks — only *.sh in hooks/ root (not subdirs)
  const hooksDir = path.join(claudeRoot, "hooks");
  if (fs.existsSync(hooksDir)) {
    for (const f of fs.readdirSync(hooksDir)) {
      if (f.endsWith(".sh") && fs.statSync(path.join(hooksDir, f)).isFile()) {
        artifacts.push({ registryKey: `hooks/${f}`, name: f.replace(/\.sh$/, "") });
      }
    }
  }

  return artifacts;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const skillsRoot  = path.join(CLAUDE, "skills");
  const agentsRoot  = path.join(CLAUDE, "agents");
  const inventoryPath = path.join(CLAUDE, "harness-inventory.json");

  let skillsProcessed  = 0;
  let skillsModified   = 0;
  let agentsProcessed  = 0;
  let agentsModified   = 0;

  // ---- Skills frontmatter ----
  const skills = collectSkills(skillsRoot);
  for (const { name, mdPath } of skills) {
    skillsProcessed++;
    const text = fs.readFileSync(mdPath, "utf-8");
    const { hasFm, rest, parsed } = parseFm(text);

    if (!hasFm) {
      console.warn(`WARN: no frontmatter in ${mdPath} — skipping`);
      continue;
    }

    const defaults = {
      owner:       deriveOwner(name),
      criticality: "medium",
      status:      "active",
      runtime:     deriveRuntime(name),
    };

    const { changed, updated } = injectGovernanceFields(parsed, defaults);
    if (changed) {
      skillsModified++;
      if (!DRY_RUN) {
        // Rebuild file: updated frontmatter + original rest
        const newText = `---\n${yaml.dump(updated, { lineWidth: -1 }).trimEnd()}\n---${rest}`;
        fs.writeFileSync(mdPath, newText, "utf-8");
      }
      console.log(`  skill ${name}: injected governance fields`);
    }
  }

  // ---- Agents frontmatter ----
  const agents = collectAgents(agentsRoot);
  for (const { name, mdPath } of agents) {
    agentsProcessed++;
    const text = fs.readFileSync(mdPath, "utf-8");
    const { hasFm, rest, parsed } = parseFm(text);

    if (!hasFm) {
      console.warn(`WARN: no frontmatter in ${mdPath} — skipping`);
      continue;
    }

    const defaults = {
      owner:       deriveOwner(name),
      criticality: "medium",
      status:      "active",
      runtime:     deriveRuntime(name),
    };

    const { changed, updated } = injectGovernanceFields(parsed, defaults);
    if (changed) {
      agentsModified++;
      if (!DRY_RUN) {
        const newText = `---\n${yaml.dump(updated, { lineWidth: -1 }).trimEnd()}\n---${rest}`;
        fs.writeFileSync(mdPath, newText, "utf-8");
      }
      console.log(`  agent ${name}: injected governance fields`);
    }
  }

  // ---- Registry (rules + commands + hooks) ----
  const registryArtifacts = collectRegistryArtifacts(CLAUDE);

  // Load existing inventory if present (idempotent merge)
  let inventory = { schema_version: 1, artifacts: {} };
  if (fs.existsSync(inventoryPath)) {
    try {
      inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf-8"));
      if (!inventory.artifacts) inventory.artifacts = {};
    } catch (e) {
      console.warn(`WARN: could not parse existing inventory — overwriting`);
    }
  }

  let registryAdded   = 0;
  for (const { registryKey, name } of registryArtifacts) {
    if (registryKey in inventory.artifacts) continue; // idempotent
    inventory.artifacts[registryKey] = {
      owner:       deriveOwner(name),
      criticality: "medium",
      status:      "active",
      runtime:     "claude-code",
    };
    registryAdded++;
    console.log(`  registry: added ${registryKey}`);
  }

  if (registryAdded > 0 && !DRY_RUN) {
    fs.writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2) + "\n", "utf-8");
  } else if (registryAdded === 0) {
    // Still write if file didn't exist
    if (!fs.existsSync(inventoryPath) && !DRY_RUN) {
      fs.writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2) + "\n", "utf-8");
    }
  }

  // ---- Summary ----
  const mode = DRY_RUN ? " [DRY RUN — no files written]" : "";
  console.log(`\nSummary${mode}:`);
  console.log(`  Skills:   ${skillsProcessed} scanned, ${skillsModified} modified`);
  console.log(`  Agents:   ${agentsProcessed} scanned, ${agentsModified} modified`);
  console.log(`  Registry: ${Object.keys(inventory.artifacts).length} total entries (${registryAdded} added this run)`);
  console.log(`\nNext: hand-promote criticality on safety/lifecycle artifacts.`);
}

main();
