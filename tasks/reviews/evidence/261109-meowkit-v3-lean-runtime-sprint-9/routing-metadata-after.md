# routing-metadata-after.txt

Verbatim copy, wrapped in markdown so this file carries no ship-capable path.
The post-rewrite metadata block fed to every after-state call (**5228 B** as rendered, 24 integration skills).

````text
- id: mk:confluence
  description: Confluence Cloud routing hub. Picks the mk:confluence-* leaf and forwards it. NOT an executor.
  when_to_use: Confluence or wiki work is wanted but the leaf is unclear; the hub body routes.
- id: mk:confluence-bulk
  description: mk:confluence leaf. 10+ pages at once - label, move, delete, dry-run first. NOT for mk:confluence-page.
  when_to_use: A Confluence change sweeping ten or more pages in one pass.
- id: mk:confluence-collaborate
  description: mk:confluence leaf. Comments, attachments, label CRUD, watchers on one page. NOT for mk:confluence-page.
  when_to_use: Comment on, attach to, or label a single Confluence page.
- id: mk:confluence-page
  description: mk:confluence leaf. Page and blog CRUD, copy, move, versions, hierarchy. NOT for mk:confluence-collaborate.
  when_to_use: Create, read, edit or delete one Confluence page, or walk its tree.
- id: mk:confluence-search
  description: mk:confluence leaf. CQL search, space listing, saved filters, export. NOT for mk:confluence-page.
  when_to_use: Find Confluence pages by CQL, space, label or author.
- id: mk:confluence-spec-analyst
  description: mk:confluence leaf. Spec report of requirements, acceptance criteria, gaps, stories. NOT for mk:confluence-page.
  when_to_use: Pull requirements or find missing acceptance criteria in a Confluence spec.
- id: mk:jira
  description: Jira routing hub. Picks the mk:jira-* leaf for a Jira intent and forwards it. NOT an executor.
  when_to_use: Jira work is wanted but the leaf is unclear; the hub body holds the routing table.
- id: mk:jira-admin
  description: mk:jira leaf. Project, user, group, scheme and automation administration. NOT for mk:jira-jsm.
  when_to_use: Create a Jira project, or manage users, groups and permission schemes.
- id: mk:jira-agile
  description: mk:jira leaf. Epics, sprints, backlog, ranking, story points, velocity. NOT for mk:jira-estimator.
  when_to_use: Move items between Jira sprints or backlog, or read sprint point totals.
- id: mk:jira-analyst
  description: mk:jira leaf. Read a ticket with comments, links and media, then report findings. NOT for mk:jira-evaluator.
  when_to_use: Want full context or an RCA on a Jira ticket, attachments included.
- id: mk:jira-bulk
  description: mk:jira leaf. 10+ issues at once - transition, assign, label, clone, delete, dry-run first. NOT for mk:jira-issue.
  when_to_use: A Jira change sweeping ten or more issues in one pass.
- id: mk:jira-collaborate
  description: mk:jira leaf. Comments, attachments, watchers, notifications. NOT for mk:jira-relationships.
  when_to_use: Comment on a Jira issue, attach a file, or manage its watchers.
- id: mk:jira-dev
  description: mk:jira leaf. Branch names, PR descriptions, commit parsing, smart-commit links. NOT for mk:ship.
  when_to_use: Derive a branch name or a PR body from a Jira ticket.
- id: mk:jira-estimator
  description: mk:jira leaf. Heuristic story-point estimate for one ticket, read-only. NOT for mk:story-sizer.
  when_to_use: Ask for story points on one Jira ticket that already exists.
- id: mk:jira-evaluator
  description: mk:jira leaf. Score one ticket for complexity and inconsistencies, read-only. NOT for mk:jira-estimator.
  when_to_use: Ask how complex or how self-contradictory a single Jira ticket is.
- id: mk:jira-fields
  description: mk:jira leaf. Custom field discovery - field IDs, project scope, agile field config. NOT for mk:jira-issue.
  when_to_use: Find a Jira custom field ID or check which fields a project exposes.
- id: mk:jira-issue
  description: mk:jira leaf. Single-issue CRUD - create, read, update fields, delete. NOT for mk:jira-bulk.
  when_to_use: One Jira issue by key - open it, edit its fields, or delete it.
- id: mk:jira-jsm
  description: mk:jira leaf. Service desks, requests, queues, SLAs, customers, approvals. NOT for mk:jira-admin.
  when_to_use: A Jira Service Management request, queue, SLA or approval.
- id: mk:jira-lifecycle
  description: mk:jira leaf. Transition, assign, resolve, reopen, versions, components. NOT for mk:jira-bulk.
  when_to_use: Change one Jira issue status or assignee, or release a version.
- id: mk:jira-ops
  description: mk:jira leaf. Cache status, cache clear, project-context discovery. NOT for mk:jira-admin.
  when_to_use: Inspect or clear the local Jira cache, or discover project defaults.
- id: mk:jira-relationships
  description: mk:jira leaf. Issue links, blockers, dependencies, clone, bulk-link. NOT for mk:jira-agile.
  when_to_use: Link two Jira issues, or ask what blocks a given issue.
- id: mk:jira-search
  description: mk:jira leaf. JQL search, query building, saved filters, result export. NOT for mk:jira-bulk.
  when_to_use: Find Jira issues matching criteria, or manage a saved JQL filter.
- id: mk:jira-time
  description: mk:jira leaf. Log work, list or edit worklogs, estimates, time reports. NOT for mk:jira-agile.
  when_to_use: Log hours against a Jira ticket or pull a worklog time report.
- id: mk:story-sizer
  description: mk:jira family. Fibonacci-sizes a pasted batch of stories before tickets exist. NOT for mk:jira-estimator.
  when_to_use: Size a batch of draft user stories that have no Jira tickets yet.
````
