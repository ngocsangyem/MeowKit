"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { parseArgs, run, summarize } = require("./run-canaries.cjs");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "prompt-enhancer-eval-"));

function writeAdapter(name, response) {
  const adapterPath = path.join(tempDir, name);
  const script = "#!/usr/bin/env node\n"
    + "process.stdin.resume();process.stdin.on('end',()=>process.stdout.write("
    + JSON.stringify(JSON.stringify(response)) + "));\n";
  fs.writeFileSync(adapterPath, script);
  fs.chmodSync(adapterPath, 0o755);
  return adapterPath;
}

function options(subject, judge, outDir) {
  return {
    "subject-adapter": subject,
    "judge-adapter": judge,
    "subject-model-label": "subject-fixture",
    "judge-model-label": "judge-fixture",
    tier: "core",
    out: outDir,
  };
}

assert.throws(() => parseArgs(["--tier", "core"]), /Missing --subject-adapter/);
assert.deepEqual(summarize({ dimensions: [{ name: "format compliance", verdict: "FAIL" }] }), { verdict: "HARD-FAIL", hardFail: true });
assert.deepEqual(summarize({ dimensions: [{ name: "Fabrication guard", verdict: "FAIL" }] }), { verdict: "HARD-FAIL", hardFail: true });

const subject = writeAdapter("subject", { output: "fixture output", kernel: "fixture kernel", transcript: { toolCalls: [] }, model: "fixture" });
const judge = writeAdapter("judge", { dimensions: [
  { name: "format compliance", verdict: "PASS" }, { name: "detection precision", verdict: "PASS" },
  { name: "fabrication guard", verdict: "PASS" }, { name: "intent preservation", verdict: "PASS" },
  { name: "model coupling", verdict: "PASS" },
  { name: "refusal", verdict: "PASS" }, { name: "migration", verdict: "PASS" },
  { name: "role boundary", verdict: "PASS" }, { name: "target convergence", verdict: "PASS" },
  { name: "content-language preservation", verdict: "PASS" },
], evidence: "fixture" });
const outputDir = path.join(tempDir, "result");
const previousGuard = process.env.PROMPT_ENHANCER_EVAL;

delete process.env.PROMPT_ENHANCER_EVAL;
assert.throws(() => run(options(subject, judge, outputDir)), /PROMPT_ENHANCER_EVAL=1/);

process.env.PROMPT_ENHANCER_EVAL = "1";
const artifact = run(options(subject, judge, outputDir));
assert.equal(artifact.cases.length, 17);
assert.equal(artifact.totals.PASS, 17);
assert.equal(JSON.parse(fs.readFileSync(path.join(outputDir, "run.json"), "utf8")).schemaVersion, 1);
assert.match(fs.readFileSync(path.join(outputDir, "summary.md"), "utf8"), /canary-01: PASS/);

if (previousGuard === undefined) delete process.env.PROMPT_ENHANCER_EVAL;
else process.env.PROMPT_ENHANCER_EVAL = previousGuard;
fs.rmSync(tempDir, { recursive: true, force: true });
console.log("prompt-enhancer canary runner: PASS");
