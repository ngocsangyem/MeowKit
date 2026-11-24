# Time Fields and Estimate Adjustment

How Jira's time fields relate, and how a worklog changes the remaining estimate. For story points see `../../jira/references/estimation-guide.md`.

## Understanding JIRA Time Fields

JIRA uses three interconnected time tracking fields:

| Field | Purpose | When to Set | Auto-Updated |
|-------|---------|-------------|--------------|
| **Original Estimate** | Initial prediction of total effort | At issue creation or planning | No |
| **Remaining Estimate** | Time left to complete work | Updated as work progresses | Optional |
| **Time Spent** | Cumulative time logged via worklogs | When logging work | Yes |

**Relationship:**
```
Progress = Time Spent / Original Estimate
Projected Total = Time Spent + Remaining Estimate
Variance = Projected Total - Original Estimate
```

**Setting estimates:**
```bash
# Set original estimate
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh time estimate PROJ-123 --original "2d"

# Set remaining estimate
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh time estimate PROJ-123 --remaining "1d 4h"

# Set both together (recommended due to JRACLOUD-67539)
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh time estimate PROJ-123 --original "2d" --remaining "1d 4h"
```

## Estimate Adjustment Strategies

When logging time, control how JIRA updates the remaining estimate:

| Mode | Behavior | Use When | Command |
|------|----------|----------|---------|
| `auto` | Reduces remaining by time logged | Default for most workflows | `--adjust-estimate auto` |
| `leave` | Doesn't change remaining | Logging time outside issue scope | `--adjust-estimate leave` |
| `new` | Sets remaining to new value | Re-estimating after progress review | `--adjust-estimate new --new-estimate 4h` |
| `manual` | Reduces remaining by specified amount | Custom adjustment needed | `--adjust-estimate manual --reduce-by 1h` |

**Examples:**
```bash
# Auto-adjust (default) - logged 2h, remaining decreases by 2h
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh time log PROJ-123 --time 2h

# Leave unchanged - time logged but estimate stays same
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh time log PROJ-123 --time 2h --adjust-estimate leave

# Set new remaining estimate
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh time log PROJ-123 --time 2h \
  --adjust-estimate new --new-estimate 4h

# Reduce by specific amount
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh time log PROJ-123 --time 2h \
  --adjust-estimate manual --reduce-by 1h
```

**Known Issue (JRACLOUD-67539):** JIRA Cloud has a bug where estimates may not update correctly. Workaround:
```bash
# Set both estimates together
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh time estimate PROJ-123 --original "2d" --remaining "1d 4h"
```
