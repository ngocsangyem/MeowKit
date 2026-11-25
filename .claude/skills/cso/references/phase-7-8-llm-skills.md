# Phase 7: LLM & AI Security

Check for AI/LLM-specific vulnerabilities. This is a new attack class.

Use Grep to search for these patterns:
- **Prompt injection vectors:** User input flowing into system prompts or tool schemas — look for string interpolation near system prompt construction
- **Unsanitized LLM output:** `dangerouslySetInnerHTML`, `v-html`, `innerHTML`, `.html()`, `raw()` rendering LLM responses
- **Tool/function calling without validation:** `tool_choice`, `function_call`, `tools=`, `functions=`
- **AI API keys in code (not env vars):** `sk-` patterns, hardcoded API key assignments
- **Eval/exec of LLM output:** `eval()`, `exec()`, `Function()`, `new Function` processing AI responses

**Key checks (beyond grep):**
- Trace user content flow — does it enter system prompts or tool schemas?
- RAG poisoning: can external documents influence AI behavior via retrieval?
- Tool calling permissions: are LLM tool calls validated before execution?
- Output sanitization: is LLM output treated as trusted (rendered as HTML, executed as code)?
- Cost/resource attacks: can a user trigger unbounded LLM calls?

**Severity:** CRITICAL for user input in system prompts / unsanitized LLM output rendered as HTML / eval of LLM output. HIGH for missing tool call validation / exposed AI API keys. MEDIUM for unbounded LLM calls / RAG without input validation.

**FP rules:** User content in the user-message position of an AI conversation is NOT prompt injection (precedent #13). Only flag when user content enters system prompts, tool schemas, or function-calling contexts.

# Phase 8: Skill Supply Chain

Scan installed host-runtime skills for malicious patterns. Published skills have been found with security flaws and some with outright malicious code, so treat every installed skill as untrusted input.

**Tier 1 — repo-local (automatic):** Scan the repo's local skills directory for suspicious patterns:

```bash
ls -la .claude/skills/ 2>/dev/null
```

Use Grep to search all local skill SKILL.md files for suspicious patterns:
- `curl`, `wget`, `fetch`, `http`, `exfiltrat` (network exfiltration)
- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `env.`, `process.env` (credential access)
- `IGNORE PREVIOUS`, `system override`, `disregard`, `forget your instructions` (prompt injection)

A keyword grep finds only careless attacks. Also check, for skills and for every other file an agent loads or runs on its own (agent definitions, rules, hook scripts, `AGENTS.md`/`CLAUDE.md`, editor rule files, MCP config):

- **Hidden text:** zero-width and bidirectional-control characters, Unicode tag characters, and HTML comments carrying directives. `grep -rnP '[\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2060}-\x{2064}\x{E0000}-\x{E007F}]'` over those files; any hit outside a test fixture is a finding until explained.
- **Hooks:** every command a hook registration runs (agent settings files, `.husky/`, `.git/hooks`, `package.json` `prepare`). A hook runs with no prompt on each tool call or commit, so read what it spawns: unpinned `npx`/`uvx`, a download, a binary resolved from a project-writable directory placed first on `PATH`, or environment and credential files read and sent anywhere.
- **MCP servers:** each entry in `.mcp.json` and its per-tool equivalents. Flag a server launched with `npx -y <pkg>` or `uvx <pkg>` and no pinned version (it re-downloads on every start), a remote URL the team does not control, credentials placed in `args` or committed `env`, and a server granted a token broader than its tools need. A tool description is text the model reads as part of its instructions, so a server that changes its descriptions after approval, or whose descriptions tell the model to read files or call other tools, is a prompt-injection channel.
- **Three capabilities in one place:** an agent, skill or MCP server that reads untrusted content, can reach secrets, and can send data out or change state has everything an injected instruction needs. Report each such combination with the path the data would take.
- **Agent-driven installs:** places where the workflow lets the agent add a dependency or run a fetched script without a person seeing the name first.

**Tier 2 — global skills (requires permission):** Before scanning globally installed skills or user settings, ask the user:
"Phase 8 can scan your globally installed AI coding agent skills and hooks for malicious patterns. This reads files outside the repo. Want to include this?"
Options: A) Yes — scan global skills too  B) No — repo-local only

If approved, run the same Grep patterns on globally installed skill files and check hooks in user settings.

**Severity:** CRITICAL for credential exfiltration attempts / prompt injection or hidden directive text in a file an agent loads / a hook that downloads and runs code. HIGH for suspicious network calls / overly broad tool permissions / an unpinned MCP server or hook command / an untrusted-input + secrets + outbound combination. MEDIUM for skills from unverified sources without review.

**FP rules:** Kit's own skills are trusted (check if skill path resolves to a known repo). Skills that use `curl` for legitimate purposes (downloading tools, health checks) need context — only flag when the target URL is suspicious or when the command includes credential variables.
