# Agile DoD prompts (verdict has `jira_tickets`)

Load only when the review verdict's frontmatter lists `jira_tickets:` and its status is PASS or WARN. Each action is optional, cancel-safe and safe when Jira is offline. Record the answer in the verdict frontmatter as `true` or `deferred`.

1. **Verdict comment.** Ask: "Post the review verdict summary to PROJ-123 as a comment?" On yes, use `mk:jira-collaborate` (add comment) with the verdict's Summary and Risks. Sets `posted_to_jira`.
2. **Status transition.** Ask: "Transition PROJ-123 to Done?" On yes, use `mk:jira-lifecycle` (transition to Done). Sets `transitioned_to_done`.
3. **Business acceptance criteria.** Read the Jira AC field with `mk:jira-issue get`; if the read fails or the field is empty, use the `## Acceptance Criteria` section of the plan. Ask yes or no per item before the rest of the run continues.

Both posting and transitioning write to Jira, so they need the user's yes each time. If the user cancels, stop the ship run.
