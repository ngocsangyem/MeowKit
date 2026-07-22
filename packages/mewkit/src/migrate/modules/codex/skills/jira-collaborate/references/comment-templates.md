# Collaboration Templates

Copy-paste ready templates for common collaboration scenarios.

---

## Comment Templates

### Progress Update

```markdown
## Update: [Brief title]

**Status:** On track | At risk | Blocked
**Progress:** [What is completed]
**Next steps:** [What comes next]
**Blockers:** [Any blockers]
```

### Blocker Escalation

```markdown
[BLOCKER] [Brief description]

**Blocked on:** [Dependency]
**Duration:** [How long]
**Impact:** [Consequences]
**Need:** [Specific help required]

@person [Call to action]
```

### Handoff

```markdown
@new-person Taking over from @old-person

**Status:** [Current state]
**Done:** [Completed items]
**Remaining:** [Work left]
**Context:** [Key info to review]

@old-person Please confirm handoff is complete.
```

### Decision Record

```markdown
## Decision: [What was decided]

**Participants:** [Who decided]
**Rationale:** [Why this choice]
**Alternatives considered:** [What we did not choose]
**Action items:** [Next steps]
```

### Question

```markdown
QUESTION: [Clear, specific question]

**Context:** [Why you are asking]
**Tried already:** [What you have attempted]
**Impact:** [Why it matters]
```

### Start of Work

```markdown
## Starting Work

**Focus:** [Specific aspect to tackle first]
**ETA:** [Expected completion timeframe]
**Dependencies:** [Any blockers or prerequisites]
```

---

## Script Command Templates

### Comments

```bash
# Plain text comment
bash the project environment/.agents/skills/jira/scripts/jira-as.sh collaborate comment add PROJ-123 --body "Comment text"

# Markdown comment
bash the project environment/.agents/skills/jira/scripts/jira-as.sh collaborate comment add PROJ-123 --body "**Bold** text" --format markdown

# Internal comment (Administrators only)
bash the project environment/.agents/skills/jira/scripts/jira-as.sh collaborate comment add PROJ-123 --body "Secret info" --visibility-role Administrators

# Group-restricted comment
bash the project environment/.agents/skills/jira/scripts/jira-as.sh collaborate comment add PROJ-123 --body "Team info" --visibility-group team-name
```

### Attachments

```bash
# Upload file
bash the project environment/.agents/skills/jira/scripts/jira-as.sh collaborate attachment upload PROJ-123 --file report.pdf

# List attachments
bash the project environment/.agents/skills/jira/scripts/jira-as.sh collaborate attachment download PROJ-123 --list

# Download by name
bash the project environment/.agents/skills/jira/scripts/jira-as.sh collaborate attachment download PROJ-123 --name "screenshot.png"

# Download all
bash the project environment/.agents/skills/jira/scripts/jira-as.sh collaborate attachment download PROJ-123 --all --output-dir ./downloads
```

### Watchers

```bash
# Add watcher
bash the project environment/.agents/skills/jira/scripts/jira-as.sh collaborate watcher PROJ-123 --add user@company.com

# Remove watcher
bash the project environment/.agents/skills/jira/scripts/jira-as.sh collaborate watcher PROJ-123 --remove user@company.com

# List watchers
bash the project environment/.agents/skills/jira/scripts/jira-as.sh collaborate watcher PROJ-123 --list
```

### Notifications

```bash
# Notify watchers
bash the project environment/.agents/skills/jira/scripts/jira-as.sh admin notification send PROJ-123 --watchers --subject "Update" --body "Text"

# Notify specific users (preview first)
bash the project environment/.agents/skills/jira/scripts/jira-as.sh admin notification send PROJ-123 --users accountId1 --dry-run

# Notify assignee and reporter
bash the project environment/.agents/skills/jira/scripts/jira-as.sh admin notification send PROJ-123 --assignee --reporter --subject "Status needed"
```

### Activity

```bash
# View activity table
bash the project environment/.agents/skills/jira/scripts/jira-as.sh collaborate activity PROJ-123 --format table

# Filter by status changes
bash the project environment/.agents/skills/jira/scripts/jira-as.sh collaborate activity PROJ-123 --filter status

# Export to JSON
bash the project environment/.agents/skills/jira/scripts/jira-as.sh collaborate activity PROJ-123 --format json > history.json
```

---

## File Naming Templates

**Format:** `[ProjectKey]_[Type]_[Description]_[Date].ext`

| Type | Example |
|------|---------|
| Screenshot | `PROJ-123_Screenshot_ErrorState_2025-12-28.png` |
| Logs | `PROJ-123_Logs_ProductionError_2025-12-28.txt` |
| Document | `PROJ-123_Design_Architecture_2025-12-28.pdf` |
| Test evidence | `PROJ-123_TestResult_UserFlow_2025-12-28.mp4` |

---

See [DEEP_DIVES/](DEEP_DIVES/) for detailed guidance on each topic.
