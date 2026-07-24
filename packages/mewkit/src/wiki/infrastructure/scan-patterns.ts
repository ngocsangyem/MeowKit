// Backward-compatibility re-export. The canonical scanner now lives in the
// runtime-neutral state layer (`src/state/injection-scanner.ts`) so memory, wiki,
// migrate, and generated hooks all share ONE source — no hand-synced third copy.
// The parity test (scanner-adapter.test.ts) asserts a shared payload set behaves
// identically in the .cjs hook source and this port.
export {
	INJECTION_PATTERNS,
	validateContent,
	SECRET_PATTERNS,
	scrubSecrets,
	normalizeForScan,
	type ContentValidation,
} from "../../state/injection-scanner.js";
