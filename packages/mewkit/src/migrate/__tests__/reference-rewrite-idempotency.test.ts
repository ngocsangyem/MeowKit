// Idempotency: rewriting already-rewritten content must be a fixpoint —
// rewrite(rewrite(x)) === rewrite(x) — across the whole fixture corpus and for
// every provider whose goldens are tracked. Also asserts that surviving source
// references are always explained by a preserve/citation (or self-mapping
// rewrite) occurrence, never silently passed through.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripClaudeRefs } from "../converters/md-strip.js";
import {
	createReferenceIntegrityIndex,
	rewriteSourceReferences,
} from "../references/fence-aware-reference-rewriter.js";
import { sourceReferencePattern } from "../references/reference-target-registry.js";
import { providers } from "../provider-registry.js";
import type { ProviderType } from "../types.js";

const fixtureRoot = fileURLToPath(new URL("./fixtures/codex-full-surface/.claude", import.meta.url));
const PROVIDERS: ProviderType[] = ["codex", "cursor", "claude-code"];

function collectMarkdownFiles(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) files.push(...collectMarkdownFiles(full));
		else if (entry.toLowerCase().endsWith(".md")) files.push(full);
	}
	return files;
}

const corpusFiles = collectMarkdownFiles(fixtureRoot);
const migratedRefs = createReferenceIntegrityIndex([
	".claude/agents/planner.md",
	".claude/commands/mk/fix.md",
	".claude/rules/security-rules.md",
	".claude/rules/tool-rules.md",
	".claude/hooks/validate-docs.cjs",
	".claude/skills/demo-skill/",
	"CLAUDE.md",
]);

describe("reference rewrite idempotency", () => {
	it("rewriteSourceReferences is a fixpoint over the corpus for every tracked provider", () => {
		for (const provider of PROVIDERS) {
			for (const file of corpusFiles) {
				const original = readFileSync(file, "utf-8");
				const once = rewriteSourceReferences(original, { provider, migratedRefs, file });
				const twice = rewriteSourceReferences(once.content, { provider, migratedRefs, file });
				expect(twice.content, `${provider}: ${file}`).toBe(once.content);
			}
		}
	});

	it("stripClaudeRefs is a fixpoint over the corpus for every tracked provider", () => {
		for (const provider of PROVIDERS) {
			for (const file of corpusFiles) {
				const original = readFileSync(file, "utf-8");
				const options = { provider, targetName: providers[provider].displayName, migratedRefs };
				const once = stripClaudeRefs(original, options);
				const twice = stripClaudeRefs(once.content, options);
				expect(twice.content, `${provider}: ${file}`).toBe(once.content);
			}
		}
	});

	it("every surviving source reference is explained by an occurrence record", () => {
		for (const provider of PROVIDERS) {
			for (const file of corpusFiles) {
				const original = readFileSync(file, "utf-8");
				const { content, occurrences } = rewriteSourceReferences(original, { provider, migratedRefs, file });
				const survivors = content.match(sourceReferencePattern()) ?? [];
				for (const survivor of survivors) {
					const explained = occurrences.some((o) =>
						(o.decision === "preserve" || o.decision === "preserve-warn") && o.original === survivor
							? true
							: o.decision === "rewrite" && o.rewrittenTo?.includes(survivor),
					);
					expect(explained, `${provider}: unexplained "${survivor}" in ${file}`).toBe(true);
				}
			}
		}
	});
});
