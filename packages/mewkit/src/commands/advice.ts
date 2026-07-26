// `mewkit advice begin|commit|status` — the parent-side surface for `--advice`.
//
// Canonical contract: `.claude/rules-conditional/advice-supervision-rules.md`.
//
// Skills are prose, so they cannot call the supervision core directly; this command
// is how a checkpoint reaches it. That is the point of the split: the SKILL decides
// when a checkpoint fires, and this command decides whether it MAY — cap accounting,
// stage legality, idempotency and the durable record all live here, where a skill
// body cannot talk its way past them.
//
// Nothing here approves anything. `begin` may refuse a call and `commit` may refuse
// a disposition, but no path advances a gate, and `disposition` is recorded verbatim
// alongside the parent's own `outcome`.
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import pc from "picocolors";
import {
	CorruptDossierError,
	beginCheckpoint,
	commitCheckpoint,
	dossierPath,
	listSupervisionRuns,
	readDossier,
	updateDossier,
	type Dossier,
} from "../core/athena-supervision-dossier.js";
import { classifySupervisionCall } from "../core/athena-supervision-mode.js";
import {
	SKILL_HARD_CAPS,
	chargesToPartition,
	evaluateStageRequest,
	isDispositionLegal,
	isSupervisedSkill,
	legalDispositions,
	partitionValuesFor,
	type Disposition,
	type SupervisionStage,
} from "../core/athena-supervision-protocol.js";
import {
	receiptPath,
	renderReceipt,
	validateReceipt,
	type Receipt,
	type ReceiptOutcome,
} from "../core/athena-supervision-receipt.js";
import { validateStrategyBrief } from "../core/athena-strategy-brief.js";
import { validateInputPacket, validateOutputPacket } from "../core/athena-supervision-packet.js";
import { applyCorrection, type CorrectionKind } from "../core/workflow-evidence-revision.js";
import { readJsonFile, writeJsonAtomic } from "./advice-evidence-io.js";

export interface AdviceOptions {
	subcommand?: string;
	run?: string;
	skill?: string;
	stage?: string;
	checkpoint?: string;
	disposition?: string;
	outcome?: string;
	reason?: string;
	question?: string;
	directive?: string;
	correction?: string | string[];
	evidencePointer?: string | string[];
	next?: string;
	slug?: string;
	taskId?: string;
	provider?: string;
	evidence?: string;
	correctionKind?: string;
	packetKind?: string;
	releaseStage?: string;
	json?: boolean;
}

/**
 * The only file a returned correction may write.
 *
 * The workflow evidence index is written under several roots — `.claude/`, `.codex/`,
 * `.meowkit/state/`, `tasks/plans/<plan>/reports/evidence/` — but always under this
 * name, so the name is what identifies it rather than any one path.
 */
export const EVIDENCE_INDEX_FILENAME = "workflow-evidence.json";

const toArray = (v: string | string[] | undefined): string[] =>
	v === undefined ? [] : (Array.isArray(v) ? v : [v]).map((s) => String(s).trim()).filter(Boolean);

/**
 * A refusal. Thrown rather than exiting in place, so every refusal path is
 * observable in a test — a contract enforced only by `process.exit` deep inside a
 * helper is a contract nothing can prove still holds.
 */
export class AdviceRefusal extends Error {
	readonly escalate: boolean;
	constructor(message: string, escalate = false) {
		super(message);
		this.name = "AdviceRefusal";
		this.escalate = escalate;
	}
}

function fail(message: string, escalate = false): never {
	throw new AdviceRefusal(message, escalate);
}

/** YYMMDD in local time — the receipt naming convention used across `tasks/reports/`. */
function today(): string {
	const d = new Date();
	const p = (n: number): string => String(n).padStart(2, "0");
	return `${p(d.getFullYear() % 100)}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

/**
 * Load a run's dossier, refusing to continue on a damaged one.
 *
 * A corrupt record is NOT treated as a fresh run. Doing so would reset every cap the
 * moment the file became unreadable, so the cheapest way to buy unlimited
 * supervision calls would be to break the file that counts them. Per the contract's
 * state-failure rule, supervision stops until the record is recovered; the ordinary
 * workflow continues unsupervised.
 */
function loadDossier(projectRoot: string, runId: string): Dossier | null {
	const read = readDossier(projectRoot, runId);
	if (read.found) return read.dossier;
	if (read.corrupt) {
		fail(
			`Supervision state for run "${runId}" is unreadable (${read.reason}).\n` +
				`Supervision is disabled for this run until ${dossierPath(projectRoot, runId)} is repaired or removed.\n` +
				"The ordinary workflow continues unsupervised — it is not blocked by this.",
		);
	}
	return null;
}

/**
 * Refuse a NEW run for a skill that already has an escalated one.
 *
 * Caps are per run and the run id comes from the caller, so "cap reached — escalate"
 * is only as strong as the caller's willingness to stop. Without this, the cheapest
 * response to a refusal is a fresh `--run` id, and the human the refusal asked for
 * never gets involved. Resuming the ESCALATED run is still allowed; what is refused
 * is starting a parallel one to route around it.
 */
function refuseIfSkillAlreadyEscalated(projectRoot: string, runId: string, skill: string): void {
	for (const { runId: otherId, read } of listSupervisionRuns(projectRoot)) {
		if (otherId === runId) continue;
		// A damaged sibling is refused too: skipping it would restore the bypass by
		// simply corrupting the record that says "escalate".
		if (!read.found) {
			if (read.corrupt) fail(`Refused: supervision record "${otherId}" is unreadable (${read.reason}) — repair or remove it first.`);
			continue;
		}
		if (read.dossier.skill === skill && read.dossier.escalatedToHuman) {
			fail(
				`Refused: run "${otherId}" for ${skill} escalated to a human and is unresolved.\n` +
					"A new run id does not clear an escalation. Resolve it with the human, then remove or resume that run.",
				true,
			);
		}
	}
}

/** Persist the escalation, then refuse — so the marker survives the failing process. */
async function escalate(projectRoot: string, runId: string, reason: string): Promise<never> {
	try {
		await updateDossier(projectRoot, runId, (existing) =>
			existing ? { ...existing, escalatedToHuman: true } : fail(`Checkpoint refused: ${reason}`, true),
		);
	} catch (err) {
		if (err instanceof AdviceRefusal) throw err;
		console.error(pc.yellow(`⚠ could not record the escalation: ${(err as Error).message}`));
	}
	return fail(`Checkpoint refused: ${reason}`, true);
}

/** `advice begin` — claim a checkpoint slot and write the pending marker. */
async function begin(projectRoot: string, args: AdviceOptions): Promise<void> {
	const runId = args.run ?? fail("`advice begin` requires --run <supervisionRunId>.");
	const skill = args.skill ?? fail("`advice begin` requires --skill <mk:skill>.");
	const stage = args.stage as SupervisionStage | undefined;
	const checkpointId = args.checkpoint ?? fail("`advice begin` requires --checkpoint <checkpointId>.");

	// Route contract first: a call claiming embedded supervision without the full
	// triple is refused, never downgraded to a stateless consult.
	const decision = classifySupervisionCall({ claimedMode: "embedded", runId, stage, checkpointId });
	if (!decision.valid) fail(`Refused: ${decision.reason}`);
	if (!isSupervisedSkill(skill)) fail(`Refused: ${skill} does not expose --advice.`);

	// Read once outside the lock only to decide refusals that need no write. The
	// authoritative read happens inside `updateDossier` below.
	const preview = loadDossier(projectRoot, runId);
	if (preview && preview.skill !== skill) fail(`Refused: run "${runId}" belongs to ${preview.skill}, not ${skill}.`);
	if (!preview) refuseIfSkillAlreadyEscalated(projectRoot, runId, skill);
	if (preview?.escalatedToHuman)
		fail(`Refused: run "${runId}" escalated to a human and is unresolved — that decision is theirs, not a retry.`, true);

	const partition = args.releaseStage?.trim() || undefined;
	const verdict = evaluateStageRequest({
		skill,
		stage: stage as SupervisionStage,
		checkpointId,
		history: preview?.history ?? [],
		partition,
	});
	if (!verdict.allowed) {
		if (verdict.escalate) await escalate(projectRoot, runId, verdict.reason);
		fail(`Checkpoint refused: ${verdict.reason}`);
	}
	if (verdict.duplicateOf) {
		// Idempotent by design: a retried checkpoint returns the prior result instead of
		// spending a slot, which is what makes crash-and-resume safe. A different STAGE
		// under the same id is a naming collision, not a retry — treating it as a retry
		// would silently skip a checkpoint the workflow believes it ran.
		const prior = preview?.history.find((h) => h.checkpointId === checkpointId);
		if (prior && prior.stage !== stage)
			fail(`Refused: checkpointId "${checkpointId}" already ran at ${prior.stage} — use a distinct id per checkpoint.`);
		// Same reasoning one axis over: a reused id under a DIFFERENT release stage is a
		// naming collision, not a retry. Accepting it would return the recorded result of
		// another stage's checkpoint and silently skip this one — while spending nothing.
		if (prior && prior.partition !== partition)
			fail(
				`Refused: checkpointId "${checkpointId}" already ran in ${prior.partition ?? "(no release stage)"} — use a distinct id per release stage.`,
			);
		console.log(pc.yellow(`Checkpoint "${checkpointId}" already ran — returning the recorded result, no slot spent.`));
		console.log(`  latest directive: ${preview?.latestDirective || "(none)"}`);
		console.log(`  next safe action: ${preview?.nextSafeAction || "(none)"}`);
		return;
	}

	const written = await updateDossier(projectRoot, runId, (existing) => {
		const base: Dossier = existing ?? {
			runId,
			skill,
			stage: stage as SupervisionStage,
			lockedDecisionPointers: [],
			latestDirective: "",
			correctionCount: 0,
			receiptPointers: [],
			nextSafeAction: "",
			checkpoint: null,
			history: [],
			escalatedToHuman: false,
		};
		return beginCheckpoint(base, {
			checkpointId,
			stage: stage as SupervisionStage,
			...(partition === undefined ? {} : { partition }),
		});
	});

	// Report usage against the budget this call actually spends, not the run total —
	// on a partitioned skill those differ, and the run total would misstate what is left.
	const spent = written.history.filter((h) => chargesToPartition(skill, h, partition)).length;
	const scope = partition === undefined ? skill : `${skill} / ${partition}`;
	console.log(pc.green(`Checkpoint ${stage}/${checkpointId} opened (${spent + 1} of ${SKILL_HARD_CAPS[skill]} for ${scope}).`));
	console.log(pc.dim(`  dossier: ${path.relative(projectRoot, dossierPath(projectRoot, runId))}`));
	console.log(pc.dim(`  legal dispositions: ${legalDispositions(stage as SupervisionStage).join(", ")}`));
	console.log(pc.dim("  supervision is evidence — it clears no gate and counts as no verification."));
}

/** `advice commit` — record a delivered result, write the receipt, apply any correction. */
async function commit(projectRoot: string, args: AdviceOptions): Promise<void> {
	const runId = args.run ?? fail("`advice commit` requires --run <supervisionRunId>.");
	const checkpointId = args.checkpoint ?? fail("`advice commit` requires --checkpoint <checkpointId>.");
	const disposition = args.disposition as Disposition | undefined;
	const outcome = (args.outcome ?? "adopted") as ReceiptOutcome;
	const reason = args.reason ?? fail("`advice commit` requires --reason (required even when adopted).");

	const dossier = loadDossier(projectRoot, runId);
	if (!dossier) fail(`No supervision run "${runId}" — run \`mewkit advice begin\` first.`);
	const marker = dossier.checkpoint;
	if (!marker || marker.checkpointId !== checkpointId)
		fail(`Refused: no open checkpoint "${checkpointId}" on run "${runId}".`);
	if (!disposition || !isDispositionLegal(marker.stage, disposition)) {
		fail(
			`Refused: "${disposition ?? "(none)"}" is not legal at ${marker.stage}.\n` +
				`  legal here: ${legalDispositions(marker.stage).join(", ")}`,
		);
	}

	// The budget is fixed when the slot is claimed. A `--release-stage` on commit may
	// only confirm it: letting it differ would charge the call to one budget and record
	// it against another, which is how a spent slot comes back.
	const claimed = args.releaseStage?.trim() || undefined;
	if (claimed !== undefined && claimed !== marker.partition)
		fail(
			`Refused: checkpoint "${checkpointId}" opened in ${marker.partition ?? "(no release stage)"}, not ${claimed} — the release stage is fixed at \`begin\`.`,
		);

	const corrections = toArray(args.correction);
	const receipt: Receipt = {
		runId,
		stage: marker.stage,
		disposition,
		outcome,
		reason,
		taskId: args.taskId ?? "none",
		provider: args.provider ?? "unknown",
		skill: dossier.skill,
		checkpointId,
		...(marker.partition === undefined ? {} : { releaseStage: marker.partition }),
		question: args.question ?? "",
		directive: args.directive ?? "",
		requiredCorrections: corrections,
		evidencePointers: toArray(args.evidencePointer),
		nextSafeAction: args.next ?? "",
	};
	const check = validateReceipt(receipt);
	if (!check.ok) fail(`Refused: ${check.errors.join("; ")}`);

	const slug = args.slug ?? runId;
	const relReceipt = receiptPath(today(), slug, dossier.receiptPointers.length + 1);
	const absReceipt = path.join(projectRoot, relReceipt);

	// The dossier write is the durable commit; the receipt is the human record. Write
	// the receipt FIRST so a crash between them leaves a readable orphan rather than a
	// committed checkpoint whose evidence never landed.
	let receiptWritten = true;
	try {
		mkdirSync(path.dirname(absReceipt), { recursive: true });
		writeFileSync(absReceipt, renderReceipt(receipt), "utf-8");
	} catch (err) {
		// Advisory, never silent (`memory-read-rules.md` no-silent-skip): the checkpoint
		// still commits, because losing cap accounting is worse than losing the record.
		receiptWritten = false;
		console.error(pc.yellow(`⚠ receipt write failed: ${(err as Error).message}`));
	}

	// Re-read and mutate under the lock: the copy loaded above may be stale, and a
	// lost update here would return a spent cap slot to the run.
	await updateDossier(projectRoot, runId, (existing) => {
		const current = existing ?? dossier;
		const committed = commitCheckpoint(current, {
			latestDirective: args.directive ?? "",
			nextSafeAction: args.next ?? "",
			disposition,
			corrections: disposition === "RETURN_TO_EXECUTOR" ? 1 : 0,
			...(receiptWritten ? { receiptPointer: relReceipt } : {}),
		});
		// A second unresolved return is the human's call, so record it where a later
		// call — including one under a fresh run id — will see it. Returns are counted
		// within the budget that spent them (mirroring `evaluateStageRequest`), but the
		// escalation flag itself stays run-wide: once a human has been asked, the whole
		// run waits for them, not just the stage that asked.
		const returns = committed.history.filter(
			(h) => h.disposition === "RETURN_TO_EXECUTOR" && chargesToPartition(current.skill, h, marker.partition),
		).length;
		return { ...committed, escalatedToHuman: committed.escalatedToHuman || returns >= 2 };
	});

	console.log(pc.green(`Committed ${marker.stage}/${checkpointId} — disposition ${disposition}, outcome ${outcome}.`));
	if (receiptWritten) console.log(pc.dim(`  receipt: ${relReceipt}`));

	if (disposition === "RETURN_TO_EXECUTOR") applyEvidenceCorrection(projectRoot, args);
	if (disposition === "READY_FOR_EXISTING_GATE")
		console.log(pc.dim("  the normal reviewer/gate is the next step — this does NOT clear it."));
	if (disposition === "ESCALATE_TO_HUMAN") console.log(pc.yellow("  stop at the existing human touchpoint."));
}

/**
 * Advance the evidence index after a returned correction.
 *
 * Separate from the dossier write on purpose: the dossier records SUPERVISION, the
 * evidence index records the WORKFLOW. A correction that did not name an evidence
 * file simply says so — inventing a path here would fabricate workflow state from a
 * supervision event.
 */
function applyEvidenceCorrection(projectRoot: string, args: AdviceOptions): void {
	const kind = (args.correctionKind ?? "source") as CorrectionKind;
	if (kind !== "source" && kind !== "scope") fail(`--correction-kind must be source|scope, got ${kind}.`);
	if (!args.evidence) {
		console.log(
			pc.yellow(
				"  no --evidence path given: downstream evidence was NOT marked superseded.\n" +
					"  re-run Verify and review before any gate, or pass --evidence <workflow-evidence.json>.",
			),
		);
		return;
	}

	// Resolve symlinks BEFORE deciding anything about the path.
	//
	// `path.resolve` normalizes text; it does not follow links. Checking the literal
	// argument therefore answers a question about the caller's string, not about the file
	// that will actually be opened — and `readFileSync` follows links at the OS level. A
	// symlink named `workflow-evidence.json` placed anywhere in the repo and pointing
	// outside it satisfied every textual check, and its contents were merged into the
	// correction and written back inside the repo. That is `injection-rules.md` Rule 6
	// (project boundary) defeated by one indirection, and it turns this path into the
	// 3-of-3 shape Rule 11 exists to reject: caller-supplied pointer, sensitive read,
	// state change. Every check below runs on the real path.
	const abs = path.resolve(projectRoot, args.evidence);
	let real: string;
	try {
		real = realpathSync(abs);
	} catch {
		// `--evidence` must name an index that already exists — a correction supersedes
		// recorded evidence and never creates it — so an unresolvable path is simply absent.
		return fail(`Cannot apply correction: evidence file not found: ${args.evidence}`);
	}

	// Stay inside the project (`injection-rules.md` Rule 6). `--evidence` reaches a WRITE,
	// and the value is supplied by whatever assembled the checkpoint call.
	//
	// The ROOT is resolved too, or the comparison is between a real path and a textual
	// one. On macOS `/var` is itself a symlink to `/private/var`, so a project under
	// `/var/...` would compute as outside itself and every correction would be refused.
	let realRoot: string;
	try {
		realRoot = realpathSync(projectRoot);
	} catch {
		realRoot = projectRoot;
	}
	const rel = path.relative(realRoot, real);
	if (rel.startsWith("..") || path.isAbsolute(rel))
		fail(`Refused: --evidence must stay inside the project (${args.evidence} resolves to ${real}, outside ${realRoot}).`);

	// Inside the project is not narrow enough. `applyCorrection` spreads whatever JSON
	// object it reads and writes it back, so any JSON file in the repo was a legal write
	// target. Pointed at a Gate-1-approved `visual-plan/plan.json` — which carries its own
	// top-level `review.status` — a correction flipped that status to "superseded",
	// injected four foreign fields, and broke the artifact against its own pinned hash.
	// That is a supervision event silently mutating the HTML pipeline's artifact, which
	// the two flags being orthogonal is supposed to make impossible.
	//
	// The index has one name everywhere it is written, so the name is the check.
	if (path.basename(real) !== EVIDENCE_INDEX_FILENAME)
		fail(
			`Refused: --evidence must name a ${EVIDENCE_INDEX_FILENAME} (got ${path.basename(real)}).\n` +
				"  A correction supersedes workflow evidence; it does not write any other artifact.",
		);

	const loaded = readJsonFile(real);
	if (!loaded.ok) fail(`Cannot apply correction: ${loaded.reason}`);

	const updated = applyCorrection(loaded.data, kind);
	writeJsonAtomic(real, updated);
	console.log(
		pc.green(
			`  evidence revision → ${updated.evidenceRevision}; verification and review marked superseded${
				kind === "scope" ? "; Gate 1 returned to required (scope changed)" : ""
			}.`,
		),
	);
	console.log(pc.dim("  re-run the normal checks; superseded evidence cannot satisfy a later gate."));
}

/**
 * `advice validate-packet` — check a packet or brief against its contract.
 *
 * All three shapes are assembled as prose and handed to (or returned by) an agent,
 * so none passes through this CLI on its own. Without this command the caps, pointer
 * budget, provenance requirement, secret and authority scans, and the direct/embedded
 * separation were code nothing could reach — real functions, but not an enforcement
 * any workflow could invoke. This is the reachable surface; the skill bodies and the
 * agent adapter call it at their boundaries.
 *
 * `brief` is the direct-consult shape. It is validated by a DIFFERENT schema on
 * purpose: a brief that carries a disposition is refused, which is what stops a
 * stateless consult from being recorded as a governed checkpoint.
 */
function validatePacket(projectRoot: string, args: AdviceOptions): void {
	const file = args.evidence ?? fail("`advice validate-packet` requires --evidence <path-to-packet.json>.");
	// `--correction-kind` used to select the packet shape here and now means
	// source|scope on `commit`. Silently ignoring it would route the caller to the
	// DEFAULT validator — a brief checked against the input-packet schema fails with a
	// confusing shape error instead of saying which flag moved.
	if (args.correctionKind !== undefined)
		fail("`validate-packet` uses --packet-kind (input|output|brief); --correction-kind is for `commit` (source|scope).");

	const kind = args.packetKind ?? "input";
	if (kind !== "input" && kind !== "output" && kind !== "brief")
		fail(`--packet-kind must be input|output|brief, got ${kind}.`);

	const abs = path.resolve(projectRoot, file);
	const rel = path.relative(projectRoot, abs);
	if (rel.startsWith("..") || path.isAbsolute(rel)) fail("Refused: --evidence must stay inside the project.");

	const loaded = readJsonFile(abs);
	if (!loaded.ok) fail(`Cannot read packet: ${loaded.reason}`);

	const result =
		kind === "input"
			? validateInputPacket(loaded.data)
			: kind === "output"
				? validateOutputPacket(loaded.data)
				: validateStrategyBrief(loaded.data);
	if (!result.ok) {
		// Refused BEFORE delegation, never truncated to fit: a trimmed packet asks a
		// different question than the one the workflow intended.
		fail(`Packet refused (${kind}):\n${result.errors.map((e) => `  - ${e}`).join("\n")}`);
	}
	console.log(pc.green(`${kind === "brief" ? "Strategy brief" : "Packet"} OK (${kind}).`));
	if (kind === "brief")
		console.log(pc.dim("  a consult governs no run — it writes no dossier, no receipt, and spends no cap."));
}

/** `advice status` — what a resuming parent needs, without loading any history. */
function status(projectRoot: string, args: AdviceOptions): void {
	const runId = args.run ?? fail("`advice status` requires --run <supervisionRunId>.");
	const dossier = loadDossier(projectRoot, runId);
	if (!dossier) {
		console.log(pc.dim(`No supervision run "${runId}".`));
		return;
	}
	if (args.json) {
		console.log(JSON.stringify(dossier, null, 2));
		return;
	}
	// `hasOwnProperty`, not a bare lookup: a hand-edited `skill: "__proto__"` returns a
	// truthy prototype object, which `?? 0` does not catch, and the run then reports a
	// garbled cap.
	const cap = Object.prototype.hasOwnProperty.call(SKILL_HARD_CAPS, dossier.skill) ? SKILL_HARD_CAPS[dossier.skill] : 0;
	const partitions = partitionValuesFor(dossier.skill);
	console.log(pc.bold(pc.cyan(`Supervision run ${dossier.runId}`)));
	if (partitions) {
		// A resuming parent needs the budget it is about to spend from. One run total
		// against a per-partition cap would read as over-budget while every stage still
		// has room — or worse, as room remaining in a stage that has none. Unattributable
		// entries count everywhere, so the displayed totals may exceed the history length;
		// that is the accounting the caps actually use.
		const used = partitions
			.map((p) => `${p} ${dossier.history.filter((h) => chargesToPartition(dossier.skill, h, p)).length}/${cap}`)
			.join("   ");
		console.log(`  skill: ${dossier.skill}   calls per release stage: ${used}   corrections: ${dossier.correctionCount}`);
	} else {
		console.log(`  skill: ${dossier.skill}   calls: ${dossier.history.length}/${cap}   corrections: ${dossier.correctionCount}`);
	}
	console.log(`  stage: ${dossier.stage}   open checkpoint: ${dossier.checkpoint?.state === "pending" ? dossier.checkpoint.checkpointId : "(none)"}`);
	console.log(`  latest directive: ${dossier.latestDirective || pc.dim("(none)")}`);
	console.log(`  next safe action: ${dossier.nextSafeAction || pc.dim("(none)")}`);
	if (dossier.receiptPointers.length) console.log(`  receipts: ${dossier.receiptPointers.join(", ")}`);
	console.log(pc.dim("  supervision continuity — never verification, never a gate approval."));
}

/** Dispatch without the CLI's exit handling — the surface tests drive. */
export async function runAdvice(projectRoot: string, args: AdviceOptions = {}): Promise<void> {
	switch (args.subcommand) {
		case "begin":
			return begin(projectRoot, args);
		case "commit":
			return commit(projectRoot, args);
		case "status":
			return status(projectRoot, args);
		case "validate-packet":
			return validatePacket(projectRoot, args);
		default:
			fail(`Unknown advice subcommand "${args.subcommand ?? ""}". Expected begin|commit|status|validate-packet.`);
	}
}

export async function advice(args: AdviceOptions = {}): Promise<void> {
	try {
		await runAdvice(process.cwd(), args);
	} catch (err) {
		// A damaged record surfaces as a refusal, not a stack trace: the operator needs
		// the repair instruction, and supervision must stop rather than start fresh.
		if (err instanceof CorruptDossierError) {
			console.error(pc.red(`${err.message}\nSupervision is disabled for this run until that file is repaired or removed.`));
			console.error(pc.dim("The ordinary workflow continues unsupervised — it is not blocked by this."));
			process.exit(1);
		}
		if (err instanceof AdviceRefusal) {
			console.error(pc.red(err.message));
			if (err.escalate) console.error(pc.yellow("Escalate to a human — this is not a retry."));
			process.exit(1);
		}
		throw err;
	}
}
