#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const rows = [
  ["brainstorming", "M", "Opt-in scenario runner", "not run in PR CI"],
  ["cook", "D", "Cook gate contract tests", "passed earlier in this CI run", /run:\s+bash .claude\/skills\/cook\/scripts\/test-scripts\.sh/],
  ["fix", "D", "Fix skill contract tests", "passed earlier in this CI run", /run:\s+bash tests\/fix-skill-contract\.test\.sh/],
  ["docs-finder", "D", "Docs-finder offline tests", "passed earlier in this CI run", /run:\s+node .claude\/skills\/docs-finder\/scripts\/tests\/run-tests\.js/],
  ["figma", "D", "Validate Figma evidence packet fixtures", "passed earlier in this CI run", /run:\s+.claude\/skills\/\.venv\/bin\/python3 .claude\/skills\/figma\/evals\/validate-evidence-packets\.py/],
  ["intake", "D", "Intake ticket sanitizer tests", "passed earlier in this CI run", /run:\s+node .claude\/skills\/intake\/scripts\/sanitize-ticket\.test\.cjs/],
  ["multimodal", "D", "Multimodal mock tests", "passed earlier in this CI run", /run:\s+.claude\/skills\/\.venv\/bin\/python3 .claude\/skills\/multimodal\/scripts\/tests\/run_tests\.py/],
  ["plan-creator", "D", "Validate plan-creator compatibility fixtures", "passed earlier in this CI run", /run:\s+bash tests\/fixtures\/plan-creator\/validate-fixtures\.sh/],
  ["prompt-enhancer", "M", "Opt-in canary runner", "not run in PR CI"],
  ["rubric", "D", "Validate rubric schemas and presets", "passed earlier in this CI run", /run:\s+bash .claude\/skills\/rubric\/scripts\/validate-rubric\.sh/],
  ["sequential-thinking", "D", "Sequential-thinking script tests", "passed earlier in this CI run", /run:\s+bash .claude\/skills\/sequential-thinking\/scripts\/test-scripts\.sh/],
  ["skill-creator", "D", "Validate skill-creator fixtures", "passed earlier in this CI run", /run:\s+bash tests\/fixtures\/skill-creator\/validate-fixtures\.sh/],
  ["story-sizer", "D", "Story-sizer deterministic tests", "passed earlier in this CI run", /run:\s+bash tests\/story-sizer-all\.test\.sh/],
  ["visual-plan", "D", "Validate visual-plan eval fixtures", "passed earlier in this CI run", /run:\s+node scripts\/validate-visual-plan-evals\.cjs/],
  ["web-to-markdown", "D", "Test web-to-markdown URL SSRF guard", "passed earlier in this CI run", /run:\s+\|[\s\S]*?^[ \t]*\.claude\/skills\/\.venv\/bin\/python3 -m pytest[\s\S]*?test_safe_url\.py[\s\S]*?test_e2e_offline\.py[\s\S]*?-q/m],
  ["wiki-research", "D", "Wiki-research security corpus", "passed earlier in this CI run", /run:\s+npx vitest run packages\/mewkit\/src\/wiki\/infrastructure\/__tests__\/fetcher-adapter\.test\.ts packages\/mewkit\/src\/wiki\/infrastructure\/__tests__\/scanner-adapter\.test\.ts packages\/mewkit\/src\/wiki\/application\/__tests__\/research-quarantine\.test\.ts/],
  ["worktree", "D", "Worktree command contract tests", "passed earlier in this CI run", /run:\s+node .claude\/skills\/worktree\/scripts\/worktree\.test\.cjs/],
];

function assertCiSteps(workflow) {
  const reportIndex = workflow.indexOf("- name: Generate skill evaluation results");
  if (reportIndex < 0) throw new Error("CI result table generation step is missing");
  for (const [, track, step, , runner] of rows) {
    if (track !== "D") continue;
    const marker = `- name: ${step}`;
    const start = workflow.indexOf(marker);
    const end = workflow.indexOf("\n      - name:", start + marker.length);
    const block = workflow.slice(start, end < 0 ? workflow.length : end);
    if (start < 0 || start > reportIndex) throw new Error(`CI result step is absent or too late: ${step}`);
    if (/\n\s+(if|continue-on-error):/.test(block) || !runner.test(block)) {
      throw new Error(`CI result step is conditional, tolerated, or changed: ${step}`);
    }
  }
}

function render() {
  const header = [
    "# Skill evaluation results",
    "",
    "Generated only after preceding CI checks pass. Track M remains opt-in and is never represented as a PR result.",
    "",
    "| Skill | Track | CI step / runner | Result |",
    "| --- | --- | --- | --- |",
  ];
  return `${header.concat(rows.map((row) => `| ${row.slice(0, 4).join(" | ")} |`)).join("\n")}\n`;
}

function main(outputPath) {
  if (!outputPath) throw new Error("Usage: generate-eval-results.cjs <output.md>");
  const root = path.resolve(__dirname, "..");
  const workflow = fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
  assertCiSteps(workflow);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, render());
}

try {
  main(process.argv[2]);
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
}
