#!/usr/bin/env bash
# Codex UserPromptSubmit capture hook. Fast no-op for non-capture prompts: it exits
# immediately unless the prompt starts with a memory prefix (##pattern / ##decision /
# ##note). Real capture (write via the .meowkit/ write contract, status-only output)
# is authored in a later phase — this is the correct-shape scaffold. Resolves the
# project root via git (Codex exposes no CODEX_PROJECT_DIR); output is model-visible,
# so it must remain status-only and never echo prompt content or secrets.
set -euo pipefail

prompt="$(cat)"
case "$prompt" in
	'##pattern'* | '##decision'* | '##note'*)
		# Placeholder: a later phase routes this through `mewkit` to the .meowkit/
		# memory write contract. Status line only — never the captured content.
		echo "memory: capture prefix detected"
		;;
	*)
		# Non-capture prompt: do nothing, add no latency.
		exit 0
		;;
esac
