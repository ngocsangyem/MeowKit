# Bulk Op Safety Checklist

Optional pre-flight checklist. Use it when a Higher-Risk Trigger below applies; a small label or move needs only the dry-run.

## Contents

- [Pre-Bulk Checklist](#pre-bulk-checklist)
- [Higher-Risk Triggers](#higher-risk-triggers)
- [Post-Op Verification](#post-op-verification)

## Pre-Bulk Checklist

Walk through each item before running the dry-run:

- [ ] **CQL sanitized?** Every user-derived term passed through `cql-sanitize.sh`. No raw string concatenation.
- [ ] **`--max-pages` set?** Default 100. If higher, the user has explicitly authorized the higher cap.
- [ ] **CQL scoped?** Confirm the `space = ...` clause is intentional. A CQL without a space restriction can match every page in the tenant.
- [ ] **Reversibility understood?** Bulk delete moves pages to the trash; restore is manual in the Confluence UI. Bulk move is reversible by reverse move (label is reversible by remove).
- [ ] **Dry-run sample inspected?** Step 2 shows the first 5 page titles. They look right? If the sample contains a wrong space or unexpected page, STOP — refine CQL.
- [ ] **Affected count plausible?** If the dry-run reports an impacted count an order of magnitude larger than expected, the CQL is wrong. Refine before continuing.
- [ ] **Backup considered?** For irreversible-feeling ops (bulk delete, bulk move into archived space), confirm there is a recent space backup or that loss is acceptable.

## Higher-Risk Triggers

Any of these escalate the ceremony — the agent asks for extra context before proceeding:

- Operation matches > 500 pages
- CQL contains no space restriction
- Operation crosses spaces (move into a different space)
- Operation is `bulk delete`
- User invoking the op does not own the matched pages (per `creator` field)

When triggered, the agent surfaces the elevated risk before Step 2:

> "This operation matches {N} pages across {M} spaces. Please re-confirm the count to proceed."

## Post-Op Verification

After Step 3 execution returns:

- [ ] Affected count matches the dry-run preview (delta < 5%)
- [ ] First 5 / last 5 page IDs in output appear in the CQL search reflecting the change
- [ ] No partial-failure error in stdout / stderr (search for `partial`, `failed`, `incomplete`)
- [ ] If partial: capture completed-id list, prepare follow-up CQL with `id NOT IN (...)` for re-run
