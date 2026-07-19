// Deterministic PR-target parsing + remote matching for `mewkit review prepare`.
// Pure functions — no git/network — so parsing and remote-selection are unit-tested
// in isolation. NEVER guesses owner/repo: ambiguous or host-mismatched input returns
// a typed error, never a best-effort guess (a wrong base repo = a wrong review).

export interface PrTarget {
	host: "github";
	owner?: string; // absent for a bare PR number (resolved from a lone remote)
	repo?: string;
	pr: number;
}

export interface Remote {
	name: string;
	url: string;
	host: string;
	owner: string;
	repo: string;
}

export interface RemoteMatch {
	remote: string; // remote NAME to fetch from (the PR's BASE repo)
	host: string;
	owner: string;
	repo: string;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const PR_URL_RE = /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/pull\/(\d+)\/?$/i;
const OWNER_REPO_HASH_RE = /^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)#(\d+)$/;
const BARE_RE = /^#?(\d+)$/;

// Parse a full PR URL, `owner/repo#123`, or a bare `123` / `#123`.
export function parsePrTarget(input: string): Parsed<PrTarget> {
	const s = (input ?? "").trim();
	if (!s) return { ok: false, error: "empty PR target" };

	const url = s.match(PR_URL_RE);
	if (url) return { ok: true, value: { host: "github", owner: url[1], repo: url[2], pr: Number(url[3]) } };

	const oh = s.match(OWNER_REPO_HASH_RE);
	if (oh) return { ok: true, value: { host: "github", owner: oh[1], repo: oh[2], pr: Number(oh[3]) } };

	const bare = s.match(BARE_RE);
	if (bare) {
		const pr = Number(bare[1]);
		if (!Number.isInteger(pr) || pr <= 0) return { ok: false, error: `invalid PR number: "${s}"` };
		return { ok: true, value: { host: "github", pr } };
	}

	return { ok: false, error: `unrecognized PR target: "${s}" (use a PR URL, owner/repo#123, or a bare number)` };
}

// Parse `git remote -v` output into structured GitHub remotes (fetch lines only).
export function parseGitRemotes(remoteV: string): Remote[] {
	const seen = new Set<string>();
	const out: Remote[] = [];
	for (const line of (remoteV ?? "").split("\n")) {
		const m = line.match(/^(\S+)\s+(\S+)\s+\(fetch\)/);
		if (!m) continue;
		const [, name, url] = m;
		if (seen.has(name)) continue;
		const gh = url.match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?\/?$/i);
		if (!gh) continue;
		seen.add(name);
		out.push({ name, url, host: "github", owner: gh[1], repo: gh[2] });
	}
	return out;
}

// Choose the remote that hosts the PR's BASE repo.
// - owner/repo known  → the remote whose owner/repo matches (case-insensitive); zero
//   or >1 distinct matches → error.
// - bare number        → only when exactly ONE github remote exists; else error.
// - explicitOverride   → that remote must exist and (when owner/repo known) match; a
//   mismatch is an error, never a silent trust of the override.
export function matchRemote(
	remotes: Remote[],
	target: PrTarget,
	explicitOverride?: string,
): Parsed<RemoteMatch> {
	const asMatch = (r: Remote): RemoteMatch => ({ remote: r.name, host: r.host, owner: r.owner, repo: r.repo });
	const sameRepo = (r: Remote) =>
		target.owner != null &&
		target.repo != null &&
		r.owner.toLowerCase() === target.owner.toLowerCase() &&
		r.repo.toLowerCase() === target.repo.toLowerCase();

	if (explicitOverride) {
		const r = remotes.find((x) => x.name === explicitOverride);
		if (!r) return { ok: false, error: `remote "${explicitOverride}" not found` };
		if (target.owner != null && !sameRepo(r)) {
			return { ok: false, error: `remote "${explicitOverride}" points at ${r.owner}/${r.repo}, not the PR base ${target.owner}/${target.repo}` };
		}
		return { ok: true, value: asMatch(r) };
	}

	if (target.owner != null && target.repo != null) {
		const matches = remotes.filter(sameRepo);
		const names = [...new Set(matches.map((m) => m.name))];
		if (names.length === 0) return { ok: false, error: `no remote points at the PR base ${target.owner}/${target.repo}; pass --remote <name>` };
		if (names.length > 1) return { ok: false, error: `multiple remotes point at ${target.owner}/${target.repo} (${names.join(", ")}); pass --remote <name>` };
		return { ok: true, value: asMatch(matches[0]) };
	}

	// bare number
	if (remotes.length === 0) return { ok: false, error: "no github remote found; pass owner/repo#<n> and --remote <name>" };
	if (remotes.length > 1) return { ok: false, error: `bare PR number is ambiguous across ${remotes.length} remotes; use owner/repo#<n> or --remote <name>` };
	return { ok: true, value: asMatch(remotes[0]) };
}
