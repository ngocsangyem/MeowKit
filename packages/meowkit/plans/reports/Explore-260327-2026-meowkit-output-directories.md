COMPREHENSIVE MAP OF MEOWKIT OUTPUT DIRECTORIES
================================================

Based on scan of /Users/sangnguyen/Desktop/compare-kit/meowkit/system/claude/

KEY FINDING: MeowKit uses multiple output directory hierarchies:
1. .claude/ — System-level directories (user's home/.claude/)
2. tasks/ — Project-level directories for plans and reviews
3. docs/ — Project documentation
4. Memory/state files scattered across both hierarchies

═══════════════════════════════════════════════════════════════════

DIRECTORY HIERARCHY: .claude/ (User Home Level)
================================================

.claude/agents/
  - Purpose: Agent definitions
  - What: Agent instruction files for all 13 agents (planner, developer, tester, etc.)
  - Referenced: skills/meow:agent-detector/references/after-detection.md
  - Ownership: read-only by agents; orchestrator routes to them
  - Naming: [agent-name].md + AGENTS_INDEX.md

.claude/skills/
  - Purpose: Skill implementations
  - What: 22 skills across 9 categories with SKILL.md frontmatter
  - Referenced: Multiple skill SKILL.md files define behavior
  - Ownership: Each skill owns its implementation
  
.claude/commands/
  - Purpose: Slash command definitions
  - What: 18 commands across 6 categories (meow/*)
  - Referenced: commands/meow/*.md files
  - Ownership: Each command routes to appropriate agent/skill

.claude/hooks/
  - Purpose: Lifecycle event handlers
  - What: 6 POSIX shell scripts
  - Files:
    * pre-task-check.sh — Runs before tasks (injection scan)
    * post-write.sh — Runs after file writes (security scan)
    * pre-implement.sh — Before implementation phase
    * pre-ship.sh — Before shipping (test/lint/typecheck)
    * post-session.sh — After session ends (memory capture)
    * cost-meter.sh — Track token usage
  - Create: .claude/memory/cost-log.json (via cost-meter.sh line 30-40)

.claude/modes/
  - Purpose: Behavioral mode configurations
  - What: 7 mode files (default, strict, fast, architect, audit, document, cost-saver)
  - Ownership: Read-only configuration files

.claude/rules/
  - Purpose: Enforced behavior rules
  - What: 10 rule files + RULES_INDEX.md
  - Files include: security-rules.md, injection-rules.md, gate-rules.md, etc.
  - Ownership: Read-only rules for all agents

.claude/memory/
  - Purpose: Cross-session persistence
  - What: Memory files updated at session end
  - Files CREATED:
    * lessons.md — Session learnings (appended each session)
    * patterns.json — Detected patterns + frequencies
    * cost-log.json — Token usage per task (JSON array)
    * decisions.md — Architecture decision log
    * security-log.md — Security findings archive
    * sessions/ — Session capture directory
    * cost-report/ — Cost reporting (if exported)
    * qa-reports/ — QA test results directory
    * projects/ceo-plans/ — CEO-mode plans archive
    * projects/ — Project-specific state
    * retros/ — Retrospective reports
    * security-reports/ — CSO security audit reports
  - Writers: post-session.sh, cost-meter.sh, various skills
  - Referenced:
    * skills/meow:agent-detector/references/detection-process.md:82-83
    * hooks/post-session.sh:5, 23, 32-34
    * hooks/cost-meter.sh:30-40

.claude/cache/
  - Purpose: Caching layer for performance
  - Files CREATED:
    * agent-detection-cache.json — Cache of agent detection results
  - Referenced: skills/meow:agent-detector/references/detection-process.md:7

.claude/scripts/
  - Purpose: Validation and utility scripts
  - What: 6 Python validation scripts
  - Files:
    * validate.py — Deterministic code validation (Phase 4)
    * security-scan.py — Security pattern detection
    * validate-docs.py — Documentation validation
    * cost-report.py — Cost report generation (writes to docs/cost-report.md)
    * injection-audit.py — Prompt injection detection
    * checklist.py — Checklist validation
    * bin/meowkit-review-log — Shell utility
  - Referenced: skills/meow:testing/references/validation-scripts.md

═══════════════════════════════════════════════════════════════════

DIRECTORY HIERARCHY: tasks/ (Project Level)
===========================================

tasks/plans/
  - Purpose: Feature and bug plans
  - What: YYMMDD-feature-name.md or YYMMDD-feature-name/ (directory for multi-phase)
  - Writers: planner agent exclusively
  - Ownership: planner agent owns all files in tasks/plans/
  - Naming: tasks/plans/YYMMDD-name.md or tasks/plans/YYMMDD-name/
  - Referenced:
    * agents/planner.md:21, 37, 50-51
    * skills/meow:plan-creator/SKILL.md:36, 51, 57-58
    * commands/meow/plan.md:38, 51, 59
    * rules/gate-rules.md:11
  - Status: Marked as "approved" at Gate 1 before implementation begins

tasks/templates/
  - Purpose: Plan templates
  - What: Re-usable plan templates (read-only reference)
  - Files:
    * plan-template.md — Standard features, multi-phase
    * plan-quick.md — Small tasks (< 5 files, < 2 hours)
    * plan-phase.md — Individual phase in multi-phase plan
  - Referenced: skills/meow:plan-creator/SKILL.md:26, 30, 34-35, 43

tasks/reviews/
  - Purpose: Review verdicts
  - What: YYMMDD-name-verdict.md files (Gate 2 approval)
  - Writers: reviewer agent exclusively
  - Ownership: reviewer agent owns all files in tasks/reviews/
  - Naming: tasks/reviews/YYMMDD-name-verdict.md
  - Sections: 5-dimension structural audit + security verdict
  - Referenced:
    * agents/reviewer.md:26, 42, 56
    * agents/shipper.md:37
    * commands/meow/review.md:29, 55, 65
    * commands/meow/ship.md:18
    * rules/gate-rules.md:32

═══════════════════════════════════════════════════════════════════

DIRECTORY HIERARCHY: docs/ (Project Level)
==========================================

docs/
  - Purpose: Project documentation
  - What: Human + AI readable docs, guides, specs
  - Owned by: documenter agent (EXCEPT docs/architecture/ and docs/journal/)
  - Referenced: agents/documenter.md:30, 43-44, 57

docs/architecture/
  - Purpose: Architecture Decision Records (ADRs)
  - What: NNNN-title.md files (zero-padded sequence numbers)
  - Writers: architect agent exclusively
  - Ownership: architect agent owns docs/architecture/ exclusively
  - Naming: docs/architecture/NNNN-title.md
  - Referenced:
    * agents/architect.md:18, 46, 58
    * rules/gate-rules.md notes these constrain design
    * commands/meow/arch.md:25, 32, 62

docs/journal/
  - Purpose: Session reflections and learnings
  - What: YYMMDD-title.md entries
  - Writers: journal-writer agent exclusively
  - Ownership: journal-writer agent owns docs/journal/ exclusively
  - Naming: docs/journal/YYMMDD-title.md
  - Referenced: agents/journal-writer.md:41, 106, 116-117

docs/rollback/
  - Purpose: Rollback plans for high-risk changes
  - What: [date]-[description].md for high-risk changes
  - Writers: shipper agent (during ship phase)
  - Referenced: skills/meow:shipping/references/rollback-protocol.md:7, 105

docs/retros/
  - Purpose: Sprint retrospectives
  - What: YYMMDD-retro.md files
  - Referenced: commands/meow/retro.md:55, 60

docs/adrs/
  - Purpose: ADR directory (alternative naming from docs/architecture/)
  - Referenced: commands/meow/arch.md:25, 62

docs/designs/
  - Purpose: Feature design specifications
  - What: {FEATURE}.md files (promoted CEO plans)
  - Writers: planner/documenter (copying from .claude/memory/projects/ceo-plans/)
  - Referenced: skills/meow:plan-ceo-review/references/post-review.md:170, 174

docs/changelog.md
  - Purpose: Version changelog
  - Writers: documenter agent (appends on /docs:sync)
  - Referenced: commands/meow/docs-sync.md:32

docs/api/
docs/api-reference.md
docs/components.md
docs/modules.md
docs/setup.md
docs/cost-report.md
  - Purpose: Various documentation files
  - Referenced: commands/meow/docs-sync.md:18-21
  - cost-report.md written by: scripts/cost-report.py:125

═══════════════════════════════════════════════════════════════════

SPECIFIC OUTPUT PATTERNS
========================

From hooks/post-session.sh
  - Creates: .claude/memory/lessons.md (appended each session)
  - Creates: .claude/memory/cost-log.json (initialized if missing)
  - mkdir -p ".claude/memory" (line 16)

From hooks/cost-meter.sh
  - Creates: .claude/memory/cost-log.json (appended with new entries)
  - mkdir -p ".claude/memory" (line 35)

From hooks/post-write.sh
  - No file creation (security scan only, outputs to stdout)

From scripts/cost-report.py
  - Creates: docs/cost-report.md
  - mkdir -p "docs" (line 127)

From scripts/validate.py
  - Creates: .claude/memory/validation-report (if report flag used)
  - mkdir -p ".claude/memory" (implicit from report_path logic)

From skill: meow:freeze
  - Creates: .claude/memory/ directories for state tracking
  - mkdir -p ".claude/memory" (line 38)
  - mkdir -p "$STATE_DIR" (line 63)

From skill: meow:qa
  - Creates: .claude/memory/qa-reports/screenshots/
  - mkdir -p ".claude/memory/qa-reports/screenshots" (line 235)
  - Outputs: .claude/memory/qa-reports/qa-report-{domain}-{YYYY-MM-DD}.md

From skill: meow:cso (Chief Security Officer)
  - Creates: .claude/memory/security-reports/{date}-{HHMMSS}.json
  - mkdir -p ".claude/memory/security-reports" (line 68)

From skill: meow:plan-ceo-review
  - Creates: .claude/memory/projects/ceo-plans/{date}-{feature-slug}.md
  - Creates: .claude/memory/projects/ceo-plans/archive/ (for stale plans)
  - mkdir -p ".claude/memory/projects/ceo-plans" (line 82)
  - mkdir -p ".claude/memory/projects/ceo-plans/archive" (line 88)

From skill: meow:ship
  - Creates: .claude/memory/sessions/ (session capture)
  - Creates: .claude/memory/projects/ (project state)
  - mkdir -p ".claude/memory/sessions" (line 8)
  - mkdir -p ".claude/memory/projects" (line 201)

From skill: meow:retro
  - Creates: .claude/memory/retros/
  - Creates: docs/retros/YYMMDD-retro.md
  - mkdir -p ".claude/memory/retros" (line 242)

From skill: meow:browse, meow:investigate, meow:review
  - Creates: .claude/memory/sessions/
  - mkdir -p ".claude/memory/sessions" (referenced in preambles)

From skill: meow:agent-browser
  - Creates: $OUTPUT_DIR (captured video/screenshots)
  - mkdir -p "$OUTPUT_DIR" (templates/capture-workflow.sh:20)
  - Outputs: recording files to .claude/memory/ or project directory

═══════════════════════════════════════════════════════════════════

MEMORY SUBDIRECTORIES (Detailed)
===============================

.claude/memory/
├── lessons.md                      # Appended at session end (post-session.sh)
├── patterns.json                   # Machine-readable patterns (agent-detector)
├── cost-log.json                   # JSON array of cost entries (cost-meter.sh)
├── decisions.md                    # Architecture decision log
├── security-log.md                 # Security findings archive
├── sessions/                       # Per-session capture (skills)
│   └── {SESSION_ID}.md            
├── cost-report/                    # Cost report exports (cost-report.py)
├── qa-reports/                     # QA test results (meow:qa)
│   ├── screenshots/               # QA screenshots
│   └── qa-report-{domain}-*.md   
├── projects/                       # Project-specific state (orchestrator)
│   ├── {PROJECT_SLUG}/            # Slug from meowkit-slug script
│   └── ceo-plans/                 # CEO review plans (meow:plan-ceo-review)
│       ├── {date}-{feature}.md   
│       └── archive/               # Stale plans archive
├── retros/                         # Sprint retrospectives (meow:retro)
│   └── {YYMMDD}-retro.md          
├── security-reports/              # Security audit reports (meow:cso)
│   └── {date}-{HHMMSS}.json       
└── [other skill state]             # Individual skills may create state here

═══════════════════════════════════════════════════════════════════

UNRESOLVED QUESTIONS
====================

1. Which directories are created by agents vs skills vs hooks?
   - .claude/memory/ created by: post-session.sh, cost-meter.sh, and various skills
   - tasks/ created by: planner (plans/), reviewer (reviews/)
   - docs/ created by: architect (architecture/), journal-writer (journal/), documenter (others)

2. Does ~/.claude/ have a backup/archive strategy?
   - memory/projects/ceo-plans/archive/ exists for stale plans
   - Other archives not documented in scanned files

3. Are there any automatic cleanup policies?
   - Not found in scanned files

4. Is memory/ exposed to version control?
   - Not documented; appears to be local-only (.gitignore likely)

5. Do different agents have different write permissions to directories?
   - Yes: exclusive ownership model defined in each agent's .md file
   - planner → tasks/plans/
   - reviewer → tasks/reviews/
   - architect → docs/architecture/
   - journal-writer → docs/journal/
   - documenter → docs/ (except architecture/ and journal/)

═══════════════════════════════════════════════════════════════════
