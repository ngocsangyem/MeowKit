export * from "./reconcile-types.js";
export {
	computeContentChecksum,
	computeFileChecksum,
	computeSectionChecksums,
	isBinaryContent,
} from "./checksum-utils.js";
export {
	REGISTRY_PATH,
	addPortableInstallation,
	findPortableInstallations,
	getInstallationsByType,
	readPortableRegistry,
	removePortableInstallation,
	syncPortableRegistry,
	writePortableRegistry,
	type PortableInstallationV3,
	type PortableRegistryV3,
} from "./portable-registry.js";
export {
	buildConvertedChecksums,
	buildSourceItemState,
	buildTargetStates,
	buildTypeDirectoryStates,
	type ConversionFallbackWarning,
} from "./reconcile-state-builders.js";
export { reconcile } from "./reconciler.js";
export { displayDiff, generateDiff } from "./diff-display.js";
export {
	resolveConflict,
	type NonInteractiveConflictPolicy,
} from "./conflict-resolver.js";
export {
	sanitizeSingleLineTerminalText,
	sanitizeTerminalText,
} from "./output-sanitizer.js";
export {
	acquireMigrationLock,
	releaseMigrationLock,
	type AcquireLockResult,
	type ProcessLockOptions,
} from "./process-lock.js";
