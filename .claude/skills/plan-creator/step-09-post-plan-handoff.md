# Step 9: Post-Plan Handoff

Record the user's next step and print the one command that starts it. Done when `plan.md` frontmatter carries `handoff:` and the command line is printed. Then stop: never run the chosen command, because a fresh session picks the plan up without planning-context carryover.

## 9a. Risk re-scan

Search `plan.md` and every `phase-XX-*.md` for the literal words AUTH, AUTHZ, DATA_MODEL, AUDIT_SEC, EXT_SYSTEM (risk flags defined in `.claude/skills/agent-detector/references/risk-checklist.md`). A hit the task's original flags did not carry means the plan touches a risk surface the scope check missed: say that red-team review is recommended and order the options as if the flag were set. False positives are acceptable; the user chooses.

If the plan was started directly rather than through `mk:agent-detector` or `mk:cook`, there are no original flags; use the default ordering and say so in one line.

## 9b. Options

At most four, first one recommended.

| Mode | Risk hit | Options |
|---|---|---|
| fast | yes | Red-team, Validate, Cook, End |
| fast | no | Cook, Validate, Red-team, End |
| hard, deep, parallel, two, spike | n/a (red team and interview already ran, or the spike has none) | Cook, End |
| product-level | n/a | Hand off to `mk:autobuild`, End |

## 9c. Record and print

After the answer, add under the frontmatter of `plan.md` (an Edit anchored on the closing `---`, never overwriting the body):

```yaml
handoff:
  next: <cook | validate | red-team | autobuild | end>
  decided_at: <ISO-8601>
```

Print one line:

| Choice | Line |
|---|---|
| Cook | `Run: /mk:cook {absolute plan.md}`; add `--auto` for fast, `--parallel` for parallel mode, `--tdd` when `tdd_mode` (do not rely on a state file surviving a new session) |
| Validate | `Run: /mk:plan-creator validate {absolute plan.md}` |
| Red-team | `Run: /mk:plan-creator red-team {absolute plan.md}` |
| Autobuild | `Run: /mk:autobuild {absolute plan.md}` |
| End | `Plan complete. No next command queued.` |

Suggest `/clear` before running it. Then stop.
