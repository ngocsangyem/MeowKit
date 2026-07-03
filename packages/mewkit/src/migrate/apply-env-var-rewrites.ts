// Applies the static env-var rewrite table to a file's content BEFORE the audit.
// Only "rewrite"-disposition tokens are substituted (a fixed literal replaces the
// token); "neutralize" tokens are left in place for the audit to warn+annotate.
//
// SECURITY: the replacement string comes ONLY from the static table (validated by
// resolveEnvVar against SAFE_REWRITE_OUTPUT). The matched token selects the entry
// but never contributes to the output — no content-derived interpolation.

import { envVarTokenPattern, resolveEnvVar } from "./references/env-var-rewrite-table.js";

export interface EnvVarRewriteApplication {
	content: string;
	/** Distinct tokens that were substituted, with their annotation. */
	applied: Array<{ token: string; rewrittenTo: string; annotation: string }>;
}

/**
 * Rewrite every table-known env-var token whose disposition is "rewrite".
 * Returns the new content plus one annotation per distinct rewritten token.
 */
export function applyEnvVarRewrites(content: string): EnvVarRewriteApplication {
	const appliedByToken = new Map<string, { token: string; rewrittenTo: string; annotation: string }>();
	const next = content.replace(envVarTokenPattern(), (token) => {
		const resolution = resolveEnvVar(token);
		if (!resolution || resolution.disposition !== "rewrite" || !resolution.rewriteTo) return token;
		if (!appliedByToken.has(token)) {
			appliedByToken.set(token, { token, rewrittenTo: resolution.rewriteTo, annotation: resolution.annotation });
		}
		return resolution.rewriteTo;
	});
	return { content: next, applied: [...appliedByToken.values()] };
}
