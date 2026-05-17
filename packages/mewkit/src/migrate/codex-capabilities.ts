// Re-export shim. The canonical definitions now live alongside the codex
// provider module so all Codex-specific surface area sits under one folder.
// Legacy import paths (`./codex-capabilities.js`) continue to work unchanged.
export * from "./providers/codex/capabilities.js";
