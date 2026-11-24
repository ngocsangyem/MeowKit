# Workflow evidence index

Contract and shape table: `.claude/skills/advise/references/workflow-evidence-rules.md`. The index records pointers and summaries of one run. It never approves anything and carries no score. Standard and deep fixes write it; quick fixes keep their evidence in the response.

- **Path**: `.meowkit/state/evidence/<YYMMDD-HHMM-slug>/workflow-evidence.json`. A fix that escalated to a plan uses `tasks/plans/<plan>/reports/evidence/workflow-evidence.json`.
- **Write points**: after the proof (skill `mk:fix`, mode, task, planPath if any, phase, risk, fixDiagnosis); after verification (`verification.commands`, `verification.overall`); at finalize (`approvals.ship` as `required` or `not_applicable`, `memory.gotchaWritten`, `memory.decisionWritten`).
- **Check**: no tool validates the file, so compare it with the shape table before the commit prompt and fill any missing field.
- **Risk**: `risk.requiresHumanApproval` means asking the user explicitly before finalizing, in every mode.
- **Not memory**: the evidence file is one-run proof; `.meowkit/memory/gotchas.md` is the durable lesson store. Inside `mk:cook` its own phase writes the evidence, so do not write it twice.
- Store pointers and summaries only, never raw command logs, and scrub secrets, tokens and personal data.
