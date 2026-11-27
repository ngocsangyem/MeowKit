# Version, CHANGELOG and TODOS (`publish`)

Runs only when the user asked for `publish` in this run. Every write below is proposed first and applied after a yes.

## Version

Read the repo's `VERSION` file (or the version field the project uses) and keep its format: four-part, three-part, whatever is already there. Propose a level from the diff and say why:

- smallest digit: typos, config, tiny tweaks (roughly under 50 changed lines);
- next digit: bug fixes and small to medium features;
- minor or major: only the user chooses this, for significant features, milestones or breaking changes.

If the version already differs from the base on this branch (`git diff origin/<base>...HEAD -- <version file>` shows a change), it was bumped by an earlier run: say so and propose no second bump. Bumping a digit resets every digit to its right to 0. For `beta`, append `-beta.N`, where N follows the last tag matching `*-beta.*` (`git tag -l "*-beta.*"`). Write the version only after the user names or accepts one.

## CHANGELOG

Read the header to learn the format, then draft one entry covering every commit on the branch (`git log <base>..HEAD --oneline`, `git diff <base>...HEAD`). If entries already on the branch cover some of those commits, propose replacing them with one unified entry. Sections: Added, Changed, Fixed, Removed. Use the repo's date and heading format. Infer the content from the diff; do not ask the user to describe the changes. Never rewrite entries from earlier releases: they are the record.

## TODOS.md

Only if the repo keeps one. Mark an item complete when the diff clearly delivers it (commit messages match the title, referenced files appear in the diff, the described behaviour is there); when unsure, leave it. Completed items move under `## Completed` with `**Completed:** vX.Y.Z (YYYY-MM-DD)`. Report `N items marked complete, M remaining`. If the file is missing or disorganized, offer to create or reorganize it; do not do either unasked, and never delete items. A failed write to TODOS.md is a warning, not a stop.

## Issues

Creating or closing issues is an external write; list the intended actions, get a yes, and use `mk:ghpm`.
