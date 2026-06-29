import type { WikiSlug } from "../domain/index.js";
import type { WikiIndex, WikiRepository, WikiSearchHit } from "./ports.js";

// Query side (CQS). These take ONLY the read-capable slice of each port via Pick<>, so a
// query physically cannot reach a write method (searchFts only, listPages only). searchWiki
// is side-effect-free — the FTS match string is bound, never interpolated (see wiki-query.ts).

export function searchWiki(index: Pick<WikiIndex, "searchFts">, query: string, limit = 10): WikiSearchHit[] {
	return index.searchFts(query, limit);
}

export function listWikiPages(repo: Pick<WikiRepository, "listPages">, slug: WikiSlug): string[] {
	return repo.listPages(slug);
}
