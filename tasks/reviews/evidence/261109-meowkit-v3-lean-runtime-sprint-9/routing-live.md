# Live routing run — integration journey specs

**Branch chosen: (a) a recorded live run.** `claude` was available, the non-interactive run
succeeded, and the pre-rewrite half below is a real before-state. Branch (b) (an explicit deferral
record) is therefore NOT taken and does not appear in this file. This is the only artifact at this
path.

**The before-rewrite half of this record was written and committed before any metadata edit.** The
after-rewrite half is filled in once the integration-description rewrite lands; until then its
section says so explicitly and carries no result.

Date of the pre-rewrite run: **2026-11-09** (UTC timestamps per call below).
Host binary: `/Users/sangnguyen/.local/bin/claude`, version **2.1.316**.
Model id reported by the runtime for every call: **`claude-opus-5-5`** (`modelUsage` key in the
JSON result; `canonicalModel: "claude-opus-5-5"`, `provider: "firstParty"`).

## What was measured, and what was not

The subject under test is the **always-listed integration metadata** — the `name`,
`description` and `when_to_use` scalars of the 24 integration skills, which is exactly the field
set the budget extractor measures and exactly what the rewrite shortens. Each call presents that
metadata block and one journey prompt, and asks for a single leaf skill id. Nothing else from the
repository is supplied: no hub `SKILL.md` body, no routing table, no `CLAUDE.md`.

That is deliberate and it is the harsher reading. The rewrite moves routing detail *into* the hub
bodies, which are not always-listed; if the probe fed the hub bodies it would measure a surface the
rewrite is allowed to grow. Feeding only the measured metadata asks the question the budget
actually puts at risk: **can a model still pick the right leaf from the bytes that are always
listed?**

The probe is not a claim about end-to-end harness routing, which also sees the hub bodies,
`CLAUDE.md` and the user's session. It is a before/after comparison over one fixed surface with one
fixed prompt template, where the only variable is the metadata text.

## Exact command invoked

Per spec, with the rendered prompt on stdin and cwd set to a scratch directory outside this
repository (so no session file, transcript or state lands in the tree):

```
cd "$TMPDIR/mk-routing-pre" && /Users/sangnguyen/.local/bin/claude -p \
  --output-format json \
  --disallowed-tools Bash Edit Write WebFetch WebSearch \
  < prompt-<spec-id>.txt
```

No secret, token or environment variable was passed. The run is read-only by construction: every
writing tool is on `--disallowed-tools`, and `permission_denials` was empty on all seven calls, so
nothing was attempted and blocked either.

Reproducible driver, committed next to this file: **`routing-probe.md`** — renders the metadata
block from the live tree, renders one prompt per `j13…` spec, and records exit code, model id and
verbatim result per spec. Invocation:

```
bash tasks/reviews/evidence/261109-meowkit-v3-lean-runtime-sprint-9/routing-probe.md "$TMPDIR/mk-routing-pre"
```

Supporting artifacts in this directory:

- `routing-metadata-before.md` — the verbatim pre-rewrite metadata block fed to every call
  (**13 103 B** as rendered, 24 integration skills).
- `routing-prompt-example.md` — the complete verbatim prompt for `j13`, so the template is not
  only described but readable.

## Pre-rewrite results (before-state)

Prompt template, verbatim (the metadata block is spliced in where named):

```
You are routing one user request to exactly one MeowKit integration skill.
These are the only candidates, given as the metadata a session lists before any skill runs:

<contents of routing-metadata-before.md>

User request: <spec prompt>

Answer with the single skill id only (e.g. mk:jira-search). No prose, no explanation.
```

Verbatim per-call output. Each row's `result` is the model's complete reply text, copied from the
JSON result object unmodified; `exit` is the process exit code.

| Spec | Started (UTC) | exit | `expected_route` | Verbatim `result` | Model | Verdict |
|---|---|---|---|---|---|---|
| `j13-jira-single-issue-field-update` | 2026-11-09T14:32:16Z | 0 | `mk:jira-issue` | `mk:jira-issue` | `claude-opus-5-5` | PASS |
| `j14-jira-bulk-label-sweep` | 2026-11-09T14:32:25Z | 0 | `mk:jira-bulk` | `mk:jira-bulk` | `claude-opus-5-5` | PASS |
| `j15-jira-sprint-backlog-points` | 2026-11-09T14:32:34Z | 0 | `mk:jira-agile` | `mk:jira-agile` | `claude-opus-5-5` | PASS |
| `j16-jira-vietnamese-worklog` | 2026-11-09T14:32:42Z | 0 | `mk:jira-time` | `mk:jira-time` | `claude-opus-5-5` | PASS |
| `j17-confluence-cql-space-search` | 2026-11-09T14:32:51Z | 0 | `mk:confluence-search` | `mk:confluence-search` | `claude-opus-5-5` | PASS |
| `j18-confluence-spec-gap-analysis` | 2026-11-09T14:32:59Z | 0 | `mk:confluence-spec-analyst` | `mk:confluence-spec-analyst` | `claude-opus-5-5` | PASS |
| `j19-confluence-label-one-page` | 2026-11-09T14:33:08Z | 0 | `mk:confluence-collaborate` | `mk:confluence-collaborate` | `claude-opus-5-5` | PASS |

Raw JSON fields captured per call (`result`, `modelUsage` key, `is_error`, `subtype`), verbatim:

```
=== j13-jira-single-issue-field-update
started_utc: 2026-11-09T14:32:16Z
exit: 0
expected: mk:jira-issue
{"result":"mk:jira-issue","model":"claude-opus-5-5","is_error":false,"subtype":"success"}
=== j14-jira-bulk-label-sweep
started_utc: 2026-11-09T14:32:25Z
exit: 0
expected: mk:jira-bulk
{"result":"mk:jira-bulk","model":"claude-opus-5-5","is_error":false,"subtype":"success"}
=== j15-jira-sprint-backlog-points
started_utc: 2026-11-09T14:32:34Z
exit: 0
expected: mk:jira-agile
{"result":"mk:jira-agile","model":"claude-opus-5-5","is_error":false,"subtype":"success"}
=== j16-jira-vietnamese-worklog
started_utc: 2026-11-09T14:32:42Z
exit: 0
expected: mk:jira-time
{"result":"mk:jira-time","model":"claude-opus-5-5","is_error":false,"subtype":"success"}
=== j17-confluence-cql-space-search
started_utc: 2026-11-09T14:32:51Z
exit: 0
expected: mk:confluence-search
{"result":"mk:confluence-search","model":"claude-opus-5-5","is_error":false,"subtype":"success"}
=== j18-confluence-spec-gap-analysis
started_utc: 2026-11-09T14:32:59Z
exit: 0
expected: mk:confluence-spec-analyst
{"result":"mk:confluence-spec-analyst","model":"claude-opus-5-5","is_error":false,"subtype":"success"}
=== j19-confluence-label-one-page
started_utc: 2026-11-09T14:33:08Z
exit: 0
expected: mk:confluence-collaborate
{"result":"mk:confluence-collaborate","model":"claude-opus-5-5","is_error":false,"subtype":"success"}
```

**Pre-rewrite summary: 7 attempted, 7 exited 0, 7 selected the expected leaf — 7/7 PASS.**

One honest qualification on the numbers: these are **single** samples at temperature defaults, not
a repeated measurement, so a per-spec PASS is evidence the current metadata is *sufficient* for the
selection, not a stability estimate. The after-rewrite half uses the identical template and the
identical prompts, so the comparison is like-for-like even though neither half is a distribution.

## Post-rewrite results (after-state)

**Not yet recorded.** The integration-description rewrite has not landed at the time this half was
committed. This section is filled in by re-running `routing-probe.md` against the rewritten
metadata and recording the same seven verbatim outputs and per-spec verdicts, with the before/after
pair compared leaf-for-leaf.

No routing-correctness claim is made for the rewritten metadata anywhere in this sprint's output
until that re-run is recorded here.

## Ordering

The before-state above was produced and committed **before** any metadata edit. The commit
carrying this file and the new journey specs contains **no** `SKILL.md` or agent `description`
edit; the metadata rewrite lands in a strictly later, separate commit. Commit SHA of this record is
recorded in `evidence.md`.
