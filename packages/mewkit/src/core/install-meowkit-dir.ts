// Lay down the `.meowkit/` members the kit itself ships, and the ignore file
// that decides which of them a team commits.
//
// `.claude/` has always been installed from the release. `.meowkit/` was not,
// which left its shipped members — the ignore template, the MCP and env
// examples, the pack manifest — arriving only through `mewkit setup`, so a
// project that ran `init` alone had a half-populated state directory and,
// crucially, no `.meowkit/.gitignore`. Without that file every machine-written
// class under `.meowkit/` is committable, including the local kit copy whose
// whole value depends on a pull request being unable to reach it.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * `.meowkit/.gitignore` — deny everything, then re-include what a team shares.
 *
 * Deny-all rather than per-class, because the per-class form fails in the
 * dangerous direction: a new machine-written class arrives untracked only if
 * someone remembers to add its line, and a forgotten one commits telemetry or a
 * local kit copy. Deny-all fails the other way — a new class is ignored until
 * someone decides it should be shared.
 *
 * The consequence, accepted: a `.meowkit/` file a project had committed and that
 * is not on this list stops being tracked on a fresh clone. Already-tracked
 * files keep being tracked, so this bites only there.
 *
 * `cache/` is covered by the leading `*` and that is load-bearing, not
 * incidental: the local kit copy under it is what file deletion is checked
 * against, and a pull request can neither introduce nor alter a file git does
 * not track.
 */
export const KIT_DIR_GITIGNORE = `*
!.gitignore
!config.yaml
!.env.example
!mcp.json.example
!bin/
!bin/mewkit
!memory/
!memory/*.md
`;

/**
 * The `.meowkit/` members the kit ships, as opposed to a project's own state.
 * These are the paths ownership metadata covers outside `.claude/`, so a file
 * added here becomes a file `uninstall` may consider removing.
 */
export const KIT_MEOWKIT_FILES = [
	".env.example",
	"gitignore.meowkit",
	"mcp.json.example",
	"pack-manifest.json",
	// The governance registry the pack checks read to learn which pack owns each
	// artifact. The pack manifest declares it shipped content in its own
	// `base.files`; without it in the install, an installed project's pack check
	// reports every artifact as belonging to no pack, while the source tree it
	// came from passes. Two declarations about the same file, and only one of
	// them was being honored.
	"harness-inventory.json",
] as const;

/** Write the deny-all ignore file unless the project's copy already matches. */
export function writeKitDirGitignore(projectRoot: string, dryRun = false): boolean {
	const target = join(projectRoot, ".meowkit", ".gitignore");
	if (existsSync(target) && readFileSync(target, "utf-8") === KIT_DIR_GITIGNORE) return false;
	if (!dryRun) {
		mkdirSync(join(projectRoot, ".meowkit"), { recursive: true });
		writeFileSync(target, KIT_DIR_GITIGNORE, "utf-8");
	}
	return true;
}

/**
 * Copy the release's own `.meowkit/` members into the project, for the ones it
 * does not already have. These are templates a user edits, so an existing copy
 * is never overwritten — the same rule the `user` layer follows under `.claude/`.
 */
export function copyKitMeowkitFiles(sourceDir: string, projectRoot: string, dryRun = false): string[] {
	const added: string[] = [];
	const from = join(sourceDir, ".meowkit");
	if (!existsSync(from)) return added;
	for (const name of KIT_MEOWKIT_FILES) {
		const src = join(from, name);
		const dest = join(projectRoot, ".meowkit", name);
		if (!existsSync(src) || existsSync(dest)) continue;
		if (!dryRun) {
			mkdirSync(join(projectRoot, ".meowkit"), { recursive: true });
			copyFileSync(src, dest);
		}
		added.push(join(".meowkit", name));
	}
	return added;
}
