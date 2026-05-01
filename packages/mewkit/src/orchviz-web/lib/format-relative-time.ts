/**
 * formatRelativeTime — wraps Intl.RelativeTimeFormat with unit-selection logic.
 *
 * Returns human-readable relative strings:
 *   "just now" (<60s), "3m ago", "2h ago", "5d ago"
 *
 * Pure function; no side-effects. ~30 LOC.
 */

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/**
 * Format a past timestamp as a relative string ("3m ago", "just now", …).
 *
 * @param mtimeMs - epoch ms of the resource modification time
 * @param now     - epoch ms to compare against (defaults to Date.now())
 */
export function formatRelativeTime(mtimeMs: number, now: number = Date.now()): string {
	const diffMs = mtimeMs - now; // negative = in the past
	const absSec = Math.abs(diffMs) / 1000;

	if (absSec < 60) {
		return "just now";
	}

	const absMins = absSec / 60;
	if (absMins < 60) {
		// floor → e.g. 3m ago
		return rtf.format(-Math.floor(absMins), "minute");
	}

	const absHours = absMins / 60;
	if (absHours < 24) {
		return rtf.format(-Math.floor(absHours), "hour");
	}

	const absDays = absHours / 24;
	return rtf.format(-Math.floor(absDays), "day");
}
