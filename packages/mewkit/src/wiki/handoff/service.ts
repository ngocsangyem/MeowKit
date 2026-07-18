import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { decideWrite, scoreSalience } from "../domain/index.js";
import type { WikiSlug, WikiWriteDecision } from "../domain/index.js";
import type { ProposeInput, ProposeResult, Scanner } from "../application/ports.js";
import { lookupProfile, listProfiles } from "./profiles.js";
import { toProposeInput } from "./domain.js";
import type { ArtifactSignal, WikiHandoffPacket, WikiHandoffRecord, WikiHandoffStatus } from "./domain.js";

// Application-layer handoff service. Turns a skill's terminal artifact into a SCANNED
// WikiHandoffPacket and (on propose) a WikiCandidate — reusing the existing scanner and
// the single decideWrite gate via WikiService.proposeCandidate. `suggest` is read-only;
// `propose` scans, proposes a candidate only when eligible+clean, then appends exactly one
// handoff outcome record. There is NO page-write path here: proposeCandidate is the only
// state-changing call, and it can mint at most a candidate.
//
// Skill Rule of Two (injection-rules.md Rule 11): the handoff path is [A] processes
// untrusted artifact input + [C] changes state (writes a candidate), but NOT [B] —
// `assertSafeArtifactPath` blocks reads of sensitive files (.env/*.pem/*.key/*secret*/
// *credentials*/*.keystore) and any path outside the project root BEFORE the read. So the
// path satisfies 2-of-3, not 3-of-3. A future audit must re-confirm the gate still holds B
// at bay before adding any sensitive-data read to this flow.

/** Narrow write port — segregated from WikiRepository so the handoff service depends only
 * on what it uses (and to avoid a ports↔handoff/domain type cycle). */
export interface HandoffRepository {
	appendHandoff(slug: WikiSlug, record: WikiHandoffRecord): void;
}

export interface HandoffServiceDeps {
	/** Project root — artifact reads are confined under it (SEC2). */
	projectRoot: string;
	scanner: Scanner;
	repo: HandoffRepository;
	/** The ONLY write-to-candidate path (WikiService.proposeCandidate). */
	proposeCandidate: (input: ProposeInput) => ProposeResult;
	/** Injectable clock for deterministic timestamps in tests. */
	now: () => string;
	/** Injectable artifact reader (defaults to a project-root-confined fs read). */
	readArtifact?: (absPath: string) => string;
}

export interface SuggestResult {
	packet: WikiHandoffPacket;
	decision: WikiWriteDecision;
}

export interface ProfileListing {
	skillName: string;
	handoffClass: string;
	profile: string;
	artifactPatterns: string[];
}

const SENSITIVE_BASENAME = /^\.env(\.|$)|\.(pem|key|keystore)$/;

/** SEC2 gate: resolve `artifactPath` under the project root and reject traversal-out or any
 * sensitive-file pattern (injection-rules.md Rule 4) BEFORE any read. Returns the safe path. */
function assertSafeArtifactPath(projectRoot: string, artifactPath: string): string {
	const root = path.resolve(projectRoot);
	const resolved = path.resolve(root, artifactPath);
	if (resolved !== root && !resolved.startsWith(root + path.sep)) {
		throw new Error("artifact path escapes the project root: " + JSON.stringify(artifactPath));
	}
	const lower = resolved.toLowerCase();
	const base = path.basename(lower);
	if (SENSITIVE_BASENAME.test(base) || lower.includes("credentials") || lower.includes("secret")) {
		throw new Error(
			"artifact path matches a sensitive-file pattern (injection-rules.md R4): " + JSON.stringify(artifactPath),
		);
	}
	return resolved;
}

export class HandoffService {
	constructor(private readonly deps: HandoffServiceDeps) {}

	/** Read-only: build the packet + decision for an artifact. Writes NOTHING. */
	suggest(
		skillName: string,
		artifactPath: string,
		slug: WikiSlug,
		overrides: Partial<ArtifactSignal> = {},
	): SuggestResult {
		const built = this.build(skillName, artifactPath, slug, overrides);
		return { packet: built.packet, decision: built.decision };
	}

	/** Scan → (clean + eligible) propose a candidate → append exactly one handoff outcome
	 * record. Dirty or non-suggested artifacts create no candidate; a metadata-only record
	 * (never raw content) is still appended for provenance. */
	propose(
		skillName: string,
		artifactPath: string,
		slug: WikiSlug,
		overrides: Partial<ArtifactSignal> = {},
	): { record: WikiHandoffRecord; result?: ProposeResult } {
		const built = this.build(skillName, artifactPath, slug, overrides);
		const { packet, scanClean, shouldSuggest } = built;

		let status: WikiHandoffStatus;
		let decisionKind: WikiHandoffRecord["decisionKind"];
		let candidateId: string | undefined;
		let result: ProposeResult | undefined;

		if (!shouldSuggest) {
			status = "skipped";
			decisionKind = "skipped";
		} else if (!scanClean) {
			status = "quarantined";
			decisionKind = "quarantine";
		} else {
			result = this.deps.proposeCandidate(toProposeInput(packet));
			decisionKind = result.decision.kind;
			candidateId = result.candidate?.id;
			status = result.candidate ? "proposed" : decisionKind === "quarantine" ? "quarantined" : "skipped";
		}

		const record: WikiHandoffRecord = {
			id: slug + "/ho-" + packet.artifactHash.slice(0, 12),
			slug,
			skillName: packet.skillName,
			handoffClass: packet.handoffClass,
			profile: packet.profile,
			artifactPath: packet.artifactPath,
			artifactHash: packet.artifactHash,
			title: packet.title,
			whySave: packet.whySave,
			evidence: packet.evidence,
			reuseScope: packet.reuseScope,
			verificationState: packet.verificationState,
			riskScore: packet.riskScore,
			salience: scoreSalience(packet.salience),
			decisionKind,
			candidateId,
			status,
			createdAt: packet.createdAt,
			reviewAfter: packet.reviewAfter,
		};
		this.deps.repo.appendHandoff(slug, record);
		return { record, result };
	}

	/** Registry listing for the CLI — class A/B + profile + artifact patterns. */
	profiles(): ProfileListing[] {
		return listProfiles().map((p) => ({
			skillName: p.skillName,
			handoffClass: p.handoffClass,
			profile: p.profile,
			artifactPatterns: p.artifactPatterns,
		}));
	}

	/** Shared prelude for suggest + propose: gate path → read → hash → signal → profile →
	 * salience/shouldSuggest → scan → packet + decision. Pure of writes. */
	private build(skillName: string, artifactPath: string, slug: WikiSlug, overrides: Partial<ArtifactSignal>) {
		const safePath = assertSafeArtifactPath(this.deps.projectRoot, artifactPath);
		const read = this.deps.readArtifact ?? ((p: string) => fs.readFileSync(p, "utf-8"));
		const content = read(safePath);
		const artifactHash = createHash("sha256").update(content).digest("hex");
		const profile = lookupProfile(skillName);

		const signal: ArtifactSignal = {
			skillName,
			artifactPath,
			artifactHash,
			contentBytes: Buffer.byteLength(content, "utf-8"),
			producedAt: this.deps.now(),
			...overrides,
		};
		const salience = profile.defaultSalience(signal);
		const shouldSuggest = profile.shouldSuggest(signal);

		const packet: WikiHandoffPacket = {
			slug,
			skillName,
			handoffClass: profile.handoffClass,
			profile: profile.profile,
			artifactPath,
			artifactHash,
			title: deriveTitle(artifactPath),
			content,
			origin: "agent",
			whySave: profile.profile + " handoff from " + skillName,
			evidence: artifactPath,
			sourceIds: [],
			reuseScope: profile.defaultReuseScope,
			verificationState: signal.verifiedOutcome ? "verified" : "unverified",
			riskScore: 0,
			noveltyDelta: signal.noveltyDelta ?? salience.novelty_vs_existing_wiki,
			salience,
			createdAt: signal.producedAt,
		};

		const scan = this.deps.scanner.scan({ content, origin: "agent" });
		const scanClean = scan.verdict.status === "clean" && scan.verdict.passes >= 2;
		const score = scoreSalience(salience);
		const decision: WikiWriteDecision = shouldSuggest
			? decideWrite(score, scan.verdict, { isHighDuplicate: false })
			: { kind: "discard", reason: "profile does not suggest a handoff for this artifact signal" };

		return { packet, decision, scanClean, shouldSuggest };
	}
}

/** Best-effort human title from an artifact filename (provenance display only). */
function deriveTitle(artifactPath: string): string {
	const base = path.basename(artifactPath).replace(/\.[a-z0-9]+$/i, "");
	return base.replace(/[-_]+/g, " ").trim() || artifactPath;
}
