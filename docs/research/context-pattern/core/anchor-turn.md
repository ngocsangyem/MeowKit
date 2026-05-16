# Anchor Turn

> Source: https://contextpatterns.com/patterns/anchor-turn/

Front-load all source reads into one turn so every subsequent turn works from cache.

[Anthropic: Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)

## The Problem This Solves

Agentic tasks run over many turns, and each turn the model may need to consult source material: research files, documentation, a specification. The naive approach reads files on demand, so when writing module 4 you read the patterns documentation and when writing module 7 you read the benchmarks file.

Every file read injects fresh tokens into that turn’s context, and fresh tokens are computed from scratch at full input price. They also break the cache prefix: providers hash the beginning of each request to find a cache hit, and inserting a large file mid-session means the hash no longer matches previous turns. Cost goes up. Cache utilisation goes down. Over a session that runs for an hour, it compounds.

## How It Works

Dedicate the first turn of the session to reading everything the task will need.

1.  **Read all source material in one turn:** Open every file, document, or reference the task will require. Do it upfront.
2.  **Write a structured summary:** Produce a consolidated reference document and write it to disk.
3.  **Never re-read a source file:** For all subsequent turns, draw on the conversation history and the summary. The summary is the canonical reference.
4.  **Use the summary as a cache anchor:** Because the summary enters the conversation history on turn 1, it becomes part of the cached prefix for every subsequent turn. The provider serves it from cache.

The net effect is that fresh token consumption drops to near zero for the rest of the session, and every turn after the anchor turn is cheap, fast, and working from the same stable context.

## Example

A session producing 8 course modules from research files.

**Without an anchor turn:** Each module turn reads 1-3 research files to cite specific data, injecting 5,000-15,000 fresh tokens per turn. Over 90 turns this compounds to 1.9 million fresh input tokens and 73% cache utilisation.

**With an anchor turn:** Turn 1 reads all 15 source files and writes a 900-word research notes file. Turns 2 through 160 draw from the cached conversation history; fresh input tokens for the entire remaining session: 191. Cache utilisation: 100%.

## When to Use

- Long agentic sessions (10+ turns) that need reference material throughout
- Tasks with a defined set of source documents known upfront
- Multi-phase work where different phases need the same underlying knowledge

## When Not to Use

- Short sessions where one or two file reads is the full scope
- Exploratory tasks where you don’t know upfront which sources matter (use [Progressive Disclosure](../progressive-disclosure.md) instead)
- When source material is too large for a single turn (split into topic clusters, each anchored separately)

## Related Patterns

- **[Write Outside the Window](write-outside.md)** is the mechanism for persisting the summary across sessions; Anchor Turn creates it within one
- **[Progressive Disclosure](../progressive-disclosure.md)** is the alternative for exploratory tasks: load details on demand rather than front-loading everything
- **[Compress & Restart](compress.md)** handles the other end: when context grows too large mid-session, compress and restart with the anchor turn’s summary as the foundation
- **[Select, Don’t Dump](select.md)** applies within the anchor turn itself: synthesise the source material, don’t paste it in raw
