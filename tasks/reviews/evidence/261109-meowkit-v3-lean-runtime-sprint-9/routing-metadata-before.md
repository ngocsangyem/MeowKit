# routing-metadata-before.txt

Verbatim copy, wrapped in markdown so this evidence commit carries no ship-capable path.

````text
- id: mk:confluence
  description: Routing skill — recommends the correct mk:confluence-* leaf for any Confluence Cloud task. Triggers: 'confluence', 'wiki page', 'spec page', ambiguous Confluence intent. NOT an executor — every actual operation forks via a leaf skill.
  when_to_use: Use when user has a Confluence intent but the specific leaf isn't clear. NOT for direct execution — forward to mk:confluence-{specific}.
- id: mk:confluence-bulk
  description: Bulk Confluence operations on 10+ pages via the confluence-as wrapper: bulk-label / bulk-move / bulk-delete. Dry-run is MANDATORY first. Triggers: 'bulk update N pages', 'mass label', 'delete all pages matching CQL', 'bulk-move pages to PARENT'. NOT for single-page ops (mk:confluence-page); NOT for comment/attachment ops (mk:confluence-collaborate).
  when_to_use: Use for any operation touching 10+ Confluence pages at once. Dry-run is MANDATORY first. NOT for single-page ops (use mk:confluence-page).
- id: mk:confluence-collaborate
  description: Manage Confluence collaboration surface via the confluence-as wrapper: comments, attachments, labels, watchers. Triggers: 'add comment to page 12345', 'upload attachment to page 12345', 'label page 12345 as urgent', 'watch page 12345'. Inline-vs-footer comment safety enforced. NOT for page CRUD (mk:confluence-page); NOT for bulk ops (mk:confluence-bulk).
  when_to_use: Use to add/list/update/delete comments, attachments, labels, or watchers on a single Confluence page. NOT for page field updates (use mk:confluence-page).
- id: mk:confluence-page
  description: Confluence page CRUD via the confluence-as wrapper. Triggers: 'create page in SPACE', 'show me page 12345', 'update title of page 12345', 'delete page 12345', 'page hierarchy under 12345', 'copy page 12345 to SPACE'. NOT for bulk ops on 10+ pages (mk:confluence-bulk); NOT for spec analysis (mk:confluence-spec-analyst); NOT for comments/attachments/labels (mk:confluence-collaborate).
  when_to_use: Use to create / read / update / delete a single Confluence page or blog post, or to inspect page hierarchy. NOT for bulk page ops (use mk:confluence-bulk); NOT for comments/attachments/labels (use mk:confluence-collaborate).
- id: mk:confluence-search
  description: Confluence CQL search + space list + saved-filter + export via the confluence-as wrapper. Triggers: 'search confluence', 'find pages where X', 'cql for ...', 'export search results', 'list spaces', 'manage saved filters'. CQL injection-safe via the shared sanitizer. NOT for single-page CRUD (mk:confluence-page); NOT for bulk write ops (mk:confluence-bulk).
  when_to_use: Use to find Confluence pages by CQL, validate CQL, build queries from natural language, list spaces, manage saved filters, or export results. NOT for single-page CRUD (use mk:confluence-page).
- id: mk:confluence-spec-analyst
  description: Deep spec analysis on a Confluence page. Reads page (+ children) via the confluence-as wrapper, produces a structured Spec Research Report with requirements, acceptance criteria, gaps, ambiguities, and suggested user stories for human review. Read-only — does NOT create Jira tickets. Triggers: 'analyze spec for PAGE-ID', 'extract requirements from confluence page', 'spec research on URL'. NOT for raw page CRUD (mk:confluence-page); NOT for ticket complexity scoring (mk:planning-engine).
  when_to_use: Use to extract structured requirements / acceptance criteria / gaps from a Confluence spec page. Output is a research report for human consumption — does NOT auto-create Jira tickets. NOT for raw page CRUD (use mk:confluence-page); NOT for sprint planning (use mk:planning-engine).
- id: mk:jira
  description: Routing skill — recommends the correct mk:jira-* leaf for any Jira task. Triggers: 'jira', 'jira ticket', ambiguous Jira intent. NOT an executor — every actual operation forks via a leaf skill.
  when_to_use: Use when user has a Jira intent but the specific leaf isn't clear. NOT for direct execution — forward to mk:jira-{specific}.
- id: mk:jira-admin
  description: JIRA project / user / group / scheme / automation administration via the jira-as wrapper (11 sub-domains, ~65 verbs). Triggers: 'create JIRA project', 'list users', 'delete user USERNAME', 'list permission schemes', 'create group NAME'. Requires admin role. Destructive ops (project/user/group delete) require 2-step token confirmation. NOT for per-issue ops (mk:jira-issue / mk:jira-lifecycle); NOT for JSM admin (mk:jira-jsm).
  when_to_use: Use for Jira admin tasks — projects, users, groups, schemes, automation. Requires admin role. Destructive ops need 2-step token confirmation.
- id: mk:jira-agile
  description: JIRA agile via the jira-as wrapper: epics, sprints, backlog, ranking, story points, subtasks, velocity. Triggers: 'create sprint', 'add KEY to sprint', 'set story points on KEY', 'rank KEY before KEY', 'velocity for board', 'epic add'. Board ID ≠ project key. NOT for issue CRUD (mk:jira-issue); NOT for time tracking (mk:jira-time).
  when_to_use: Use to manage epics, sprints, backlog, ranking, story-point estimates, subtasks, or velocity reports. NOT for individual issue CRUD.
- id: mk:jira-analyst
  description: Full Jira ticket context analysis via the jira-analyst agent — including media (attached images / PDFs / screenshots) and linked issues. Produces structured findings suitable for posting back as a Jira comment. Read-only. Triggers: 'analyze KEY', 'rca for KEY', 'describe KEY with media'. NOT for complexity scoring (mk:jira-evaluator); NOT for story-point estimation (mk:jira-estimator).
  when_to_use: Use when user wants full ticket context (description + comments + attachments + links + media analysis) consolidated into a structured report. Read-only — user reviews before posting back.
- id: mk:jira-bulk
  description: Bulk JIRA operations on 10+ issues via the jira-as wrapper: bulk transition / assign / set-priority / clone / delete. Dry-run is MANDATORY first. Triggers: 'bulk update N issues', 'mass transition', 'transition 50+ issues to Done', 'bulk-clone', 'bulk-delete'. NOT for single-issue ops (mk:jira-issue / mk:jira-lifecycle).
  when_to_use: Use for any operation touching 10+ Jira issues at once. Dry-run is MANDATORY first. NOT for individual issue ops.
- id: mk:jira-collaborate
  description: Manage JIRA collaboration surface via the jira-as wrapper: comments, attachments, watchers, notify. Triggers: 'comment on KEY', 'add attachment to KEY', 'watch KEY', 'notify KEY watchers'. Internal-vs-public comment safety enforced. NOT for issue CRUD (mk:jira-issue); NOT for issue links (mk:jira-relationships).
  when_to_use: Use to add/list/update/delete comments, attachments, or watchers on a Jira issue, or to send notifications. NOT for issue field updates.
- id: mk:jira-dev
  description: Generate developer artifacts from Jira tickets via the jira-as wrapper: branch names, PR descriptions, parsed commits, commit/PR-to-issue links. Triggers: 'branch name for KEY', 'PR description for KEY', 'parse commits for issue keys', 'link PR to KEY'. NOT for executing git/gh commands directly (mk:ship); NOT for issue CRUD (mk:jira-issue).
  when_to_use: Use to generate dev-side artifacts (branch names, PR bodies, commit parsing, smart-commit links) from a Jira issue. NOT for executing git operations.
- id: mk:jira-estimator
  description: Heuristic story-point estimation for a single Jira ticket via the jira-estimator agent. Read-only. Triggers: 'estimate KEY', 'story points for KEY', 'how complex is KEY'. NOT for complexity-only analysis (mk:jira-evaluator); NOT for full RCA (mk:jira-analyst).
  when_to_use: Use when user wants a heuristic story-point estimate for a single Jira ticket. Prior `mk:jira-evaluator` output enriches the estimate when present.
- id: mk:jira-evaluator
  description: Evaluate Jira ticket complexity + inconsistencies via the jira-evaluator agent. Read-only. Triggers: 'evaluate KEY', 'analyze ticket complexity for KEY', 'check ticket quality for KEY'. NOT for estimation (mk:jira-estimator); NOT for full RCA (mk:jira-analyst).
  when_to_use: Use when user wants complexity assessment + inconsistency check on a single ticket. NOT for execution; NOT for estimation only.
- id: mk:jira-fields
  description: JIRA custom field discovery + configuration via the jira-as wrapper. Triggers: 'field ID for X', 'list custom fields', 'check fields for project PROJ', 'configure agile fields for board'. Read ops are open; create/configure-agile require admin. NOT for setting per-issue field values (mk:jira-issue update).
  when_to_use: Use to discover field IDs / names / scope, check per-project field availability, or configure agile field mappings. NOT for setting individual field values on a ticket.
- id: mk:jira-issue
  description: JIRA issue CRUD via the jira-as wrapper. Triggers: 'create bug/task/story', 'show me PROJ-123', 'get/view/look up issue', 'update PROJ-123', 'delete PROJ-123'. NOT for transitions (mk:jira-lifecycle); NOT for comments/attachments (mk:jira-collaborate); NOT for bulk ops (mk:jira-bulk); NOT for issue links (mk:jira-relationships); NOT for time logging (mk:jira-time); NOT for sprint/epic (mk:jira-agile).
  when_to_use: Use to create / read / update / delete a single Jira issue. NOT for state transitions (use mk:jira-lifecycle).
- id: mk:jira-jsm
  description: JIRA Service Management via the jira-as wrapper: service desks, request types, requests, customers, organizations, queues, SLAs, approvals (8 sub-domains). Triggers: 'create JSM request', 'list service desks', 'SLA status for KEY', 'approve request KEY', 'list queue NAME'. Requires JSM-licensed tenant + agent role. NOT for core Jira issue ops (mk:jira-issue); NOT for project admin (mk:jira-admin).
  when_to_use: Use for any JIRA Service Management operation — service desks, requests, queues, SLAs, customers, organizations, approvals. Requires JSM license + agent role.
- id: mk:jira-lifecycle
  description: Drive JIRA workflow lifecycle via the jira-as wrapper: transition, assign, resolve, reopen, manage versions and components. Triggers: 'transition KEY to Status', 'mark KEY as Done', 'assign KEY to user', 'reopen KEY', 'release version', 'create component'. NOT for issue CRUD (mk:jira-issue); NOT for bulk transitions (mk:jira-bulk).
  when_to_use: Use to change a Jira issue's status, assignee, or resolution, or to manage project versions/components. NOT for bulk operations.
- id: mk:jira-ops
  description: JIRA-side cache + project-context discovery via the jira-as wrapper. Triggers: 'jira cache status', 'clear jira cache', 'discover project context for PROJ'. Diagnostic-only — no Atlassian state changes. NOT for issue CRUD; NOT for project admin (mk:jira-admin).
  when_to_use: Use to inspect / clear the jira-as local cache or discover project context (default issue types, mandatory fields). NOT for project admin (use mk:jira-admin).
- id: mk:jira-relationships
  description: Manage JIRA issue relationships via the jira-as wrapper: link, unlink, blockers, dependencies, clone, bulk-link. Triggers: 'link KEY blocks KEY', 'what blocks KEY', 'clone KEY', 'unlink KEY from KEY'. NOT for sprint/epic relationships (mk:jira-agile).
  when_to_use: Use to create / remove / inspect issue-to-issue links (blocks, depends on, clones, relates to). NOT for parent-subtask or epic-issue (mk:jira-agile).
- id: mk:jira-search
  description: JIRA search + filter management via the jira-as wrapper. Triggers: 'search jira', 'find issues where X', 'jql for ...', 'export search results', 'manage saved filters'. JQL injection-safe via the shared sanitizer. NOT for single-issue CRUD (mk:jira-issue); NOT for bulk write ops (mk:jira-bulk).
  when_to_use: Use to find Jira issues by JQL, validate JQL, build queries from natural language, manage saved filters, or export results. NOT for single-issue CRUD.
- id: mk:jira-time
  description: JIRA time tracking via the jira-as wrapper: log work, list/update/delete worklogs, set estimates, generate reports, bulk-log. Triggers: 'log 2h on KEY', 'show worklog for KEY', 'time report for sprint', 'bulk-log 30m to JQL'. Worklog edit/delete loses data — agent confirms. NOT for sprint capacity (mk:jira-agile).
  when_to_use: Use to log work / inspect worklogs / set estimates / pull time reports on Jira tickets. NOT for sprint capacity planning (mk:jira-agile).
- id: mk:story-sizer
  description: Pre-ticket Fibonacci sizing for a paste-mode batch of user stories. Default mode is advisory-only (writes a Story Sizing Report). Opt-in `--auto-create` delegates ticket creation to mk:jira-issue + mk:jira-collaborate with mandatory dry-run + single batch confirmation gate. NOT for single-ticket estimation (mk:jira-estimator); NOT for sprint capacity (mk:planning-engine).
  when_to_use: Use when sizing a batch of suggested user stories BEFORE Jira tickets exist (e.g., after a spec scan). Default emits a Story Sizing Report; --auto-create delegates ticket creation behind a single confirmation gate. NOT for sizing one Jira ticket (use mk:jira-estimator).
````
