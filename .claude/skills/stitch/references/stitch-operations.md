Fail-closed key and `tsx` checks are in `SKILL.md`; run them before any API call.

Generate accepts `--project`, `--project-name`, `--device mobile|desktop|tablet`, and
`--variants <count>`. Export accepts `--project` and `--format html|image|all`. Quota accepts
`check`, `increment`, and `reset`.

`stitch-api-call.ts` validates untrusted prompts, reads the API key, and emits JSON only.
`stitch-write-output.ts` validates that JSON and allowlisted HTTPS/Google CDN URLs before writing;
it never reads `STITCH_API_KEY`. Keep these commands as separate stages so no process combines
untrusted prompt input, the secret, and file writes.

Files land in `tasks/designs/<plan-or-repo>/<screen-id>/` as `design.html`, `design.png`, and
`DESIGN.md`; the directory uses the newest plan slug, then repo name, then CWD basename. Handoff:
`Implement from tasks/designs/<plan-or-repo>/<screen-id>/DESIGN.md`. Its layout, components,
colors, typography, and spacing take precedence over verbal descriptions.
