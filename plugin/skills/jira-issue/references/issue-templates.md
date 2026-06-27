# Issue Templates — Bug, Story, Epic, Task

Use these as the canonical field sets when creating issues. Fields marked REQUIRED must be provided. Optional fields improve discoverability and planning.

## Contents

- [Bug](#bug)
- [Story](#story)
- [Epic](#epic)
- [Task](#task)
- [Sub-task](#sub-task)

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

## **Note:** Sub-tasks should only be created when work within a story needs to be assigned to different people or tracked independently. Avoid sub-tasks for sequential steps that a single person handles.

## Description Body Templates (markdown — paste into `--description`)

Use one of these as the body of the `--description` flag when creating an issue via the wrapper:

```bash
bash $CLAUDE_PROJECT_DIR/.claude/skills/jira/scripts/jira-as.sh issue create \
  --project PROJ --type Bug --summary "..." \
  --description "$(cat /tmp/desc.md)"
```

### Bug Report Template

Use this template for reporting defects, regressions, and unexpected behavior.

#### Template

```markdown
#### Summary

[Brief description of the bug]

#### Environment

- **Browser/Device:** Chrome 120 on Windows 11
- **Version:** 2.3.4
- **User Role:** Standard user

#### Steps to Reproduce

1. Navigate to login page
2. Enter valid credentials
3. Click "Login" button
4. Observe error message

#### Expected Behavior

User should be logged in and redirected to dashboard

#### Actual Behavior

Error message "Invalid credentials" appears even with correct password

#### Impact

- **Severity:** High - blocks user login
- **Frequency:** 100% reproducible
- **Users Affected:** All mobile users

#### Supporting Evidence

[Screenshots, error logs, network traces, video recordings]

#### Workaround (if available)

[Temporary solution or alternative approach]
```

#### Example

```markdown
#### Summary

Login fails with session timeout error on Safari mobile

#### Environment

- **Browser/Device:** Safari 17.2 on iOS 17.1, iPhone 14
- **Version:** v2.5.1 production
- **User Role:** Standard user

#### Steps to Reproduce

1. Open the app in Safari on iPhone
2. Enter valid username and password
3. Tap "Sign In" button
4. Wait for response

#### Expected Behavior

User is authenticated and redirected to the main dashboard within 3 seconds.

#### Actual Behavior

After 10 seconds, error message "Session Timeout: Please try again" appears.
The issue occurs consistently on Safari mobile but works on Safari desktop.

#### Impact

- **Severity:** Critical - prevents mobile user login
- **Frequency:** 100% reproducible on iOS Safari
- **Users Affected:** All iOS users (~35% of user base)

#### Supporting Evidence

- Console log attached showing 408 timeout from /api/auth/login
- Network trace shows request taking 12 seconds to fail
- Video recording: [link to video]

#### Workaround

Users can log in via Chrome on iOS, then switch back to Safari (session persists).
```

#### Severity Guide

| Severity | Definition                                       | Examples                                   |
| -------- | ------------------------------------------------ | ------------------------------------------ |
| Critical | System unusable, data loss, security issue       | Database corruption, authentication bypass |
| High     | Core feature broken, major impact, no workaround | Checkout fails, API completely down        |
| Medium   | Feature broken, workaround exists                | Filter not working, incorrect calculation  |
| Low      | Minor issue, cosmetic, minimal impact            | Alignment off, typo in message             |

#### Key Sections Explained

| Section             | Purpose                | Required     |
| ------------------- | ---------------------- | ------------ |
| Summary             | One-line description   | Yes          |
| Environment         | Where the bug occurs   | Yes          |
| Steps to Reproduce  | How to trigger the bug | Yes          |
| Expected Behavior   | What should happen     | Yes          |
| Actual Behavior     | What actually happens  | Yes          |
| Impact              | Severity and scope     | Yes          |
| Supporting Evidence | Proof of the bug       | Recommended  |
| Workaround          | Temporary solution     | If available |

### User Story Template

Use this template for user-facing features that deliver direct value.

#### Template

```markdown
#### User Story

As a [type of user]
I want [goal/desire]
So that [benefit/value]

#### Context

[Background information, business justification]

#### Acceptance Criteria

- [ ] Given [precondition], when [action], then [expected result]
- [ ] Given [precondition], when [action], then [expected result]
- [ ] Given [precondition], when [action], then [expected result]

#### UI/UX Notes

[Mockups, wireframes, design specifications]

#### Technical Considerations

[API requirements, data model changes, integrations]

#### Definition of Done

- [ ] Code implemented and reviewed
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] Documentation updated
- [ ] Deployed to staging and verified
```

#### Example

```markdown
#### User Story

As a registered user
I want to reset my password via email
So that I can regain access to my account when I forget my password

#### Context

Currently users must contact support for password resets, causing 2-day delays.
This feature will reduce support tickets by an estimated 40% and improve user satisfaction.

#### Acceptance Criteria

- [ ] Given I am on the login page, when I click "Forgot Password", then I see an email input form
- [ ] Given I enter a valid registered email, when I submit, then I receive a reset link within 2 minutes
- [ ] Given I click the reset link within 24 hours, when I enter a new valid password, then my password is updated
- [ ] Given I click an expired or used reset link, when I try to reset, then I see an error message with option to request new link
- [ ] Given I enter an unregistered email, when I submit, then I see a generic "check your email" message (no account enumeration)

#### UI/UX Notes

- See Figma mockup: [link]
- Password strength meter required
- Success message should include link back to login

#### Technical Considerations

- Reset tokens expire after 24 hours
- Token stored hashed in database
- Rate limit: 3 reset requests per hour per email
- Use existing email service for delivery

#### Definition of Done

- [ ] Code implemented and reviewed
- [ ] Unit tests for token generation/validation
- [ ] Integration tests for full reset flow
- [ ] Security review completed
- [ ] Documentation updated
- [ ] Deployed to staging and verified
```

#### Gherkin Format Reference

Acceptance criteria can use Gherkin syntax for precision:

```gherkin
Given [precondition or initial context]
When [action or event]
Then [expected outcome]
And [additional outcome]
```

#### Story vs Task Decision

| Use Story When            | Use Task When                |
| ------------------------- | ---------------------------- |
| User-facing functionality | Technical enabler work       |
| Customer sees the result  | Internal improvements        |
| Direct business value     | No visible user change       |
| "As a user, I want..."    | "Configure/Setup/Migrate..." |

#### INVEST Criteria

Good stories are:

- **I**ndependent - Can be developed separately
- **N**egotiable - Details can be discussed
- **V**aluable - Delivers user/business value
- **E**stimable - Team can size it
- **S**mall - Fits in one sprint
- **T**estable - Clear acceptance criteria

### Task Template

Use this template for technical work, infrastructure tasks, and internal improvements.

#### Template

```markdown
#### Objective

[What needs to be accomplished and why]

#### Requirements

- Requirement 1
- Requirement 2
- Requirement 3

#### Approach

[Proposed solution or implementation strategy]

#### Success Criteria

- [ ] Deliverable 1 completed
- [ ] Deliverable 2 completed
- [ ] Validation performed

#### Dependencies

[Other issues, external factors, or prerequisites]

#### Resources

[Documentation links, API references, design files]
```

#### Example

```markdown
#### Objective

Configure Redis caching for user session data to reduce database load and improve response times by 50%.

#### Requirements

- Redis instance must be configured with TLS encryption
- Session data expires after 24 hours of inactivity
- Failover to database if Redis unavailable
- Must support horizontal scaling (multiple app instances)

#### Approach

1. Provision Redis cluster in AWS ElastiCache
2. Add redis-py client to application dependencies
3. Implement SessionStore abstraction layer
4. Add circuit breaker for Redis connection failures
5. Update deployment configuration with Redis endpoints

#### Success Criteria

- [ ] Redis cluster provisioned and accessible from app servers
- [ ] Session read/write operations use Redis as primary store
- [ ] Failover to database works when Redis is unreachable
- [ ] Load test shows 50% reduction in database queries
- [ ] No session data loss during Redis restart

#### Dependencies

- PROJ-100: AWS permissions for ElastiCache provisioning
- VPC peering configuration (handled by DevOps)
- Redis 7.0+ required for new stream features

#### Resources

- AWS ElastiCache docs: https://docs.aws.amazon.com/elasticache/
- redis-py documentation: https://redis-py.readthedocs.io/
- Architecture diagram: [link to diagram]
```

#### Task Categories

| Category       | Description                        | Example                         |
| -------------- | ---------------------------------- | ------------------------------- |
| Infrastructure | Server, cloud, network setup       | "Provision staging environment" |
| Configuration  | Settings, parameters, env setup    | "Configure CI/CD pipeline"      |
| Refactoring    | Code improvements, no new features | "Extract payment module"        |
| Performance    | Optimization, caching, tuning      | "Add database indexes"          |
| Security       | Hardening, audits, fixes           | "Update dependencies for CVE"   |
| Documentation  | Technical docs, runbooks           | "Document API rate limits"      |
| Research/Spike | Investigation with time-box        | "Evaluate OAuth libraries"      |

#### Task vs Story

Tasks are appropriate when:

- Work is technical with no direct user visibility
- Outcome is infrastructure or tooling improvement
- Deliverable is internal capability
- Work enables future stories but isn't a story itself

#### Spike Tasks

For research or investigation tasks:

```markdown
#### Objective

Evaluate authentication libraries for potential migration from current solution.

#### Time-Box

Maximum 2 days of investigation

#### Questions to Answer

1. Which libraries support OAuth 2.1 and OpenID Connect?
2. What is the migration effort for each option?
3. Which has best community support and documentation?
4. What are the licensing implications?

#### Deliverables

- [ ] Comparison matrix of 3-5 libraries
- [ ] Proof of concept with top recommendation
- [ ] Migration risk assessment
- [ ] Recommendation document with rationale

#### Out of Scope

- Actual migration implementation
- Performance benchmarking
- Security audit
```

### Standard Description Template

Use this template for most issues when no specialized format is needed.

#### Template

```markdown
#### Problem/Goal

[What is the issue or what needs to be achieved? Be specific about the current state and desired state.]

#### Context

[Why is this important? What's the business value or impact? Who is affected?]

#### Acceptance Criteria

- [ ] Criterion 1: Specific, measurable outcome
- [ ] Criterion 2: Specific, measurable outcome
- [ ] Criterion 3: Specific, measurable outcome

#### Technical Notes (optional)

[Implementation hints, constraints, dependencies, or architectural considerations]

#### Additional Information (optional)

[Screenshots, logs, error messages, links to related documentation]
```

#### Example

```markdown
#### Problem/Goal

Users cannot export their monthly reports as PDF files. The export button is visible but produces no output when clicked.

#### Context

This is a frequently used feature by enterprise customers. Currently blocked users must manually screenshot or use third-party tools, causing workflow delays.

#### Acceptance Criteria

- [ ] PDF export button generates valid PDF document
- [ ] PDF includes all visible report data with correct formatting
- [ ] Export works for reports up to 1000 rows
- [ ] Loading indicator displays during generation

#### Technical Notes

Consider using existing PDF generation library (jsPDF) already included in dependencies. May need async generation for large reports.

#### Additional Information

Related to feature request PROJ-456. User feedback in support ticket #12345.
```

#### When to Use

- General tasks and features
- Issues that don't fit specialized templates
- Quick documentation of work items
- Internal technical tasks

#### Key Sections Explained

| Section                | Purpose                                 | Required |
| ---------------------- | --------------------------------------- | -------- |
| Problem/Goal           | Clear statement of what needs to change | Yes      |
| Context                | Business justification and impact       | Yes      |
| Acceptance Criteria    | How we know it's done                   | Yes      |
| Technical Notes        | Implementation guidance                 | Optional |
| Additional Information | Supporting materials                    | Optional |
