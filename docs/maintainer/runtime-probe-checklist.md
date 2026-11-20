# Runtime probe checklist

Probes that need a live session of a runtime, so an agent does not run them. Do each in a scratch
git project outside the repo, then move the result into `docs/maintainer/host-probe-log.md` with
the host version, the date and what you saw.

Scratch project: one skill `probe-a` per skill root, each with a different `description` naming
its root; one agent `probe-agent` per agent root; one rule file per rule root holding a unique
word; one hook per hook file that appends its own path to `hook-runs.log`.

| # | Host | Do | Record |
|---|---|---|---|
| C1 | Codex | Trust the project, put two files in `.codex/agents/` with the same `name`, ask which agent roles it can spawn | Whether one, both or neither is offered, and which description wins |
| C2 | Cursor | With `probe-a` in `.cursor/skills`, `.agents/skills` and `.claude/skills`, ask it to list its skills | How many `probe-a` entries, and from which roots; then whether turning "Include Third-Party Plugins, Skills, and Other Configs" off removes the `.claude/skills` copy |
| C3 | Grok | `grok inspect --json` in the scratch project | The paths it reports for skills, agents, rules, hooks and MCP; whether `.claude/skills`, `.claude/agents`, `.cursor/skills` and `.cursor/agents` appear; duplicates of `probe-a`; whether one MCP server defined in `.mcp.json` and `.cursor/mcp.json` is listed once; and, from `/config-agents` or an agent file Grok itself writes, the file format and fields of `.grok/agents/` |
| C4 | Grok | Put a `.mdc` file with frontmatter in `.cursor/rules`; ask it to quote the rule | Whether the frontmatter is parsed or shown as text |
| C5 | Grok | Run one shell command with hooks in `.grok/hooks`, `.claude/settings.json` and `.cursor/hooks.json`; read `hook-runs.log` | Which files' hooks ran, how often, the tool name each received and the field names inside `toolInput` for a shell command, a file read and a file edit |
| C6 | Pi | Trust the project; with `probe-a` in `.pi/skills` and `.agents/skills`, start a session | Which copy is listed and the warning text |
| C7 | OMP | Add a `hooks` entry to `.claude/settings.json` and a server to `.cursor/mcp.json`; start a session | Which foreign settings keys take effect |
| C8 | Pi | Trust the project; ask it to run `cat .env`, then throw inside a copy of `.pi/extensions/meowkit.ts` | Whether the call is blocked with the guard's reason, how the reason reaches the model, and that `ctx.cwd` is the project root |
| C9 | OMP | Start a session in a project with the kit; ask it to run `cat .env` and to spawn the `reviewer` agent | Whether the call is blocked with the guard's reason, and whether the agent starts with the tools its file lists |
