// pattern-synthesis.cjs — cross-batch aggregation of researcher findings.

const path = require("node:path");
const { readJson, writeJson, findingsFiles } = require("./json-io.cjs");

const DEFAULT_THRESHOLD = 3;

/** One line per batch: how many patterns that batch's researcher reported. */
function count(findingsFile, label) {
	const data = readJson(findingsFile);
	const n = Array.isArray(data) ? data.length : Object.keys(data).length;
	console.log(`Batch ${label}: ${n} pattern(s) detected`);
}

/** Merge every batch's findings by pattern name into `synthesized.json`. */
function synthesize(analysisDir) {
	const aggregate = new Map();
	for (const file of findingsFiles(analysisDir)) {
		for (const entry of readJson(file)) {
			const name = entry.pattern ?? "unknown";
			if (!aggregate.has(name)) aggregate.set(name, { occurrences: 0, runs: new Set(), samples: 0 });
			const slot = aggregate.get(name);
			slot.occurrences += entry.occurrences ?? 0;
			for (const run of entry.affected_runs ?? []) slot.runs.add(run);
			if (entry.sample_record_ts) slot.samples += 1;
		}
	}

	const synthesized = {};
	let runIncidences = 0;
	for (const [name, slot] of aggregate) {
		synthesized[name] = {
			occurrences: slot.occurrences,
			affected_runs: [...slot.runs].sort(),
			sample_count: slot.samples,
		};
		runIncidences += slot.runs.size;
	}
	writeJson(path.join(analysisDir, "synthesized.json"), synthesized);
	console.log(
		`Aggregated ${Object.keys(synthesized).length} unique patterns across ${runIncidences} run-incidences`,
	);
}

/** Keep only patterns at or above the anti-overfit occurrence threshold. */
function threshold(analysisDir, minArg) {
	const min = Number.parseInt(minArg ?? "", 10) || DEFAULT_THRESHOLD;
	const data = readJson(path.join(analysisDir, "synthesized.json"));
	const kept = {};
	const dropped = {};
	for (const [name, value] of Object.entries(data)) {
		if ((value.occurrences ?? 0) >= min) kept[name] = value;
		else dropped[name] = value;
	}
	writeJson(path.join(analysisDir, "filtered.json"), kept);

	const droppedNames = Object.keys(dropped);
	console.log(
		`Threshold filter: ${Object.keys(kept).length} patterns kept, ${droppedNames.length} dropped (occurrences < ${min})`,
	);
	if (droppedNames.length > 0) {
		console.log("Dropped patterns:");
		for (const name of droppedNames) console.log(`  - ${name}: ${dropped[name].occurrences} occurrences`);
	}
}

/** Map each pattern to the batches it appeared in; 2+ batches is systemic signal. */
function crossBatch(analysisDir) {
	const patternBatches = new Map();
	findingsFiles(analysisDir).forEach((file, index) => {
		for (const entry of readJson(file)) {
			if ((entry.occurrences ?? 0) <= 0) continue;
			const name = entry.pattern ?? "unknown";
			if (!patternBatches.has(name)) patternBatches.set(name, new Set());
			patternBatches.get(name).add(index + 1);
		}
	});

	const all = {};
	for (const [name, batches] of patternBatches) all[name] = [...batches].sort((a, b) => a - b);
	writeJson(path.join(analysisDir, "cross-batch.json"), all);

	const multi = Object.entries(all).filter(([, batches]) => batches.length >= 2);
	if (multi.length > 0) {
		console.log("Cross-batch patterns (high signal):");
		for (const [name, batches] of multi) console.log(`  - ${name}: appears in batches [${batches.join(", ")}]`);
	}
}

module.exports = { count, synthesize, threshold, crossBatch };
