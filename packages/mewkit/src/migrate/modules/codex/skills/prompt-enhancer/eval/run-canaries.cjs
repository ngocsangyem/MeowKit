#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { DEEP_IDS, selectCanaryIds } = require("./canary-run-manifest.cjs");
const { requireOptIn, runAdapter: invokeAdapter, writeArtifacts } = require("../../../eval/track-m-adapter-core.cjs");

const EVAL_DIR = __dirname;
const HARD_FAIL_DIMENSIONS = new Set([
  "fabrication guard", "intent preservation", "boundary respect", "role boundary",
  "content-language preservation", "target convergence",
]);
const REQUIRED_HARD_DIMENSIONS = {
  "canary-04": "model coupling",
  "canary-05": "detection precision", "canary-06": "refusal", "canary-09": "boundary respect",
  "canary-11": "role boundary", "canary-12": "role boundary", "canary-13": "migration",
  "canary-14": "role boundary", "canary-15": "role boundary", "canary-16": "target convergence",
  "canary-17": "target convergence", "canary-18": "content-language preservation",
  "canary-19": "content-language preservation", "canary-20": "role boundary", "canary-21": "format compliance",
};

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key.startsWith("--") || value === undefined) throw new Error(`Expected a value for ${key}`);
    options[key.slice(2)] = value;
  }
  for (const key of ["subject-adapter", "judge-adapter", "subject-model-label", "judge-model-label", "tier", "out"]) {
    if (!options[key]) throw new Error(`Missing --${key}`);
  }
  if (!new Set(["core", "deep", "all"]).has(options.tier)) throw new Error("--tier must be core, deep, or all");
  if ((options.tier === "deep" || options.tier === "all") && !options.fixture) {
    throw new Error("--fixture is required for deep or all tiers");
  }
  return options;
}

function extractSection(content, heading) {
  const start = content.indexOf(`## ${heading}`);
  const afterHeading = start >= 0 && content.slice(start + heading.length + 3);
  const nextHeading = afterHeading && afterHeading.indexOf("\n## ");
  const section = nextHeading > 0 ? afterHeading.slice(0, nextHeading) : afterHeading;
  const match = section && section.match(/```\n([\s\S]*?)\n```/);
  if (!match) throw new Error(`Missing ${heading} code block`);
  return match[1];
}

function findCanary(id) {
  const prefix = `canary-${id}-`;
  const file = fs.readdirSync(EVAL_DIR).find((name) => name.startsWith(prefix) && name.endsWith(".md"));
  if (!file) throw new Error(`Canary ${id} was not found`);
  const content = fs.readFileSync(path.join(EVAL_DIR, file), "utf8");
  const input = id === "10" ? null : extractSection(content, "Input");
  const inputs = id === "10"
    ? [...content.matchAll(/```\n(\the prompt-enhancer skill[^\n]*)\n```/g)].map((match, index) => ({ name: index === 0 ? "default" : "deep", prompt: match[1] }))
    : [{ name: "primary", prompt: input }];
  if (id === "10" && inputs.length !== 2) throw new Error("Canary 10 requires default and deep prompts");
  if (id === "16") inputs.push({ name: "no-target", prompt: input.replace(" for Codex:", ":") });
  if (id === "17") inputs.push({ name: "analyze", prompt: `--analyze ${input}` });
  return { id: `canary-${id}`, file, inputs, expected: content.split("## Expected", 2)[1]?.trim() ?? "" };
}

function runAdapter(adapterPath, request) {
  return invokeAdapter(adapterPath, request);
}

function currentFixtureSha(fixturePath) {
  const result = childProcess.spawnSync("git", ["-C", fixturePath, "rev-parse", "HEAD"], { encoding: "utf8" });
  if (result.status !== 0) throw new Error("--fixture must be a git repository");
  return result.stdout.trim();
}

function baselineFixtureSha() {
  const report = fs.readFileSync(path.join(EVAL_DIR, "baseline-results.md"), "utf8").split("## Schema", 1)[0];
  const matches = [...report.matchAll(/^Fixture sha:\s*(.+)$/gm)];
  const sha = matches.at(-1)?.[1]?.trim();
  return sha && sha !== "n/a" ? sha : null;
}

function baselineVerdicts() {
  const report = fs.readFileSync(path.join(EVAL_DIR, "baseline-results.md"), "utf8").split("## Schema", 1)[0];
  return Object.fromEntries([...report.matchAll(/^\|\s*(canary-\d+-[^|]+)\s*\|\s*(PASS|FAIL|HARD-FAIL)\s*\|/gm)].map((match) => [match[1].trim(), match[2]]));
}

function summarize(judgement, canaryId) {
  if (!Array.isArray(judgement.dimensions) || judgement.dimensions.length === 0) return { verdict: "UNJUDGABLE", hardFail: false };
  const failed = judgement.dimensions.filter((item) => item?.verdict === "FAIL");
  const requiredDimensions = ["fabrication guard", "intent preservation", REQUIRED_HARD_DIMENSIONS[canaryId]].filter(Boolean);
  const requiredPasses = requiredDimensions.every((required) => judgement.dimensions.some((item) => String(item.name).toLowerCase() === required && item.verdict === "PASS"));
  const hardFail = !requiredPasses || failed.some((item) => item.severity === "HARD-FAIL" || HARD_FAIL_DIMENSIONS.has(String(item.name).toLowerCase()));
  return { verdict: failed.length === 0 && requiredPasses ? "PASS" : hardFail ? "HARD-FAIL" : "FAIL", hardFail };
}

function pairedInvariant(canaryId, subjects) {
  if (canaryId === "canary-10" && (!subjects.every((item) => typeof item.kernel === "string" && typeof item.sections123 === "string") || subjects[0].kernel !== subjects[1].kernel || subjects[0].sections123 !== subjects[1].sections123)) {
    return "default and deep output diverges outside deep-only additions";
  }
  if (canaryId === "canary-16" && (!subjects.every((item) => typeof item.kernel === "string") || subjects[0].kernel !== subjects[1].kernel)) {
    return "target and no-target kernels differ";
  }
  if (canaryId === "canary-17" && subjects.some((item) => item.output.includes("Target-specific notes"))) {
    return "target notes appeared without a named target";
  }
  return null;
}

function artifactCase(item) {
  return {
    id: item.id,
    file: item.file,
    verdict: item.verdict,
    hardFail: item.hardFail,
    baselineVerdict: item.baselineVerdict || "UNBASELINED",
    regression: item.regression,
    outputSha256: crypto.createHash("sha256").update(item.subjects.map((subject) => subject.output).join("\n")).digest("hex"),
    transcriptToolCallCount: item.subjects.reduce((total, subject) => total + (Array.isArray(subject.transcript.toolCalls) ? subject.transcript.toolCalls.length : 0), 0),
    invariant: item.invariant,
    dimensions: Array.isArray(item.judgement.dimensions) ? item.judgement.dimensions.map(({ name, severity, verdict }) => ({ name, severity, verdict })) : [],
  };
}

function run(options) {
  requireOptIn("PROMPT_ENHANCER_EVAL");
  const ids = selectCanaryIds(options.tier);
  const fixturePath = options.fixture && path.resolve(options.fixture);
  const fixtureSha = fixturePath ? currentFixtureSha(fixturePath) : null;
  const baselines = baselineVerdicts();
  if (ids.some((id) => DEEP_IDS.includes(id) && id !== "08")) {
    const baselineSha = baselineFixtureSha();
    if (!baselineSha || baselineSha !== fixtureSha) throw new Error("STALE_BASELINE: fixture SHA does not match a recorded deep baseline");
  }
  const rubric = fs.readFileSync(path.join(EVAL_DIR, "rubric.md"), "utf8");
  const cases = ids.map((id) => {
    const canary = findCanary(id);
    const scratchDir = id === "08" ? fs.mkdtempSync(path.join(require("node:os").tmpdir(), "prompt-enhancer-no-git-")) : null;
    const cwd = scratchDir || fixturePath || process.cwd();
    try {
    const subjects = canary.inputs.map(({ name, prompt }) => {
      const subject = runAdapter(path.resolve(options["subject-adapter"]), {
        schemaVersion: 1, canaryId: canary.id, prompt, cwd,
        captureTranscript: true, timeoutMs: 120000,
      });
      if (typeof subject.output !== "string" || !subject.transcript) throw new Error(`${canary.id}: subject response needs output and transcript`);
      return { name, ...subject };
    });
    const judgement = runAdapter(path.resolve(options["judge-adapter"]), {
      schemaVersion: 1, canaryId: canary.id, expected: canary.expected, rubric, runs: subjects, fixtureSha,
    });
    const invariant = pairedInvariant(canary.id, subjects);
    const summary = summarize(judgement, canary.id);
    const baselineVerdict = baselines[canary.id];
    const regression = baselineVerdict === "PASS" && summary.verdict !== "PASS";
    const item = { ...canary, subjects, judgement, invariant, baselineVerdict, regression, ...summary, verdict: invariant || regression ? "HARD-FAIL" : summary.verdict, hardFail: Boolean(invariant) || regression || summary.hardFail };
    return item;
    } finally {
      if (scratchDir) fs.rmSync(scratchDir, { recursive: true, force: true });
    }
  });
  const totals = cases.reduce((acc, item) => ({ ...acc, [item.verdict]: (acc[item.verdict] || 0) + 1 }), {});
  const artifact = { schemaVersion: 1, createdAt: new Date().toISOString(), tier: options.tier, fixture: fixturePath && { path: fixturePath, sha: fixtureSha }, models: { subject: options["subject-model-label"], judge: options["judge-model-label"] }, cases: cases.map(artifactCase), totals };
  writeArtifacts(options.out, artifact, cases.map((item) => `${item.id}: ${item.verdict}`));
  return artifact;
}

if (require.main === module) {
  try {
    const artifact = run(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify(artifact.totals));
    process.exit(artifact.totals["HARD-FAIL"] || artifact.totals.FAIL || artifact.totals.UNJUDGABLE ? 1 : 0);
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exit(2);
  }
}

module.exports = { extractSection, findCanary, parseArgs, run, summarize };
