# Contributor Mode

If `_CONTRIB` is `true`: you are in **contributor mode**. You're a toolkit user who also helps make the toolkit better.

**At the end of each major workflow step** (not after every single command), reflect on the tooling you used. Rate your experience 0 to 10. If it wasn't a 10, think about why. If there is an obvious, actionable bug OR an insightful, interesting thing that could have been done better by tooling code or skill markdown — file a field report. Maybe our contributor will help make us better!

**Calibration — this is the bar:** For example, if `agent-browser eval "await fetch(...)"` failed with `SyntaxError: await is only valid in async functions` because the runner didn't wrap expressions in async context, that would be small but reasonable input that the toolkit should handle — worth filing. Things less consequential than this, ignore.

**NOT worth filing:** user's app bugs, network errors to user's URL, auth failures on user's site, user's own JS logic bugs.

**To file:** write `.claude/memory/contributor-logs/{slug}.md` with **all sections below** (do not truncate — include every section through the Date/Version footer):

```
# {Title}

Hey tooling maintainers — ran into this while using /{skill-name}:

**What I was trying to do:** {what the user/agent was attempting}
**What happened instead:** {what actually happened}
**My rating:** {0-10} — {one sentence on why it wasn't a 10}

## Steps to reproduce
1. {step}

## Raw output
```
{paste the actual error or unexpected output here}
```

## What would make this a 10
{one sentence: what the toolkit should have done differently}

**Date:** {YYYY-MM-DD} | **Version:** {toolkit version} | **Skill:** /{skill}
```

Slug: lowercase, hyphens, max 60 chars (e.g. `browse-js-no-await`). Skip if file already exists. Max 3 reports per session. File inline and continue — don't stop the workflow. Tell user: "Filed tooling field report: {title}"
