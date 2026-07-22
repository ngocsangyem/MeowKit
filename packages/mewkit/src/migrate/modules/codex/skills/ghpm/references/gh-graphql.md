# GitHub Projects v2 — GraphQL Bulk Operations

## Contents

- [Project node ID](#get-project-node-id)
- [Bulk status updates](#bulk-update-item-status-via-graphql)
- [Bulk addition](#add-multiple-issues-to-a-project-in-a-loop)
- [Status counts](#get-project-item-count-by-status)

Use `gh api graphql` for batch updates that would require too many REST calls.

## Get project node ID

```bash
gh api graphql -f query='
query {
  organization(login: "myorg") {
    projectsV2(first: 10) {
      nodes { id title number }
    }
  }
}
'
```

## Bulk update item status via GraphQL

```bash
# Step 1: resolve field option IDs for the Status field
gh api graphql -f query='
query($proj: ID!) {
  node(id: $proj) {
    ... on ProjectV2 {
      fields(first: 20) {
        nodes {
          ... on ProjectV2SingleSelectField {
            id name
            options { id name }
          }
        }
      }
    }
  }
}
' -f proj="PVT_kwDO..."

# Step 2: update item status
gh api graphql -f query='
mutation($proj: ID!, $item: ID!, $field: ID!, $opt: String!) {
  updateProjectV2ItemFieldValue(input: {
    projectId: $proj
    itemId:    $item
    fieldId:   $field
    value:     { singleSelectOptionId: $opt }
  }) {
    projectV2Item { id }
  }
}
' -f proj="PVT_kwDO..." -f item="PVTI_lAHO..." \
  -f field="PVTF_..." -f opt="OPT_abc..."
```

## Add multiple issues to a project in a loop

```bash
PROJECT_NUMBER=3
OWNER=myorg
REPO=myrepo

# Get project node ID
PROJECT_ID=$(gh api graphql -f query='
query($owner:String!, $num:Int!) {
  organization(login: $owner) {
    projectV2(number: $num) { id }
  }
}
' -f owner="$OWNER" -f num="$PROJECT_NUMBER" --jq '.data.organization.projectV2.id')

# Add issues 10–20
for n in $(seq 10 20); do
  ISSUE_URL="https://github.com/$OWNER/$REPO/issues/$n"
  gh project item-add "$PROJECT_NUMBER" --owner "$OWNER" --url "$ISSUE_URL"
done
```

## Get project item count by status

```bash
gh api graphql -f query='
query($proj: ID!) {
  node(id: $proj) {
    ... on ProjectV2 {
      items(first: 100) {
        nodes {
          fieldValues(first: 10) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name field { ... on ProjectV2SingleSelectField { name } }
              }
            }
          }
        }
      }
    }
  }
}
' -f proj="PVT_kwDO..." | python3 -c "
import json, sys
from collections import Counter
data = json.load(sys.stdin)
items = data['data']['node']['items']['nodes']
statuses = []
for item in items:
    for fv in item['fieldValues']['nodes']:
        if fv.get('field', {}).get('name') == 'Status':
            statuses.append(fv.get('name', 'Unknown'))
for status, count in Counter(statuses).items():
    print(f'{status}: {count}')
"
```
