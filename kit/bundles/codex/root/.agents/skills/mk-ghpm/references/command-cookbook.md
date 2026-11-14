# GitHub Project Management Command Cookbook

## Issues

```bash
gh issue create --title "Login fails on Safari 17" --body-file issue-body.md --label "bug,priority:high" --assignee "@me" --milestone "v1.2"
gh issue list --state open --label bug --assignee "@me" --json number,title,labels,assignees,milestone
gh issue view 42 --json number,title,body,labels,comments
gh issue edit 42 --add-label priority:high --remove-label priority:low
gh issue close 42 --comment "Fixed in #99" && gh issue reopen 42
gh issue comment 42 --body "Confirmed on Safari 17.4"
```

## Projects v2

```bash
gh project create --owner myorg --title "Sprint 7"
gh project list --owner myorg
gh project item-add 3 --owner myorg --url https://github.com/myorg/repo/issues/42
gh project field-list 3 --owner myorg --format json
gh project item-list 3 --owner myorg --format json
gh project item-edit --id PVTI_... --field-id PVTF_... --project-id PVT_... --single-select-option-id OPT_...
```

The update command needs an item node ID, field node ID, project node ID, and current field option
ID. Extract them from `--format json` output rather than guessing.

## Labels

```bash
gh label create priority:high --color B60205 --description "Needs attention this sprint"
gh label list
gh label clone myorg/source-repo
gh label edit priority:high --color D93F0B
gh label delete wontfix --yes
```

## Milestones

```bash
gh api repos/{owner}/{repo}/milestones
gh api repos/myorg/myrepo/milestones --method POST --field title=v1.3 --field description="Q3 release" --field due_on=2026-09-30T00:00:00Z
gh api repos/myorg/myrepo/milestones/2 --method PATCH --field state=closed
gh api repos/myorg/myrepo/milestones/2 --method DELETE
```

## Handoff Status

Use `gh issue list --state open --milestone v1.3 --json number,title,assignees,labels,url` and
group the JSON by assignee. For stale work, request `updatedAt` as well and filter entries older
than the team’s inactivity threshold. Add `--limit 200` (up to 1000) for a complete sprint view.
