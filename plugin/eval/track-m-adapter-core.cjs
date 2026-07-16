"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function requireOptIn(name) {
  if (process.env[name] !== "1") throw new Error("Set " + name + "=1 before invoking adapters");
}

function runAdapter(adapterPath, request) {
  const result = childProcess.spawnSync(adapterPath, [], {
    cwd: request.cwd,
    encoding: "utf8", input: JSON.stringify(request), timeout: 120000,
  });
  if (result.error || result.status !== 0) throw new Error("Adapter failed: " + (result.error?.message || result.stderr || result.status));
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error("Adapter returned malformed JSON");
  }
}

function writeArtifacts(outputDir, artifact, lines) {
  const out = path.resolve(outputDir);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "run.json"), JSON.stringify(artifact, null, 2) + "\n");
  fs.writeFileSync(path.join(out, "summary.md"), lines.join("\n") + "\n");
}

module.exports = { requireOptIn, runAdapter, writeArtifacts };
