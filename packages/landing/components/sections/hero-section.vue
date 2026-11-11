<script setup lang="ts">
/* Section 1 — the centred hero. Copy is verbatim from the approved mockup. */
</script>

<template>
  <section class="hero" aria-labelledby="hero-h">
    <div class="mk-wrap hero__layout">
      <div class="hero__intro">
        <a class="mk-pill hero__badge" href="#questions">
          <span>MIT licensed</span>
          <span class="mk-dim">See what it adds to a repo</span>
        </a>

        <h1 id="hero-h" class="hero__title">Workflow toolkit for coding agents</h1>

        <p class="hero__blurb">
          MeowKit installs 129 skills, 42 agents and 27 hooks into Claude Code, Cursor and Codex.
          Every task runs seven phases and stops at two gates until you approve.
        </p>

        <div class="hero__ctas">
          <a class="mk-btn mk-btn--primary" href="#install">
            Install MeowKit
            <svg class="mk-btn__arrow" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </a>
          <a class="mk-btn mk-btn--secondary" href="https://docs.meowkit.dev/">Read the docs</a>
        </div>
      </div>

      <div
        class="hero__shelf"
        role="img"
        aria-label="A Claude Code session where MeowKit has written a plan and waits at Gate 1 for approval"
      >
        <SessionWindow />
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero {
  padding-block: var(--mk-hero-offset) 0;
  text-align: center;
}

.hero__intro {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--mk-space-md);
  max-width: 860px;
  margin-inline: auto;
}

.hero__badge { gap: var(--mk-space-xs); }

/* The headline is the page's one serif moment. `balance` keeps the two lines even
 * and `break-word` stops a long word from cutting off at 390px. */
.hero__title {
  max-width: 16ch;
  text-wrap: balance;
  overflow-wrap: break-word;
  hyphens: manual;
}

.hero__blurb {
  max-width: 54ch;
  font-size: var(--mk-text-lead);
  line-height: 1.5;
  color: var(--mk-ink);
}

.hero__ctas {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--mk-space-xs);
  margin-top: var(--mk-space-2xs);
}

/* The hero enters once on load: the copy rises line by line, the stage follows */
.hero__badge,
.hero__title,
.hero__blurb,
.hero__ctas,
.hero__shelf {
  animation: hero-enter 0.6s var(--mk-ease-out) calc(var(--d, 0) * 1ms) both;
}
.hero__title { --d: 90; }
.hero__blurb { --d: 180; }
.hero__ctas { --d: 260; }
.hero__shelf { --d: 340; }

@keyframes hero-enter {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: none; }
}

/* The band under the fold: flat haze, the dark window inset into it.
 * The foot padding keeps the window off the line where the ground changes. */
.hero__shelf {
  margin-top: var(--mk-space-xl);
  padding: var(--mk-space-lg) var(--mk-space-md);
  border-radius: var(--mk-radius-card) var(--mk-radius-card) 0 0;
  background: var(--mk-haze);
}
.hero__shelf > :deep(.win) { max-width: 880px; margin-inline: auto; }

@media (min-width: 640px) {
  .hero__shelf { padding-inline: var(--mk-space-xl); }
}

/* At 390 and below the headline must still fit two lines without a cut glyph:
 * drop one step off the clamp floor and let it wrap at any point. */
@media (max-width: 420px) {
  .hero__title { font-size: clamp(1.75rem, 8.2vw, 2.125rem); max-width: 100%; }
  .hero__blurb { font-size: var(--mk-text-base); }
  .hero__shelf { padding: var(--mk-space-md) var(--mk-space-xs); }
}

/* Under 360px the pill's second clause wraps to a ragged two-line chip; the
 * badge keeps its label and its link, the hint goes. */
@media (max-width: 359px) {
  .hero__ctas .mk-btn { width: 100%; }
  .hero__badge .mk-dim { display: none; }
}
</style>
