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
import { mkdirSync, writeFileSync } from "node:fs";
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
	evaluateStageRequest,
	isDispositionLegal,
	isSupervisedSkill,
	legalDispositions,
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
	json?: boolean;
}

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

	const verdict = evaluateStageRequest({
		skill,
		stage: stage as SupervisionStage,
		checkpointId,
		history: preview?.history ?? [],
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
		return beginCheckpoint(base, { checkpointId, stage: stage as SupervisionStage });
	});

	console.log(
		pc.green(`Checkpoint ${stage}/${checkpointId} opened (${written.history.length + 1} of ${SKILL_HARD_CAPS[skill]} for ${skill}).`),
	);
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
		// call — including one under a fresh run id — will see it.
		const returns = committed.history.filter((h) => h.disposition === "RETURN_TO_EXECUTOR").length;
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

	// Stay inside the project (`injection-rules.md` Rule 6). `--evidence` reaches a
	// WRITE, and the value is supplied by whatever assembled the checkpoint call, so
	// `../` here would let a supervision event mutate a file outside the repository.
	const abs = path.resolve(projectRoot, args.evidence);
	const rel = path.relative(projectRoot, abs);
	if (rel.startsWith("..") || path.isAbsolute(rel))
		fail(`Refused: --evidence must stay inside the project (${args.evidence} resolves outside ${projectRoot}).`);

	const loaded = readJsonFile(abs);
	if (!loaded.ok) fail(`Cannot apply correction: ${loaded.reason}`);

	const updated = applyCorrection(loaded.data, kind);
	writeJsonAtomic(abs, updated);
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
 * `advice validate-packet` — check a packet against the contract before it is sent
 * or acted on.
 *
 * Both packets are assembled as prose and handed to (or returned by) an agent, so
 * neither passes through this CLI on its own. Without this command the packet caps,
 * pointer budget, provenance requirement and secret/authority scans were code that
 * nothing could reach — real functions, but not an enforcement any workflow could
 * actually invoke. This is the reachable surface; the skill bodies call it at the
 * checkpoint boundaries.
 */
function validatePacket(projectRoot: string, args: AdviceOptions): void {
	const file = args.evidence ?? fail("`advice validate-packet` requires --evidence <path-to-packet.json>.");
	const direction = args.correctionKind ?? "input";
	if (direction !== "input" && direction !== "output")
		fail(`--correction-kind must be input|output for validate-packet, got ${direction}.`);

	const abs = path.resolve(projectRoot, file);
	const rel = path.relative(projectRoot, abs);
	if (rel.startsWith("..") || path.isAbsolute(rel)) fail(`Refused: --evidence must stay inside the project.`);

	const loaded = readJsonFile(abs);
	if (!loaded.ok) fail(`Cannot read packet: ${loaded.reason}`);

	const result = direction === "input" ? validateInputPacket(loaded.data) : validateOutputPacket(loaded.data);
	if (!result.ok) {
		// Refused BEFORE delegation, never truncated to fit: a trimmed packet asks a
		// different question than the one the workflow intended.
		fail(`Packet refused (${direction}):\n${result.errors.map((e) => `  - ${e}`).join("\n")}`);
	}
	console.log(pc.green(`Packet OK (${direction}).`));
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
	const cap = SKILL_HARD_CAPS[dossier.skill] ?? 0;
	console.log(pc.bold(pc.cyan(`Supervision run ${dossier.runId}`)));
	console.log(`  skill: ${dossier.skill}   calls: ${dossier.history.length}/${cap}   corrections: ${dossier.correctionCount}`);
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
