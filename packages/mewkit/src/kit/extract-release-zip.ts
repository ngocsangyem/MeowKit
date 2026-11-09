// Extracting the legacy release zip, behind the same guard the verified
// artifact uses.
//
// Pure JS, so it behaves identically on macOS, Linux and Windows — an earlier
// shell-out to `unzip` failed on Windows, which ships none.
//
// Every entry's destination is resolved through the shared path-safety helper
// before anything is written, rather than handing the whole archive to the
// library's `extractAllTo`, which decides for itself what an entry path means. A
// zip from a release is remote content: an entry named
// `../../.ssh/authorized_keys` is a file the user never asked for, written
// outside the directory they can see. Hardening only the verified-artifact path
// would leave this one reachable by publishing a release with no artifact at
// all, which is the cheaper of the two attacks.
import AdmZip from "adm-zip";

import { modeForContent, resolveSafeMemberPath, writeMember } from "./safe-extract.js";

/**
 * Write every entry whose destination stays inside `extractDir`, and refuse the
 * whole archive on the first one that does not.
 *
 * Refusing the archive rather than skipping the entry is deliberate: an archive
 * carrying an escaping path is not a good archive with one bad file in it. And
 * every destination is resolved BEFORE any is written, so a refusal has not
 * already laid down the entries that preceded the hostile one.
 */
export async function extractReleaseZip(zipPath: string, extractDir: string): Promise<void> {
	const zip = new AdmZip(zipPath);
	const planned: Array<{ target: string; data: Buffer }> = [];
	for (const entry of zip.getEntries()) {
		if (entry.isDirectory) continue;
		const outcome = await resolveSafeMemberPath(extractDir, entry.entryName);
		if ("reason" in outcome) {
			throw new Error(`Release archive rejected: ${outcome.reason}. Nothing was extracted.`);
		}
		planned.push({ target: outcome.target, data: entry.getData() });
	}
	for (const { target, data } of planned) writeMember(target, data, modeForContent(data));
}
