# Issue Templates — Bug, Story, Epic, Task

Use these as the canonical field sets when creating issues. Fields marked REQUIRED must be provided. Optional fields improve discoverability and planning.

---

## Bug

**Purpose:** Report a defect where actual behavior differs from expected.

```
Summary (REQUIRED):   [Component] Short description of the broken behavior
                      e.g. "Login button unresponsive on mobile Safari 17"

Description:
  **Environment**
  - OS / Browser / App version:
  - User account type (if relevant):

  **Steps to Reproduce**
  1. Step one
  2. Step two
  3. Step three

  **Expected Behavior**
  What should happen.

  **Actual Behavior**
  What actually happens. Include error messages verbatim.

  **Attachments**
  Screenshots, logs, screen recordings if available.

Priority (REQUIRED):  Blocker | Critical | Major | Minor | Trivial
Components:           Affected component(s) — use project component list
Affected Version:     Version where the bug was found
Fix Version:          Target release for the fix (set during triage)
Assignee:             Leave unset during creation; set during triage
Labels:               bug, regression, customer-reported (as applicable)
```

**Validation before create:**
- Summary must describe the broken behavior, not just "bug in login"
- Priority must be set — default to Major if unknown
- Steps to reproduce must be present or ticket will be rejected at triage

---

## Story

**Purpose:** Describe a user-facing feature or capability in outcome terms.

```
Summary (REQUIRED):   User-facing description of the capability
                      e.g. "User can reset password via email"

Description:
  **User Story**
  As a [type of user],
  I want [some goal or feature],
  so that [business value or benefit].

  **Acceptance Criteria**
  - [ ] Criterion 1 (binary pass/fail)
  - [ ] Criterion 2
  - [ ] Criterion 3

  **Out of Scope**
  Explicitly list what this story does NOT cover.

Story Points:         1 | 2 | 3 | 5 | 8 | 13 (Fibonacci)
Priority:             High | Medium | Low
Epic Link:            Parent epic key (e.g. PROJ-42)
Sprint:               Target sprint (leave empty for backlog)
Assignee:             Developer responsible for implementation
Labels:               feature, technical-debt, ux (as applicable)
Components:           Affected component(s)
```

**Validation before create:**
- Acceptance criteria must be binary (testable pass/fail), not vague
- "As a / I want / so that" structure should be present or description equivalent
- Story Points should be estimated at sprint planning, not necessarily at creation

---

## Epic

**Purpose:** Group related stories under a larger business goal or theme.

```
Summary (REQUIRED):   High-level capability or initiative name
                      e.g. "Authentication & User Management"

Epic Name (REQUIRED): Short label (≤30 chars) shown on boards
                      e.g. "Auth & Users"

Description:
  **Goal**
  One paragraph describing what this epic achieves and why it matters.

  **Success Metrics**
  - Metric 1: measurable outcome
  - Metric 2: measurable outcome

  **Scope**
  What is and is not included in this epic.

Start Date:           ISO date — when work should begin (e.g. 2026-04-07)
Due Date:             ISO date — target completion
Priority:             High | Medium | Low
Assignee:             Epic owner (product or tech lead)
Labels:               initiative, q2-2026, team-platform (as applicable)
Fix Version:          Release this epic targets
```

**Validation before create:**
- Epic Name must be ≤30 chars (Jira board display constraint)
- Goal must describe outcome, not just list features
- Start/Due dates are optional but recommended for roadmap visibility

---

## Task

**Purpose:** Discrete unit of technical work not tied to a user-facing story. Infrastructure, maintenance, research spikes, tooling.

```
Summary (REQUIRED):   Action-oriented description of the work
                      e.g. "Upgrade PostgreSQL driver to v3.x"

Description:
  **What**
  What needs to be done. Be specific enough that any team member can pick this up.

  **Why**
  Reason for the task. Link to incident, decision, or dependency if applicable.

  **Done When**
  Clear completion condition (not a vague description of effort).

Priority:             High | Medium | Low
Assignee:             Person responsible
Story Points:         Optional — estimate effort if tracked for velocity
Sprint:               Target sprint or leave empty for backlog
Labels:               tech-debt, infra, research, ops (as applicable)
Components:           Affected component(s)
```

---

## Sub-task

**Purpose:** Break a story or task into parallel or sequential work units.

```
Summary (REQUIRED):   Specific sub-unit of the parent issue
Parent (REQUIRED):    Parent issue key (e.g. PROJ-123)
Assignee:             Can differ from parent — parallel work
Story Points:         Sub-task points do NOT roll up automatically in all Jira configs
```

**Note:** Sub-tasks should only be created when work within a story needs to be assigned to different people or tracked independently. Avoid sub-tasks for sequential steps that a single person handles.
