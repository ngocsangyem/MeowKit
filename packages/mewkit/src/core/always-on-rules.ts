// The always-on rule set: the `.claude/rules/*.md` files a session auto-loads on every
// turn. Single source of truth for every place that must assert the set is present —
// install validation, the pack safety invariant, and the pack manifest's base files.
//
// Membership is deliberate and small: each file carries enforcement no other file
// repeats, so a missing one makes an install unsafe. Phase- and
// flow-specific rules are NOT here; they load just in time from the owning skill's
// `references/`.

/** File names, relative to `.claude/rules/`, in load order. */
export const ALWAYS_ON_RULES = [
	"meowkit-core.md",
	"security-rules.md",
	"injection-rules.md",
	"gate-rules.md",
	"core-behaviors.md",
	"development-rules.md",
	"agent-conduct.md",
] as const;

/** The same set as `.claude/`-relative paths (pack manifest / inventory convention). */
export const ALWAYS_ON_RULE_PATHS: readonly string[] = ALWAYS_ON_RULES.map((f) => `rules/${f}`);
