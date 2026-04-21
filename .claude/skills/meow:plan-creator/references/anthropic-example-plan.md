# RetroForge — Few-Shot Calibration Example

This is the **calibration reference** for product-level planning mode.

## Contents

- [Product Vision](#product-vision)
- [Target User](#target-user)
- [Features](#features)
  - [1. Prompt-to-Prototype Generator](#1-prompt-to-prototype-generator)
  - [2. Pixel-Art Sprite Synthesis](#2-pixel-art-sprite-synthesis)
  - [3. Chiptune Soundtrack Composer](#3-chiptune-soundtrack-composer)
  - [4. Live Code Inspector](#4-live-code-inspector)
  - [5. Remix Tree](#5-remix-tree)
  - [6. Nightly Marquee](#6-nightly-marquee)
  - [7. Cabinet Themes](#7-cabinet-themes)
  - [8. Local-First Saves](#8-local-first-saves)
  - [9. Spectator Mode](#9-spectator-mode)
  - [10. Daily Generation Budget](#10-daily-generation-budget)
- [Design Language](#design-language)
- [AI Integration Opportunities](#ai-integration-opportunities)
- [Out of Scope (v1)](#out-of-scope-v1)
- [Open Questions](#open-questions)
- [Success Criteria (Product-Level)](#success-criteria-product-level)
- [Handoff](#handoff)


It comes from the appendix of Anthropic's harness-design article (Prithvi Rajasekaran, Labs)
and demonstrates the ambition level, feature density, user-story specificity, and design-language
texture expected from `step-03a-product-spec.md`.

When in doubt, write at THIS level — not less.

---

## Product Vision

RetroForge is a browser-based generator and gallery for retro arcade games. Anyone can describe a game in plain English ("a top-down shooter set inside a CRT tube") and watch a playable prototype materialize in seconds — sprite art, music, controls, scoring, the works. Players remix each other's games, fork the source, and publish their builds to a shared marquee where the community votes nightly.

The point is not "AI makes games" — it is to recapture the late-80s arcade feeling where every screen was a small surprise and every cabinet had a personality.

## Target User

Hobbyists, design students, indie devs, and former arcade kids who want to make a game in an afternoon and share it like a mixtape — without learning Unity, signing up for an asset store, or writing a single line of shader code.

## Features

### 1. Prompt-to-Prototype Generator

**Description:** A single text box. The user describes a game in plain English; within ~30 seconds a playable prototype loads in the browser with art, audio, controls, and a working game loop.

**User Stories:**
- As a hobbyist, I want to type "a snake game played on a Möbius strip" and get a working prototype, so that I can iterate on a genuine idea instead of a Unity tutorial.
- As a design student, I want to remix the prompt and regenerate, so that I can explore variations in seconds.
- As a returning player, I want my last 10 prompts saved, so that I can pick up where I left off.

**Acceptance Criteria:**
- [ ] User submits a prompt and a playable game loads in < 60 seconds on a fresh session.
- [ ] Generated game runs at 60fps on a mid-range laptop.
- [ ] Regenerating with the same prompt produces a meaningfully different variant ≥80% of the time.

### 2. Pixel-Art Sprite Synthesis

**Description:** Sprites are generated in a consistent 16×16 or 32×32 retro pixel-art palette. Animations (idle, walk, attack) come pre-rigged.

**User Stories:**
- As a player, I want the generated sprites to feel hand-crafted, so that the game looks like a real arcade title and not AI slop.
- As a designer, I want to swap any sprite for one I drew, so that I can put my own art into the game.

**Acceptance Criteria:**
- [ ] Sprites use a fixed 32-color palette per game (not full RGB).
- [ ] Each character sprite has at least idle + walk + action animations.
- [ ] User can replace any sprite via drag-and-drop and the game reloads instantly.

### 3. Chiptune Soundtrack Composer

**Description:** Each game ships with a generated chiptune score (intro, gameplay loop, victory, defeat) using a synthesized SID-style sound chip.

**User Stories:**
- As a player, I want every game to have its own soundtrack, so that it feels finished from the first second.
- As a creator, I want to regenerate just the music without rebuilding the game, so that I can iterate on vibe.

**Acceptance Criteria:**
- [ ] Every generated game has a distinct ≥30s gameplay loop, intro stinger, and lose stinger.
- [ ] Music can be regenerated independently from sprites or code.
- [ ] Audio plays at consistent volume across games (no clipping, no whisper-quiet tracks).

### 4. Live Code Inspector

**Description:** A side panel shows the game's source code (a small DSL, not raw JS) and lets advanced users tweak it live, with hot reload.

**User Stories:**
- As an indie dev, I want to see the actual game code, so that I can learn what the AI generated and modify it.
- As a curious player, I want to read the code without having to install anything, so that the magic stays demystified.

**Acceptance Criteria:**
- [ ] Code panel toggles open/closed with a keystroke.
- [ ] Edits to the code are reflected in the running game within 2 seconds.
- [ ] Syntax errors are surfaced inline with a one-click revert.

### 5. Remix Tree

**Description:** Every published game has a public lineage. Anyone can "fork" it, change anything, and publish their version. The fork tree is visualized as a branching diagram.

**User Stories:**
- As a player, I want to see who remixed my game and what they changed, so that I feel part of a community.
- As a designer, I want to fork a popular game and add a single weird mechanic, so that I can riff on something already loved.

**Acceptance Criteria:**
- [ ] Each game shows its parent (if any) and all its children.
- [ ] Forking a game opens it in the editor with one click, no permission step.
- [ ] The remix tree is browsable visually as a graph, not just a list.

### 6. Nightly Marquee

**Description:** A community-voted top-10 board updated every night. The community submits games during the day; votes happen via simple thumbs.

**User Stories:**
- As a creator, I want a chance for my game to be seen on the marquee, so that I have a reason to publish my best work.
- As a player, I want a curated daily list, so that I always have something fresh to try without endless scrolling.

**Acceptance Criteria:**
- [ ] Top 10 refreshes daily at a fixed time.
- [ ] Voting requires no signup beyond a one-time alias.
- [ ] Marquee shows a thumbnail, title, creator alias, and live play button.

### 7. Cabinet Themes

**Description:** Each game gets a "cabinet" — the visual frame around the playfield. Cabinets are themed (chrome 80s, neon 90s, dive-bar wood) and chosen by the player or the AI.

**User Stories:**
- As a player, I want my game to feel like it lives in a physical cabinet, so that the retro fantasy is complete.
- As a creator, I want to pick a cabinet that matches my game's vibe, so that art direction is end-to-end.

**Acceptance Criteria:**
- [ ] At least 6 cabinet themes ship at launch.
- [ ] Cabinet selection is one click and instantly previews.
- [ ] Cabinet theme is saved with the game and travels through forks.

### 8. Local-First Saves

**Description:** Drafts are saved in the browser. No account required. Optional cloud sync via magic link.

**User Stories:**
- As a casual user, I want to start making a game without signing up, so that I can try it on a whim.
- As a returning user, I want my drafts on a new device, so that my work follows me.

**Acceptance Criteria:**
- [ ] First-time user can create and save a game with zero authentication.
- [ ] Optional sign-in via magic link enables cross-device sync.
- [ ] No data is lost when switching from anonymous to signed-in.

### 9. Spectator Mode

**Description:** Live view of someone else playing your game, with their inputs visible. Useful for streaming and feedback.

**User Stories:**
- As a creator, I want to watch a stranger play my game, so that I can see where they get stuck.
- As a streamer, I want a clean spectator URL, so that I can show my audience what I'm doing.

**Acceptance Criteria:**
- [ ] Each game has a shareable spectator URL.
- [ ] Spectator view shows live inputs and score.
- [ ] No login required for spectators.

### 10. Daily Generation Budget

**Description:** Each user gets a generous daily generation budget (e.g., 20 games/day) to keep costs sane. Budget resets at midnight UTC.

**User Stories:**
- As a hobbyist, I want enough generations to actually iterate, so that I'm not constantly rationing.
- As an operator, I want a clear budget so that runaway users don't blow up the bill.

**Acceptance Criteria:**
- [ ] User sees their remaining budget in the header.
- [ ] Budget resets visibly at midnight UTC.
- [ ] Hitting the limit shows a friendly message with the reset time.

<!-- Real plans should reach 12-20 features. The above 10 are illustrative — see Anthropic article appendix for the full RetroForge example. -->

## Design Language

**Tone:** Joyful, nostalgic, slightly chaotic. Arcade-cabinet maximalism meets editorial minimalism.

**Palette direction:** Deep midnight base (#0A0A1A range) with neon accent pairs (hot magenta + cyan, sodium-orange + electric blue). Pixel-art content uses fixed 32-color palettes per game.

**Typography direction:** A pixelated display face for titles ("PRESS START 2P" energy), a clean humanist sans for UI body, monospace for the code panel.

**Motion:** CRT scanline shimmer on the cabinet frame. Subtle screen-shake on hits. No motion on UI body — only on the playfield.

**Inspiration:** itch.io's homepage energy, Pico-8's aesthetic discipline, Flash-era Newgrounds chaos, the Sega Genesis CRT look.

## AI Integration Opportunities

- **Game generation pipeline.** A multi-pass LLM/diffusion pipeline produces the DSL, sprites, music, and prose flavor text from a single prompt.
- **"Make it weirder" button.** One-click semantic mutation of the current game (swap genre, invert controls, change palette).
- **Auto-balance pass.** After generation, an LLM evaluates difficulty by simulating play and tunes enemy counts / score thresholds.
- **Prose flavor text.** Generated games ship with a marquee blurb, an "instructions card," and a fake arcade-flyer poster.

## Out of Scope (v1)

- **Multiplayer netcode.** Real-time multiplayer is a v2 feature; spectator mode is the v1 substitute.
- **Mobile-first input.** v1 targets keyboard/mouse on desktop browsers. Mobile is "playable, not optimized."
- **In-game purchases.** No monetization on v1; the daily budget is the only constraint.
- **Custom asset upload at scale.** v1 supports drag-and-drop sprite swap only — no full asset library.

## Open Questions

1. Should the DSL be human-readable (lua-like) or compiled JS? Affects the Live Code Inspector experience.
2. How do we handle LLM cost variance per prompt? Flat budget, or weighted by complexity?
3. What's the moderation story for the Nightly Marquee? Community flagging vs. automated filter vs. both?

## Success Criteria (Product-Level)

- [ ] A first-time visitor can type a prompt and play a generated game in < 90 seconds.
- [ ] ≥10 features from above are live and pass their per-feature ACs.
- [ ] Nightly marquee runs daily for 7 consecutive days without manual intervention.
- [ ] Generated games are visually consistent enough that screenshots from 5 random games look like they belong to the same product.

## Handoff

After Gate 1, hand off to `meow:harness`. It negotiates a sprint contract with the generator and runs the generator ⇄ evaluator loop until rubric scores pass.