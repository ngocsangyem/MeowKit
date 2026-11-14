#!/usr/bin/env node
// Pure policy for the `beforeReadFile` security gate (no Cursor dependency, no
// I/O) — unit-testable in isolation. Verified payload shape (docs report §4):
// in: `file_path, content, attachments`; out: `permission (allow|deny), user_message`.
"use strict";

// File-extension / path-marker sensitive-file patterns. Mirrors the codex
// privacy-block.cjs R4 pattern set, adapted to match a `file_path` value
// directly (not a shell command string).
const SENSITIVE_PATH =
	/(?:^|[\\/])(?:\.env(?:\.[\w-]+)?|[\w.-]*\.(?:pem|key|keystore)|[\w.-]*credentials[\w.-]*|[\w.-]*secrets?\.[\w]+|id_(?:rsa|ed25519|dsa|ecdsa))$/i;
const PRIVATE_DIR = /(?:^|[\\/])\.(?:ssh|aws|gnupg)(?:[\\/]|$)/i;

/**
 * Evaluate the read-gate policy for a `beforeReadFile` payload.
 * @returns {{blocked: boolean, reason: string}}
 */
function evaluateReadPolicy(payload) {
	if (!payload || typeof payload !== "object") {
		return { blocked: true, reason: "malformed or missing beforeReadFile payload (unknown schema)" };
	}
	const filePath = typeof payload.file_path === "string" ? payload.file_path : null;
	if (!filePath) {
		return { blocked: true, reason: "beforeReadFile payload missing file_path (unknown schema)" };
	}
	const normalized = filePath.replace(/\\/g, "/");
	if (SENSITIVE_PATH.test(normalized) || PRIVATE_DIR.test(normalized)) {
		return { blocked: true, reason: `sensitive/private file path: ${filePath}` };
	}
	return { blocked: false, reason: "path is not sensitive" };
}

module.exports = { evaluateReadPolicy, SENSITIVE_PATH, PRIVATE_DIR };
