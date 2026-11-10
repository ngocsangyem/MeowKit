// Asking about orphan files without the spinner eating the prompt.
//
// The updater offers orphan deletion through a callback so it stays
// presentation-free. Its default asks inline, which a running spinner overwrites
// — the user sees a stalled "Applying files…" and a cursor waiting on an
// invisible question. So the spinner is stopped, the question is asked through
// the prompt library, and the spinner resumes.
//
// Default is NO. Deleting a file the user may have put there is the one
// irreversible thing an install does, and a mis-hit Enter must not do it.
import * as p from "@clack/prompts";
import pc from "picocolors";

/** A spinner that can be paused around a prompt. */
export interface PausableSpinner {
	start: (message?: string) => void;
	stop: (message?: string) => void;
}

/** Build the updater's orphan-confirmation callback for an active spinner. */
export function orphanPrompt(spinner: PausableSpinner, resumeMessage: string): (orphans: string[]) => Promise<boolean> {
	return async (orphans) => {
		spinner.stop("Orphan files detected");
		p.log.warn(`Found ${orphans.length} orphan file(s) — files on disk no longer in release:`);
		for (const orphan of orphans) p.log.message(`  - ${pc.dim(orphan)}`);
		const answer = await p.confirm({
			message: `Delete ${orphans.length} orphan file(s)?`,
			initialValue: false,
		});
		const confirmed = !p.isCancel(answer) && answer === true;
		spinner.start(resumeMessage);
		return confirmed;
	};
}
