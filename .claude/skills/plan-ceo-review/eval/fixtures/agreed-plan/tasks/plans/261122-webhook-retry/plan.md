---
title: Webhook retry
status: agreed
---

# Webhook retry

Goal: retry failed webhook deliveries so customers stop missing events.

## Scope

- Retry up to 3 times with exponential backoff.
- Log every attempt.

## Notes from the team

Keep the sender stateless; do not add a database.
