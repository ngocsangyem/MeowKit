#!/usr/bin/env node
// trace-records.cjs — read and reshape trace records for the analysis steps.
//
// Node is guaranteed present wherever the kit runs, so every JSON read here uses
// node builtins: no `jq` and no interpreter the project may not have.
//
// Usage:
//   trace-records.cjs ingest      <trace-log.jsonl> <analysis-dir> [limit]
//   trace-records.cjs partition   <analysis-dir>
//   trace-records.cjs count       <findings.json> <label>
//   trace-records.cjs synthesize  <analysis-dir>
//   trace-records.cjs threshold   <analysis-dir> [min-occurrences]
//   trace-records.cjs cross-batch <analysis-dir>
//
// Exit: 0 on success; 1 on a usage or data error (message on stderr).

const path = require("node:path");
const { die, readJsonl, writeJsonl } = require("./lib/json-io.cjs");
const { count, synthesize, threshold, crossBatch } = require("./lib/pattern-synthesis.cjs");

const KNOWN_SCHEMA_VERSIONS = new Set(["1.0"]);
const MAX_BATCHES = 3;
const DEFAULT_LIMIT = 20;

/** Select the records belonging to the last `limit` distinct run ids. */
function ingest(traceLog, analysisDir, limitArg) {
	const limit = Number.parseInt(limitArg ?? "", 10) || DEFAULT_LIMIT;
	const kept = [];
	for (const record of readJsonl(traceLog)) {
		const version = String(record.schema_version ?? "");
		if (!KNOWN_SCHEMA_VERSIONS.has(version)) {
			process.stderr.write(`WARN: skipping unknown schema_version: ${version}\n`);
			continue;
		}
		kept.push(record);
	}

	const seenRuns = [];
	for (let i = kept.length - 1; i >= 0 && seenRuns.length < limit; i -= 1) {
		const rid = kept[i].run_id ?? "";
		if (rid && !seenRuns.includes(rid)) seenRuns.push(rid);
	}
	const selected = kept.filter((r) => seenRuns.includes(r.run_id ?? ""));

	writeJsonl(path.join(analysisDir, "ingested.jsonl"), selected);
	console.log(`Ingested ${selected.length} records across ${seenRuns.length} runs`);
}

/** Group ingested records by run id and split into at most MAX_BATCHES files. */
function partition(analysisDir) {
	const records = readJsonl(path.join(analysisDir, "ingested.jsonl"));
	const runs = new Map();
	for (const record of records) {
		const rid = record.run_id ?? "_unknown";
		if (!runs.has(rid)) runs.set(rid, []);
		runs.get(rid).push(record);
	}

	const runIds = [...runs.keys()];
	console.log(`Found ${runIds.length} distinct runs`);
	const batchCount = Math.min(MAX_BATCHES, runIds.length);
	if (batchCount === 0) die("ERROR: no runs to partition");

	const perBatch = Math.ceil(runIds.length / batchCount);
	for (let i = 0; i < batchCount; i += 1) {
		const batchRunIds = runIds.slice(i * perBatch, (i + 1) * perBatch);
		if (batchRunIds.length === 0) continue;
		const batchRecords = batchRunIds.flatMap((rid) => runs.get(rid));
		writeJsonl(path.join(analysisDir, `batch-${i + 1}.jsonl`), batchRecords);
		console.log(`Batch ${i + 1}: ${batchRunIds.length} runs, ${batchRecords.length} records`);
	}
	console.log(`BATCH_COUNT=${batchCount}`);
}

function requireArgs(rest, n, usage) {
	if (rest.length < n) die(`usage: trace-records.cjs ${usage}`);
}

const [subcommand, ...rest] = process.argv.slice(2);
switch (subcommand) {
	case "ingest":
		requireArgs(rest, 2, "ingest <trace-log.jsonl> <analysis-dir> [limit]");
		ingest(rest[0], rest[1], rest[2]);
		break;
	case "partition":
		requireArgs(rest, 1, "partition <analysis-dir>");
		partition(rest[0]);
		break;
	case "count":
		requireArgs(rest, 2, "count <findings.json> <label>");
		count(rest[0], rest[1]);
		break;
	case "synthesize":
		requireArgs(rest, 1, "synthesize <analysis-dir>");
		synthesize(rest[0]);
		break;
	case "threshold":
		requireArgs(rest, 1, "threshold <analysis-dir> [min-occurrences]");
		threshold(rest[0], rest[1]);
		break;
	case "cross-batch":
		requireArgs(rest, 1, "cross-batch <analysis-dir>");
		crossBatch(rest[0]);
		break;
	default:
		die("usage: trace-records.cjs <ingest|partition|count|synthesize|threshold|cross-batch> ...");
}
