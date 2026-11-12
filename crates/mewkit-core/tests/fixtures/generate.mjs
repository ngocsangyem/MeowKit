// Produce the fixtures in this directory with the TYPESCRIPT writers, so the
// Rust readers are tested against bytes the npm CLI actually emits rather than
// against a hand-written `json!` literal that both sides of the port agree on.
//
//   npm run build --prefix packages/mewkit      # if dist/ is stale
//   node crates/mewkit-core/tests/fixtures/generate.mjs
//
// Re-run it after a schema change on the TypeScript side; `fixtures.rs` then
// fails if the Rust reader no longer accepts what the writer produced.
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, "../../../../packages/mewkit/dist");

const { activateTask, updateTaskRecord } = await import(path.join(dist, "core/task-record.js"));
const { writeDossier } = await import(path.join(dist, "core/athena-supervision-dossier.js"));
const { VerdictSchema } = await import(path.join(dist, "review/verdict-schema.js"));

const root = mkdtempSync(path.join(tmpdir(), "mewkit-fixtures-"));
mkdirSync(path.join(root, "tasks", "active"), { recursive: true });

// ---- task record: the real activation writer, then a real update ----
const taskId = "261112-rust-port-fixture";
await activateTask(root, {
	taskId,
	planPath: "tasks/plans/261112-rust-port-mewkit-cli/plan.md",
	planSlug: "rust-port-mewkit-cli",
	now: "2026-11-12T09:00:00.000Z",
	cliVersion: "2.3.1",
	kitVersion: "2.3.1",
	currentStep: "phase 2",
	nextAction: "port the memory scan",
});
await updateTaskRecord(root, taskId, (existing) => ({
	...existing,
	repos: [{ identity: "/work/meowkit", revision: "6e2dddc4" }],
}));
copyFileSync(path.join(root, "tasks", "active", `${taskId}.json`), path.join(here, "task-record.json"));
copyFileSync(path.join(root, ".meowkit", "state", "active-plan.json"), path.join(here, "active-task-pointer.json"));

// ---- dossier: the real renderer, on disk, as a document ----
const runId = "run-261112-090000-abcd";
const dossierPath = await writeDossier(root, {
	runId,
	skill: "mk:cook",
	stage: "GUIDE",
	lockedDecisionPointers: ["plan.md#locked-decisions"],
	latestDirective: "port the memory scan before the verbs",
	correctionCount: 2,
	receiptPointers: ["tasks/reports/261112-rust-port-advice-1.md"],
	nextSafeAction: "run the differential corpus",
	checkpoint: { checkpointId: "cp-1", stage: "GUIDE", state: "pending", partition: "phase-2" },
	history: [],
	escalatedToHuman: false,
});
writeFileSync(path.join(here, "dossier.md"), readFileSync(dossierPath, "utf8"));

// ---- verdict: the zod schema IS the producer of the canonical shape ----
const verdict = VerdictSchema.parse({
	schema_version: "1.0",
	slug: "rust-port-mewkit-cli",
	gate: "review",
	decision: "PASS_WITH_RISK",
	dimensions: [
		{ name: "Correctness", verdict: "PASS" },
		{ name: "Security", verdict: "WARN", note: "scanner parity pinned against Node" },
	],
	evidence_refs: ["tasks/reviews/261112-rust-port-mewkit-cli-verdict.md"],
	created_at: "2026-11-12T09:30:00.000Z",
});
writeFileSync(path.join(here, "verdict.json"), `${JSON.stringify(verdict, null, "\t")}\n`);

console.log("wrote fixtures to", here);
