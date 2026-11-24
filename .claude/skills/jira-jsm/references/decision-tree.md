# JSM or core Jira

`mk:jira-jsm` covers what only Service Management has: service desks, request types, customers, organizations, queues, SLAs, approvals and the knowledge base. Core issue work on a JSM request goes to the core leaves.

| Task | Leaf |
|------|------|
| Create a request through a request type; JSM comment (customer-visible or `--internal`) | `mk:jira-jsm` |
| Queues, SLAs, approvals, customers, organizations, knowledge-base search | `mk:jira-jsm` |
| Read or edit fields (priority, assignee, labels) on a request's underlying issue | `mk:jira-issue` |
| Move a request through a standard workflow | `mk:jira-lifecycle` (use `jsm request transition` when the transition needs a customer-visible comment) |
| Plain comments, attachments, watchers | `mk:jira-collaborate` |
| Link a request to other issues | `mk:jira-relationships` |
| Create or configure service desks, request types, project admin | `mk:jira-admin` |
