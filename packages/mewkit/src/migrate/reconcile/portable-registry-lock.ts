// PID-based file lock for the portable registry. The locking algorithm lives in
// core/file-lock.ts (withFileLock); this module just binds it to the global
// registry lock path so existing callers keep a zero-arg withRegistryLock API.
import { homedir } from "node:os";
import { join } from "node:path";
import { withFileLock } from "../../core/file-lock.js";

const REGISTRY_LOCK_PATH = join(homedir(), ".mewkit", "portable-registry.lock");

export async function withRegistryLock<T>(operation: () => Promise<T>): Promise<T> {
	return withFileLock(REGISTRY_LOCK_PATH, operation);
}
