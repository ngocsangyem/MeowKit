import type { WikiCandidate } from "../../domain/index.js";
import type { ScanOutput, Scanner, Tracer, WikiIndex, WikiRepository } from "../ports.js";
import type { WikiServiceDeps } from "../service.js";

// In-memory spy adapters for the application-service tests. `calls` records the ordered
// method names so a test can assert the write-transaction order and prove read/write
// separation (a query must produce zero write calls).

export interface Mocks {
	deps: WikiServiceDeps;
	calls: string[];
	candidates: WikiCandidate[];
}

export function makeMocks(scan: ScanOutput): Mocks {
	const calls: string[] = [];
	const candidates: WikiCandidate[] = [];

	const repo: WikiRepository = {
		createWiki: () => void calls.push("createWiki"),
		writePage: () => void calls.push("writePage"),
		readPage: () => null,
		listPages: () => {
			calls.push("listPages");
			return [];
		},
		quarantine: () => {
			calls.push("quarantine");
			return "/q/x.quarantined";
		},
		appendCandidate: (c) => {
			calls.push("appendCandidate");
			candidates.push(c);
		},
		appendIntervention: () => void calls.push("appendIntervention"),
		appendSeed: () => void calls.push("appendSeed"),
		appendSource: () => void calls.push("appendSource"),
		listCandidates: () => candidates,
		getCandidate: (_slug, id) => candidates.find((c) => c.id === id) ?? null,
	};
	const scanner: Scanner = {
		scan: () => {
			calls.push("scan");
			return scan;
		},
	};
	const index: WikiIndex = {
		upsertPage: () => void calls.push("upsertPage"),
		searchFts: () => {
			calls.push("searchFts");
			return [];
		},
	};
	const tracer: Tracer = {
		recordWikiTrace: (event) => void calls.push("trace:" + event),
	};

	return { deps: { repo, scanner, index, tracer }, calls, candidates };
}

export const CLEAN_SCAN: ScanOutput = {
	verdict: { status: "clean", passes: 4, findings: [] },
	scrubbed: "clean scrubbed body",
	secretsFound: false,
};

export const INJECTION_SCAN: ScanOutput = {
	verdict: { status: "injection", passes: 4, findings: ["ignore previous instructions"] },
	scrubbed: "",
	secretsFound: false,
};
