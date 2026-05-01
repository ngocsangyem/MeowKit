/**
 * selected-slug-store — localStorage read/write for the persisted plan slug.
 *
 * Versioned key `orchviz:selectedSlug:v1` to survive future schema changes.
 * All operations are wrapped in try/catch for private-browsing compatibility.
 */

const STORAGE_KEY = "orchviz:selectedSlug:v1";

/**
 * Load the previously selected slug from localStorage.
 * Returns null on miss, parse error, or disabled localStorage.
 */
export function loadSelectedSlug(): string | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw === null || raw === "") return null;
		// Slug is a plain ASCII string — no JSON parsing needed.
		return raw;
	} catch {
		// localStorage disabled (e.g. private browsing with strict settings)
		return null;
	}
}

/**
 * Persist the selected slug to localStorage.
 * Passing null removes the key so the app reverts to most-recent on next load.
 */
export function saveSelectedSlug(slug: string | null): void {
	try {
		if (slug === null) {
			localStorage.removeItem(STORAGE_KEY);
		} else {
			localStorage.setItem(STORAGE_KEY, slug);
		}
	} catch {
		// Ignore write errors (quota exceeded, private browsing)
	}
}
