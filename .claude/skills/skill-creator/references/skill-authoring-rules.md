# Skill Authoring Rules

These rules govern how new and existing `mk:*` skills are authored, audited, and persisted.

## Contents

- [Rule 1: Record Real Failures in a Gotchas Section](#rule-1-record-real-failures-in-a-gotchas-section)
- [Rule 2: Persistent Skill State Goes to the Host's Stable Data Location](#rule-2-persistent-skill-state-goes-to-the-hosts-stable-data-location)
- [Rule 3: Keep SKILL.md Small and a Normal Run Short](#rule-3-keep-skillmd-small-and-a-normal-run-short)
- [Rule 4: Every Skill must Carry keywords / when_to_use / user-invocable](#rule-4-every-skill-must-carry-keywords--when_to_use--user-invocable)
- [Advisory Frontmatter Fields](#advisory-frontmatter-fields)
- [Commands vs Skills (the kit ships one surface)](#commands-vs-skills-the-kit-ships-one-surface)
- [Rule 5: Docs References Follow the Two-Tier Contract](#rule-5-docs-references-follow-the-two-tier-contract)
- [Rule 6: Match Control to Risk](#rule-6-match-control-to-risk)
- [Rule 7: Keep Generic Content Portable](#rule-7-keep-generic-content-portable)
- [Rules 8 and 9: Kit Maintenance](#rules-8-and-9-kit-maintenance)
- [Rule 10: Reach the Skill's Own Files Without `.claude/`](#rule-10-reach-the-skills-own-files-without-claude)
- [Rule 11: Score Each Skill on the Mechanical Rubric](#rule-11-score-each-skill-on-the-mechanical-rubric)
- [Rule 12: Add a Skill Only for an Observed Gap](#rule-12-add-a-skill-only-for-an-observed-gap)
- [Rule 13: Write Instructions a Model Can Follow](#rule-13-write-instructions-a-model-can-follow)
- [Applies to](#applies-to)

## Rule 1: Record Real Failures in a Gotchas Section

A `SKILL.md` carries a `## Gotchas` section once a real failure has taught something the model does not do by default. An empty section, a placeholder such as "(none yet)", and generic advice ("follow best practices") are noise: they cost tokens on every read and teach nothing. The `mk:skill-creator` template does not scaffold the section; add it with the first real entry.

WHY: Gotchas preserve non-default knowledge learned from real failures, and that is the highest-signal text a skill holds.

**Good example: Gotchas section that grew from observed failures**:

```markdown
# Billing Lib

How to use the internal billing library.

## Gotchas

- Proration rounds DOWN, not to nearest cent.
- test-mode skips the `invoice.finalized` hook.
- Idempotency keys expire after 24h, not 7d.
- Refunds need charge ID, not invoice ID.
```

Add one bullet per observed edge case, each naming the failure and the fix.

## Rule 2: Persistent Skill State Goes to the Host's Stable Data Location

When a skill needs to persist data across sessions (append-only logs, JSON state, SQLite databases, history files), it writes to the host's stable plugin-data location (on Claude Code, `${CLAUDE_PLUGIN_DATA}`), not to the skill's own directory. Where the host has no such location, use a path the user names or `tasks/reports/`.

WHY: Skill directories can be wiped on upgrade; the host's data location is stable.

EXCEPTION: framework-internal infrastructure (the team memory store `.meowkit/memory/{decisions,gotchas}.md`, `tasks/`, `.meowkit/state/`) keeps its current paths: these are framework state, not skill-owned state. The rule applies to data the skill itself creates and consumes (for example a history log).

**Good example: stable plugin-data path**:

```python
# scripts/append-history.py  (illustrative; portable-ignore)
import os
DATA_DIR = os.environ["CLAUDE_PLUGIN_DATA"]
LOG_PATH = f"{DATA_DIR}/standup-post/history.log"
os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
with open(LOG_PATH, "a") as f:
    f.write(entry)
```

## Rule 3: Keep SKILL.md Small and a Normal Run Short

The entry file stays at or under 500 lines and 5,000 estimated tokens (characters divided by 4); the token figure is the one `mewkit validate --skill-rubric` scores (Rule 11) and is the primary cap. Detail moves to files loaded on demand:

- Reference files one level deep (`references/*.md`), each named in SKILL.md with the condition for loading it.
- Step files (`workflow.md` plus `step-NN-*.md`) when a skill has three or more phases with different context needs. A step-file skill is still held to the entry cap and to the run budget below: splitting does not make a long run short.

Read budget: a normal run should read well under 1,000 lines of the skill's own text. A skill whose normal run reads thousands of lines (every reference, every step) is oversized however small each file is. Put the common path in SKILL.md and the rare path in references.

WHY: Once SKILL.md loads, every token competes with task context.

PERIODIC AUDIT: on every model upgrade, check lengths and normal-run reads, and decompose oversized skills.

```text
my-skill/
├── SKILL.md           # 180 lines: overview + routing table
├── references/
│   ├── api.md         # loaded only when API details are needed
│   └── examples.md    # loaded only when examples are needed
└── scripts/
    └── helper.py      # executed via bash, never loaded into context
```

## Rule 4: Every Skill MUST Carry keywords / when_to_use / user-invocable

Every `SKILL.md` frontmatter MUST include three discovery-and-routing fields:

- `keywords:` — array of 5–15 lowercase-hyphenated strings, no duplicates. Catalog metadata for future skill-discovery tooling. Pattern `^[a-z0-9][a-z0-9-]*$`. Validator emits ERROR if missing or invalid.
- `when_to_use:` — string 10–500 chars, third-person voice, includes a "NOT for ..." disambiguation clause when the skill is in a confusion cluster. Validator emits WARN if missing (exits 0 unless `--strict` is passed).
- `user-invocable:` — boolean. Default `true`. `false` only for orchestration internals (auto-invoked, not user-callable directly).

### Authorial discipline (what versus when)

State what the skill does once, in `description`, and when to use it once, in `when_to_use`. Do not restate one in the other, so there is nothing to keep in sync; each says only its own part.

WHY: Standardized metadata keeps skill discovery predictable.

### Validation

Enforced by `mewkit validate --frontmatter` against the `skill-schema.json` the CLI carries — the schema describes what the validator accepts, so it travels with the validator and a project holds no copy to edit or outgrow. CI runs on every PR via `ci.yml`. Two-tier severity: ERROR (schema violation) vs WARN (missing recommended). Pass `--strict` to promote WARN to ERROR.

### Deprecated fields

- `triggers:` — legacy field, no CLI consumer. Use `keywords:` instead. Existing 6 instances are not removed; do not add to new skills.

## Advisory Frontmatter Fields

The following frontmatter fields are advisory — no hook reads them; they annotate skills for humans and downstream tooling.

- `preamble-tier: 1 | 2 | 3` — context-injection priority for the skill's preamble block. 1 = low (loaded on demand), 2 = medium, 3 = high (injected before other context). Skills that depend on memory-read or ship-check preambles typically set `3`.
- `phase: 0 | 1 | 2 | 3 | 4 | 5 | 6 | on-demand` — anchors the skill to a workflow phase. `on-demand` means the skill is invoked by need, not by phase.
- `trust_level: kit-authored | third-party` — provenance marker. Third-party skills should treat external input as DATA per `injection-rules.md`.
- `injection_risk: low | medium | high` — advisory risk level for prompt-injection exposure.
- `requires_external_service: [<service>...]` — external services the skill needs (e.g. `["jira"]`, `["gemini", "minimax"]`). Annotate every external-service entrypoint. `mewkit validate --frontmatter` emits a WARN (non-blocking) for an external-service entrypoint that lacks this field.
- `default_enabled: true | false` — whether the skill works without external configuration. External-service skills set `false` (fail-closed until the required env vars are present). A `true` value requires a verified external-service-free path. Declaring `requires_external_service` without `default_enabled` also WARNs.
- `install_default: true | false` — whether a default install lays the skill down; absent means `true`. Unlike the advisory fields above, the installer reads it: a `false` skill installs only when it is selected (named in the machine's `.meowkit/state/skill-selection.json`, inside a pack the install chose, or already installed there). It is independent of `default_enabled`: `default_enabled` decides whether an installed skill runs without external configuration, `install_default` decides whether the skill is installed at all. A skill listed in `retiredSkills` in `.meowkit/pack-manifest.json` is never installed, whatever this field says.
- `stable_output_contract: true | false` — `true` when the skill returns stable machine-readable IDs / output for created or bound runtime resources.

### Tool Contract Rule

A skill that creates, binds, or selects external runtime resources MUST honor these contract properties (advisory — documented here, read by no hook; promotion to `--strict` is deferred until the WARN check is calibrated over one release):

1. **Fail closed on ambiguity.** When external-resource selection is ambiguous (multiple candidates, missing identifier), stop and ask — never guess a target.
2. **Return stable machine-readable IDs.** For any created/bound runtime resource, surface a stable ID a downstream step can re-bind to, not a transient label.
3. **Default-disabled without config.** External services are `default_enabled: false` unless all required env vars are present; the skill degrades gracefully (soft gate) when they are absent.
4. **Optional artifact schema validation.** A skill that emits a verdict artifact MAY declare schema validation for it.

## Commands vs Skills (the kit ships one surface)

**The kit authors skills and nothing else.** The kit has no commands directory:
a job the kit exposes to a user is a skill under `.claude/skills/<name>/SKILL.md`, invoked as
`mk:<name>`. Every `mk:<name>` reference in kit prose therefore resolves against the skill
inventory or it is a phantom. The kit's CI checks every one against that inventory, and there is
no second inventory to fall back on.

Why one surface: a slash command and a same-named skill are two descriptions of one behavior, and
two descriptions drift — the command keeps a procedure its skill has since rewritten, and an agent
reading the command follows stale steps it has no reason to distrust. One menu entry per job also
means the user picks a job, not a spelling.

A host runtime may still offer its own slash-command directory, and a **project** is free to author
commands there for its own workflows. Those are project content: the kit neither ships, validates
nor rewrites them, and the migration layer maps a project's command surface onto whichever surface
a target provider supports.

Three shapes a job can take, now all expressed as skills:

1. **Skill-composing** — the skill chains other skills (e.g. `mk:cso` composes a security review).
2. **Agent-invoking** — the skill resolves its inputs and hands the work to an agent (e.g.
   `mk:status` resolves the plan, then the `project-manager` agent writes the report).
3. **Standalone** — the skill carries the whole procedure itself.

A skill whose body does nothing but delegate to one other skill is not a shape — it is a duplicate
menu entry. Rewrite the references to the skill that owns the job instead.

## Rule 5: Docs References Follow the Two-Tier Contract

Every `docs/*` reference inside any file under `.claude/` MUST satisfy the kit's docs-reference contract:

- The path is on the Type-1 allowlist (target-project doc generated by a producer skill), OR
- The reference has been replaced by an inlined snippet or plain attribution prose.

A `docs/` path that is not on the allowlist MUST NOT appear as a reference inside `.claude/`: such a file does not exist in a project where `.claude/` is installed.

**WHY:** The kit installer ships `.claude/` + `tasks/` only. References to non-shipped `docs/` paths break at runtime in every downstream project. The contract codifies the two-tier resolution model so authors and the validator agree on what is allowed.

**ENFORCEMENT:** `mewkit validate` checks it; when the contract file is absent, as in a user project, the check reports N/A and exits 0.

## Rule 6: Match Control to Risk

Use exact, low-freedom instructions and deterministic gates only for fragile,
destructive, security-sensitive, or otherwise deterministic steps. For judgment
tasks, define the outcome and leave the method proportionate to the risk.

Do not require finding quotas, reports, memory writes, or a fixed
number of ideas for trivial runs. Those requirements create ceremony without
making the result safer or more reliable.

## Rule 7: Keep Generic Content Portable

Generic skill bodies, references, and templates must use portable capability
language. Provider tool names, model names or IDs, context-window constants,
and model-specific style bans belong in adapter metadata or a provider-specific
projection, never in the generic core.

The toolkit name may appear only in a literal namespace or CLI token in code
or a command example. It must not appear in narrative prose, including
frontmatter descriptions and routing text, in generic skill bodies, references,
or templates. Use “the toolkit” or “the harness” instead.

Style or taste denylists do not belong in the generic core. Describe the
undesired outcome and use a divergence technique or a provider adapter where a
specific model needs additional steering.

## Rules 8 and 9: Kit Maintenance

Rule 8 (preserve contracted workflow choices when repairing a caller mismatch) and Rule 9 (brand-prose lint is blocking only on changed files) govern maintaining the kit, not writing a skill. They live in the kit-maintenance reference that `SKILL.md` names, which authoring runs do not load.

## Rule 10: Reach the Skill's Own Files Without `.claude/`

A skill never names its own directory as `.claude/skills/<name>/`: the same skill is
installed under other roots for other runtimes. Reference a document by its path
relative to the skill root (`references/<file>.md`). A shell resolves paths from its
working directory, not from the skill, so a command in SKILL.md runs a bundled script
through the skill-directory variable (`<var>/scripts/<script>`, where `<var>` is
`CLAUDE_SKILL_DIR` in `${…}` form). On Claude Code, it is substituted only in SKILL.md,
never in other files and never as a shell variable. Other files (references, steps) write
`scripts/<script>` relative to the skill root, and SKILL.md then names the variable
once so the agent knows the directory they resolve against. Rules, agents, hooks and
other skills keep the canonical `.claude/<surface>/…` form, which installers map per
runtime. Every host-runtime tool name a skill mentions is listed in
the kit's `kit-capabilities.json`. A line describing
another project's layout may carry `portable-ignore`. The kit's release check and CI
enforce this.

## Rule 11: Score Each Skill on the Mechanical Rubric

`mewkit validate --skill-rubric` scores every skill on six criteria and writes one row per
skill to `.meowkit/telemetry/skill-rubric.json`. A skill passes a criterion when:

- **Description:** it says what the skill does, when to use it (`when_to_use` or a "when"
  clause) and when not to ("NOT for mk:<other-skill>"); at most 1,024 characters, and at most 1,536
  with `when_to_use`.
- **Entry:** `SKILL.md` is at most 5,000 estimated tokens (characters / 4).
- **Dead refs:** no link, slash command or docs reference in the skill points at nothing.
- **Emphasis:** at most 10 emphatic words or capitalised bold spans per 1,000 words of the
  `SKILL.md` body; keep emphasis for gates.
- **Harness tools:** each tool name only one host defines has a fallback stated within 3
  lines.
- **Duplicates:** no paragraph of 40 or more words is copied into another skill, except
  copies listed in `shared-families.json`.

The rows warn and never fail the run.

## Rule 12: Add a Skill Only for an Observed Gap

Create a new skill only when a failure was observed, or a gap was checked, and no existing skill covers it. Name the failure and the skill you checked. Otherwise extend the existing skill.

WHY: self-generated skills that restate what the model already does score no better than no skill, and each extra skill adds routing noise and a description in every session's listing.

## Rule 13: Write Instructions a Model Can Follow

- No persona openers ("You are an expert ..."). A role is allowed only where it defines a boundary or an output, for example a reviewer stance.
- Give the reason for a non-obvious rule in a clause. Reserve capitals and "never" for true gates (safety, destructive, irreversible), and say what they protect.
- When a skill delegates, the brief carries the goal, separates fixed constraints from the current approach, and names the return shape; the skill also says when not to delegate (small, sequential or same-file work).
- Give a named way out when the premise fails or the approach cannot meet the goal, and a retry cap. A skill that reports to a controller ends with the four-status block from `.claude/rules/agent-conduct.md` (A1).
- Judgment work is stated as outcome, boundaries and a check. Exact steps are for fragile, destructive or security-sensitive steps (Rule 6).

## Applies to

- `mk:skill-creator` (templates follow Rules 1, 3, 4, 12 and 13)
- All skill authoring (Rules 1, 2, 3, 4, 6, 7, 10, 11, 12, 13; Rule 5 for docs references)
- Model-upgrade audits (Rule 3 measurable check)
- Skill maintenance for any skill with persistent state (Rule 2)
- Every change under `.claude/` (Rule 5 and Rule 10 mechanical checks in CI)
