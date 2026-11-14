// The ship set only carries git-tracked files, so a throwaway source tree has to
// be a git work tree with its files in the index before a build can see them.
import { execFileSync } from "node:child_process";

/** Make `root` a git work tree and stage every file currently under it. */
export function gitTrackTree(root: string): void {
	execFileSync("git", ["init", "-q"], { cwd: root, stdio: "pipe" });
	execFileSync("git", ["add", "-A"], { cwd: root, stdio: "pipe" });
}
