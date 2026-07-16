"use strict";

const fs = require("node:fs");
const path = require("node:path");

const EVAL_DIR = path.join(__dirname, "..", ".claude", "skills", "visual-plan", "evals");
const REQUIRED = {
  "01-architecture-plan.json": ["--static", "phase-timeline", "architecture-diagram", "Mermaid", "--wf-*"],
  "02-ui-plan-wireframe.json": ["--static", "--wireframe", "wireframe-screen", "phase-timeline"],
  "03-multiphase-plan.json": ["--static", "phase-timeline", "file-map", "steps-checklist"],
};

function validateFixture(name, fixture) {
  const errors = [];
  if (!Array.isArray(fixture.skills) || fixture.skills.length !== 1 || fixture.skills[0] !== "visual-plan") errors.push("skills must contain only visual-plan");
  if (typeof fixture.query !== "string" || !fixture.query.trim()) errors.push("query is required");
  if (!Array.isArray(fixture.files) || fixture.files.length === 0) errors.push("files are required");
  if (!Array.isArray(fixture.expected_behavior) || fixture.expected_behavior.length === 0) errors.push("expected_behavior is required");
  for (const token of REQUIRED[name] || []) {
    const allText = [fixture.query, ...(fixture.expected_behavior || [])].join("\n");
    if (!allText.includes(token)) errors.push("missing contract: " + token);
  }
  if (fixture.query.includes("--wireframe") && !fixture.query.includes("--static")) errors.push("--wireframe requires --static");
  return errors;
}

function main() {
  let failures = 0;
  for (const name of Object.keys(REQUIRED)) {
    let fixture;
    try { fixture = JSON.parse(fs.readFileSync(path.join(EVAL_DIR, name), "utf8")); }
    catch (error) { console.error("FAIL " + name + ": " + error.message); failures += 1; continue; }
    const errors = validateFixture(name, fixture);
    if (errors.length) { console.error("FAIL " + name + ": " + errors.join("; ")); failures += 1; }
    else console.log("PASS " + name);
  }
  if (failures) process.exit(1);
}

if (require.main === module) main();
module.exports = { validateFixture };

