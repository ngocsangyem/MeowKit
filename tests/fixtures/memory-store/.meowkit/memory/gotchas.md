# Gotchas

## A lock published with open(wx) then write is not atomic   <!-- 2026-11-01 -->
Why: between the create and the write the lock file is readable and EMPTY. A waiter parsed
the empty pid as NaN, read NaN as "owner is dead", and reclaimed a live lock — so ten
concurrent appends landed three. Write the full content to a scratch name and `link` it into
place instead; `link` fails with EEXIST and never exposes a half-written lock.
Apply when: implementing or porting any advisory lock file.
Source: packages/mewkit/src/core/file-lock.ts

## An unbounded quantifier in a secret pattern is a CI stall   <!-- 2026-11-01 -->
Why: the email pattern backtracked quadratically on a long non-matching run, so a pasted
stack trace on one line took 7s at 64KB and minutes at 480KB — on a blocking per-PR step, and
inside the trace lock, which starved every other writer. Bound every quantifier and reject a
line over the byte cap before the regex runs.
Apply when: adding a pattern that scans user-pasted content.
Source: packages/mewkit/src/state/injection-scanner.ts

## A scan surface narrower than the read surface is not a guard   <!-- 2026-11-01 -->
Why: the lint filtered to top-level `*.md` while the documented read is
`grep -ril "<keywords>" .meowkit/memory/` — recursive and extension-blind. A `.txt` payload, a
nested `.md`, a base64 block inside the entry format's own HTML comment and a multi-line PEM
key all passed with exit 0 while every read-set skill still opened them.
Apply when: writing any content gate — derive its surface from the reader, not from a guess.
Source: packages/mewkit/src/core/check-memory-store.ts

## The config loader hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 1: the config loader returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md

## The retry queue hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 2: the retry queue returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md

## The session cache hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 3: the session cache returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md

## The CSV export hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 4: the CSV export returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md

## The webhook signer hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 5: the webhook signer returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md

## The rate limiter hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 6: the rate limiter returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md

## The date parser hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 7: the date parser returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md

## The image resizer hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 8: the image resizer returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md

## The search index hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 9: the search index returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md

## The audit logger hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 10: the audit logger returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md

## The feature flags hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 11: the feature flags returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md

## The email renderer hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 12: the email renderer returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md

## The PDF builder hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 13: the PDF builder returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md

## The locale fallback hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 14: the locale fallback returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md

## The upload chunker hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 15: the upload chunker returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md

## The token refresher hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 16: the token refresher returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md

## The job scheduler hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 17: the job scheduler returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md

## The metrics sink hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 18: the metrics sink returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md

## The diff viewer hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 19: the diff viewer returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md

## The schema migrator hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 20: the schema migrator returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md

## The pagination cursor hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 21: the pagination cursor returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md

## The password policy hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 22: the password policy returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md

## The theme loader hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 23: the theme loader returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md

## The report mailer hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 24: the report mailer returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md

## The notification fanout hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 25: the notification fanout returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md

## The billing proration hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 26: the billing proration returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md

## The geo lookup hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 27: the geo lookup returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md

## The slug generator hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 28: the slug generator returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md

## The backup rotator hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 29: the backup rotator returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md

## The health probe hides a second code path for empty input   <!-- 2026-11-01 -->
Why: fixture entry 30: the health probe returned early on an empty value and skipped the branch the tests covered, so a regression in that branch shipped twice.
Apply when: changing a module that special-cases empty input.
Source: tests/fixtures/memory-store/README.md
