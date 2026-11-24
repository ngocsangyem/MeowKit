// pattern-detect.cjs — apply the taxonomy signals the trace still carries.
//
// Only signals decidable from record fields live here. Patterns that need text
// or a comparison with later events are judged by the reader (see the taxonomy).

const path = require("node:path");
const { readJsonl, writeJson, die } = require("./json-io.cjs");

const TIME_BUDGET_SECONDS = 21600;
const SLOP_SCORE = 0.6;
const EARLY_EVENTS = 5;
const ENV_CONFIG_FILE = /(^|\/)(package\.json|Cargo\.toml)$/;

function byRun(records) {
	const runs = new Map();
	for (const record of records) {
		const rid = record.run_id ?? "_unknown";
		if (!runs.has(rid)) runs.set(rid, []);
		runs.get(rid).push(record);
	}
	return runs;
}

const hasVerdict = (events) => events.some((e) => e.event === "verdict_written");

// Each detector returns the record that proves the pattern for one run, or null.
const DETECTORS = {
	"premature-exit-without-verify": (events) =>
		hasVerdict(events) ? null : (events.find((e) => e.event === "session_end") ?? null),
	"time-budget-exceeded": (events) =>
		hasVerdict(events)
			? null
			: (events.find((e) => e.event === "session_end" && (e.data?.duration_seconds ?? 0) > TIME_BUDGET_SECONDS) ?? null),
	"slop-buildup": (events) =>
		events.find(
			(e) => e.event === "verdict_written" && (e.data?.weighted_score ?? 1) < SLOP_SCORE && e.data?.overall !== "PASS",
		) ?? null,
	"missing-environmental-context": (events) =>
		events
			.filter((e) => e.event === "file_edited")
			.slice(0, EARLY_EVENTS)
			.find((e) => ENV_CONFIG_FILE.test(String(e.data?.file ?? ""))) ?? null,
};

/** Count, per pattern, the runs that match; write `synthesized.json` in the shared shape. */
function detect(analysisDir, onlyPattern) {
	if (onlyPattern && !DETECTORS[onlyPattern]) {
		die(`ERROR: no detector for ${onlyPattern}; detectable: ${Object.keys(DETECTORS).join(", ")}`);
	}
	const runs = byRun(readJsonl(path.join(analysisDir, "ingested.jsonl")));
	const synthesized = {};
	for (const [name, matches] of Object.entries(DETECTORS)) {
		if (onlyPattern && onlyPattern !== name) continue;
		const hits = [];
		for (const [rid, events] of runs) {
			const hit = matches(events);
			if (hit) hits.push({ run: rid, ts: hit.ts });
		}
		synthesized[name] = {
			occurrences: hits.length,
			affected_runs: hits.map((h) => h.run).sort(),
			sample_count: hits.length,
			sample_record_ts: hits.slice(0, 3).map((h) => h.ts),
		};
		console.log(`${name}: ${hits.length} run(s)`);
	}
	writeJson(path.join(analysisDir, "synthesized.json"), synthesized);
}

module.exports = { detect };
