# AC-01 — Exec form for registrations, decided by evidence

Sprint 3, `meowkit-v3-lean-runtime`. Recorded 2026-11-07.
Claude Code **v2.1.316** (`/Users/sangnguyen/.local/bin/claude --version`).

## Verdict

| Registration site | Form to use | Placeholder to use |
| --- | --- | --- |
| `.claude/settings.json` node hooks | **exec form** — `{"type":"command","command":"node","args":["${CLAUDE_PROJECT_DIR}/.claude/hooks/x.cjs"]}` | `${CLAUDE_PROJECT_DIR}` |
| `careful` / `freeze` / `investigate` `SKILL.md` `hooks:` | **exec form** — `{"type":"command","command":"node","args":["${CLAUDE_PROJECT_DIR}/.claude/skills/<s>/bin/check-*.cjs"]}` | `${CLAUDE_PROJECT_DIR}` — **not** `${CLAUDE_SKILL_DIR}` |

Both halves resolve in the exec (`args`) form, so the string form is **not** needed anywhere. The one substantive
change against the contract's framing: `${CLAUDE_SKILL_DIR}` does **not** resolve in a `hooks:` block in either form, so
the three guard registrations must switch to `${CLAUDE_PROJECT_DIR}`.

## Resolution matrix (live probe)

| Registration | Form | `${CLAUDE_PROJECT_DIR}` | `${CLAUDE_SKILL_DIR}` |
| --- | --- | --- | --- |
| `settings.json` | exec (`args`) | **resolves** (placeholder substitution into each `args` element) | n/a |
| `SKILL.md` `hooks:` | exec (`args`) | **resolves** | **does not resolve** — passed through verbatim as the 16-char literal `${CLAUDE_SKILL_DIR}` |
| `SKILL.md` `hooks:` | shell (string) | **resolves** (as an exported env var, via shell expansion) | **does not resolve** — expands to the **empty string** |

Also measured in the hook's own process environment: `CLAUDE_PROJECT_DIR` is **exported**; `CLAUDE_SKILL_DIR` is
**unset**. That is why the shell form produces an empty string rather than a literal — there is no Claude Code
substitution *and* no variable for the shell to expand.

## Evidence A — official docs

Source: `https://docs.claude.com/en/docs/claude-code/hooks.md` (Hooks reference) and
`https://code.claude.com/docs/en/skills.md` (Extend Claude with skills), both fetched 2026-11-07.

1. **Hooks reference → "Command hook fields" → "Exec form and shell form"**

   > **Exec form** runs when `args` is present. Claude Code resolves `command` as an executable on `PATH` and spawns it
   > directly with `args` as the argument vector. There is no shell, so each `args` element is one argument exactly as
   > written, and path placeholders like `${CLAUDE_PLUGIN_ROOT}` are substituted into `command` and into each `args`
   > element as plain strings.

   and, in the same section:

   > Both forms support the same [path placeholders](#reference-scripts-by-path), and both export them as the
   > environment variables `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, and `CLAUDE_PLUGIN_DATA` on the spawned process.

   The exported-variable list names `CLAUDE_PROJECT_DIR` and omits `CLAUDE_SKILL_DIR`.

2. **Hooks reference → "Reference scripts by path"** enumerates the path placeholders exhaustively:
   `${CLAUDE_PROJECT_DIR}`, `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`. `${CLAUDE_SKILL_DIR}` is absent. The same
   section states the preference directly:

   > Prefer [exec form](#exec-form-and-shell-form) for any hook that references a path placeholder. In shell form, wrap
   > each placeholder in double quotes.

   and under "Hook development best practices": *"In exec form, use `${CLAUDE_PROJECT_DIR}` and the path needs no
   quoting. In shell form, wrap it in double quotes."*

3. **Hooks reference → "Exec form and shell form", Windows note** — the decisive portability argument for `node` +
   script path, which is exactly this sprint's shape:

   > The `node` plus script-path pattern works on every platform because `node.exe` is a real binary.

   The worked example in the "Block the action when a hook fails" section is this sprint's target form verbatim:
   `"command": "node", "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/check-command.js"]`.

4. **Hooks reference → PowerShell section** confirms placeholder substitution applies to skill-defined hooks, naming the
   same three placeholders: *"Claude Code rewrites the `${CLAUDE_PROJECT_DIR}`, `${CLAUDE_PLUGIN_ROOT}`, and
   `${CLAUDE_PLUGIN_DATA}` placeholders … whether the hook is defined in `settings.json`, a plugin, or a skill."*

5. **Skills doc → "Available string substitutions"** scopes `${CLAUDE_SKILL_DIR}` to two places, neither of which is a
   `hooks:` block:

   > Claude Code substitutes `${CLAUDE_SKILL_DIR}` and `${CLAUDE_PROJECT_DIR}` in two places: the skill's markdown
   > content, and Bash rules in the `allowed-tools` frontmatter.

   The field table's own description scopes it the same way: *"Use this in bash injection commands…"*. The `hooks`
   field entry (same table) points at the hooks reference for its format and says nothing about skill-scoped
   placeholders. `${CLAUDE_SKILL_DIR}` does not appear in the hooks reference at all, nor in
   `https://code.claude.com/docs/en/env-vars.md`.

**Docs status:** explicit and positive for `${CLAUDE_PROJECT_DIR}` in exec form, including in skill-defined hooks.
For `${CLAUDE_SKILL_DIR}` in a `hooks:` block the docs are *negative by omission* — three exhaustive enumerations
(path placeholders, exported hook env vars, the two substitution sites for `${CLAUDE_SKILL_DIR}`) each exclude it,
but no sentence says "unsupported in hooks". Because omission is weaker evidence than a statement, the live probe below
was run to settle it.

## Evidence B — live probe

Isolated throwaway project, nothing in the MeowKit tree touched:
`<scratch>/ac01-probe/` with `.claude/skills/probe/SKILL.md` and `.claude/settings.json`.
Each run: `claude -p "/probe" --permission-mode acceptEdits --allowedTools "Bash(echo *)"`, where the skill body tells
Claude to run one `echo` so the `PreToolUse:Bash` hook fires. The hook writes its observations to an **absolute** path
fixed at generation time, so it leaves a trace whether or not any placeholder resolves — that separates "the hook never
registered" from "the hook ran but the path was wrong". (The first attempt used
`args: ["${CLAUDE_SKILL_DIR}/bin/p.cjs", …]` and produced no output at all, which is ambiguous on its own; hence the
redesign.)

### Probe 1 — `SKILL.md` `hooks:`, exec form

```yaml
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "node"
          args: ["-e", "<writes ${CLAUDE_SKILL_DIR}, ${CLAUDE_PROJECT_DIR} and both env vars to an absolute path>"]
```

Output:

```
FIRED skillph=${CLAUDE_SKILL_DIR} projph=<scratch>/ac01-probe skillenv=<unset> projenv=<scratch>/ac01-probe
```

- the skill-frontmatter hook fires in exec form;
- `${CLAUDE_PROJECT_DIR}` is substituted into an `args` element;
- `${CLAUDE_SKILL_DIR}` is **not** substituted — the literal survives into `process.argv`;
- `CLAUDE_SKILL_DIR` is **not** in the hook's environment, `CLAUDE_PROJECT_DIR` is.

### Probe 2 — `settings.json`, exec form

```json
{"type":"command","command":"node","args":["-e","<writer>","${CLAUDE_PROJECT_DIR}/.claude/hooks/x.cjs"]}
```

Output:

```
SETTINGS-EXECFORM arg1=<scratch>/ac01-probe/.claude/hooks/x.cjs projenv=<scratch>/ac01-probe
```

`${CLAUDE_PROJECT_DIR}` resolves in an `args` element in `settings.json`, matching the docs. This is the form every node
registration in `settings.json` will use.

### Probe 3 — `SKILL.md` `hooks:`, shell form

`command: printf '…%s…%s…%s…' "${CLAUDE_SKILL_DIR}" "${CLAUDE_PROJECT_DIR}" "$CLAUDE_PROJECT_DIR" >> <abs path>`
(expansions left outside single quotes so the shell can act on them). Output:

```
SKILL-SHELL braceSkill=[] braceProj=[<scratch>/ac01-probe] bareProj=[<scratch>/ac01-probe]
```

`${CLAUDE_SKILL_DIR}` → empty string. `${CLAUDE_PROJECT_DIR}` and `$CLAUDE_PROJECT_DIR` both resolve, via shell
expansion of the exported variable. So no form of a `hooks:` registration can reach a path built from
`${CLAUDE_SKILL_DIR}`.

## Consequence: the three BASE skill guards never run

At BASE the guards are registered in shell form against `${CLAUDE_SKILL_DIR}`:

- `.claude/skills/careful/SKILL.md:18` — `bash ${CLAUDE_SKILL_DIR}/bin/check-careful.sh`
- `.claude/skills/freeze/SKILL.md:19,24` — `bash ${CLAUDE_SKILL_DIR}/bin/check-freeze.sh` (on `Edit` and on `Write`)
- `.claude/skills/investigate/SKILL.md:26` — `bash ${CLAUDE_SKILL_DIR}/bin/check-report-path.sh`

Per probe 3 the variable expands to empty, so the command the shell actually receives is `bash /bin/check-careful.sh`,
which exits 127 — a non-2 exit, i.e. **fail-open**. All three guards are dead registrations at BASE, independently of
the guard scripts themselves.

This does not change what the AC-02 guard fixtures record: they capture each guard *script's* own
stdin → stdout/stderr/exit behavior, invoked directly, which stays the parity target for the `.cjs` ports (AC-08).
It does mean AC-08's "the SKILL.md `hooks:` blocks invoke the node ports in the AC-01 form" is a **bug fix**, not a
like-for-like rewrite: the ported blocks will fire where the BASE ones never did. Flagged for the Gate 2 reviewer, since
enabling three previously-inert guards is a behavior change that Scope (Out) does not anticipate — notably `freeze`,
which blocks `Edit`/`Write`, and which AC-09's process-count note already treats as if it were live.

## Residual risk

`${CLAUDE_PROJECT_DIR}` hard-codes the guard scripts to a **project-level** install
(`<project>/.claude/skills/<s>/bin/`). A guard registered this way does not resolve for a personal install under
`~/.claude/skills/` or inside a plugin, where `${CLAUDE_PLUGIN_ROOT}` would be required. MeowKit ships its skills into
the project's `.claude/`, so this is correct for every supported install today; it is recorded here because there is no
placeholder that is simultaneously correct for both layouts in a `hooks:` block.

## Reproduction

```sh
# docs
curl -sL https://docs.claude.com/en/docs/claude-code/hooks.md -o hooks-ref.md
curl -sL https://code.claude.com/docs/en/skills.md            -o skills.md
# live probes: see Evidence B; each is one `claude -p "/probe"` run in a throwaway project
```
