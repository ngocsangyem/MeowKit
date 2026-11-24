# Writing the narrative

Output goes to the conversation. The only files written are the JSON snapshot under `tasks/reports/retros/` and, when a lesson earned it, a memory entry.

Begin with a tweetable line, then cover what the data supports. Typical sections: a summary table, trends against the last retro, time and session patterns, shipping velocity, code quality signals, test health, focus and the biggest change. Include a section only when the data says something; a quiet week needs few of them.

## What the numbers mean

- Time and sessions: peak hours, whether sessions are getting longer or shorter, whether people code together or in shifts, late-night clusters.
- Velocity: the commit type mix; a fix share above 50% suggests ship fast, fix fast, which may point at review gaps. PR size buckets and what they say about cadence; chains of fix commits on one subsystem.
- Quality: test LOC ratio over time, hotspots (a file changed five or more times is churn), review signal.
- Test health: a test ratio under 20% is a growth area.

## Your section and the team

"You" is the person running the retro and gets the deepest treatment: commits, LOC, test ratio, peak hours, focus areas, the biggest change, what went well (two or three specific things anchored in commits) and where to level up (one or two actionable suggestions). Write it in the second person.

For each teammate, in commit order: two or three sentences on what they shipped, praise anchored in actual commits, and one growth suggestion framed as investment. Praise should read like something you would say in a one-to-one, specific and earned. Never compare teammates against each other negatively. A solo repo skips the team section.

Credit `Co-Authored-By` authors alongside the committer. AI co-authors (for example an address at `anthropic.com`) are reported as "N% of commits were AI-assisted", without judgment, and are not team members.

## Closing

End with the improvements that matter: specific, anchored in commits, phrased as how the team could get better, and each small enough to adopt. Count and word-length targets do not apply; the retro is as long as its data. Do not read project docs for retro content: the analysis is data-driven from git, plus the memory entries declared in SKILL.md.
