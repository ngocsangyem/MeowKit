// Cursor-specific denylist additions beyond the shared `denied-token-scan.ts` set (which
// covers .claude/ paths, CLAUDE.md, AskUserQuestion, Task(, CLAUDE_*/ANTHROPIC_* env vars,
// mk/meow slash commands — tokens invalid for ANY non-Claude-Code provider, Codex included).
//
// Every pattern below is Cursor-only and MUST NOT move into the shared scanner: the codex
// bundle legitimately contains `.codex/` paths everywhere, and (not yet cleaned, out of this
// phase's scope) still carries some of the same Claude-tool-call/hook vocabulary the codex
// bundle hasn't been fully de-Claude'd for either. Adding these to the shared scanner would
// immediately fail codex's own passing tests. Single source of truth so cursor-bundle-lint
// and cursor-pack-cleanliness never drift against each other.
//
// Scope decisions (documented, not silently widened):
//   - Grep/Glob: the existing bare-word checks stay case-SENSITIVE (`\bGrep\b`/`\bGlob\b`),
//     because real `.sh`/`.py` scripts in this bundle legitimately invoke the real Unix
//     `grep` command and Python's real `glob.glob()` — banning the words case-insensitively
//     would flag correct, functioning code as if it were fake Claude-tool-primitive framing.
//     Instead this adds a CALL-FORM check (`Grep(`/`Glob(`/`grep(`/`glob(`, case-insensitive,
//     with a negative lookbehind so `glob.glob(`'s second `glob(` — a real dotted Python
//     module call — is not flagged) that catches the actual leak class: prose or pseudocode
//     presenting grep/glob as an invokable primitive (e.g. `` `glob(phase-XX-*.md)` ``).
//   - Hook lifecycle event names: bare `Stop` is deliberately EXCLUDED. It is an ordinary
//     English imperative used dozens of times in legitimate prose ("Stop and ask", "Stop the
//     loop") — banning it case-sensitively-or-not would flood false positives with no
//     precision gain. The five other event names below are unique compound identifiers with
//     no legitimate English-prose use, so they stay safely banned; `SubagentStop` also covers
//     the "Stop as a hook name" case when it appears in its real (compound) form.
export interface CursorDeniedToken {
	label: string;
	pattern: RegExp;
}

export const CURSOR_EXTRA_DENIED_TOKENS: readonly CursorDeniedToken[] = [
	{ label: "Grep tool", pattern: /\bGrep\b/ },
	{ label: "Glob tool", pattern: /\bGlob\b/ },
	{ label: "Claude Code model tier name", pattern: /\b(opus|sonnet|haiku|fable)\b/i },
	{ label: ".codex/ path (codex-only, no cursor equivalent)", pattern: /\.codex\// },
	{
		label: "Claude Task-management tool (TaskCreate/TaskUpdate/TaskGet/TaskList/TodoWrite)",
		pattern: /\b(TaskCreate|TaskUpdate|TaskGet|TaskList|TodoWrite)\b/,
	},
	{ label: "Grep/Glob tool-call form", pattern: /(?<!\.)\b[Gg]rep\(|(?<!\.)\b[Gg]lob\(/ },
	{ label: "Claude Read tool signature (offset=/limit= args)", pattern: /\bRead\([^)]*\b(offset|limit)=/ },
	{
		label: "Claude Code hook lifecycle event name",
		pattern: /\b(PreToolUse|PostToolUse|SessionStart|UserPromptSubmit|SubagentStop)\b/,
	},
	{ label: "Claude Code settings.json hook registration", pattern: /\bsettings\.json\b/ },
	{ label: "Anthropic no-reply email (Claude Code commit trailer)", pattern: /noreply@anthropic\.com/ },
];

/** All Cursor-extra denied-token labels present in `content` (one entry per class, not per hit). */
export function scanCursorExtraDenied(content: string): string[] {
	const hits: string[] = [];
	for (const t of CURSOR_EXTRA_DENIED_TOKENS) if (t.pattern.test(content)) hits.push(t.label);
	return hits;
}
