<script setup lang="ts">
/* Section 7a — the closing statement. It opens the footer band: the band's
 * colour runs on into TheFooter, so the two read as one block with no seam. */
</script>

<template>
  <section class="closer" id="contact" aria-labelledby="close-h">
    <div class="mk-wrap">
      <div class="closer__row">
        <div class="closer__text">
          <h2 id="close-h">Put two gates in front of your agent</h2>
          <p class="mk-lead mk-dim">One command, two directories, MIT licensed.</p>
        </div>
        <a class="mk-btn mk-btn--primary" href="#install">
          Install MeowKit
          <svg class="mk-btn__arrow" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </a>
      </div>

      <p class="closer__wordmark" aria-hidden="true">MeowKit</p>
    </div>
  </section>
</template>

<style scoped>
.closer {
  padding-block: var(--mk-band-top) 0;
  background: var(--mk-surface);
  overflow-x: clip;
}

.closer__row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--mk-space-md);
}
.closer__text { display: grid; gap: var(--mk-space-sm); max-width: 640px; }
.closer__text h2 { max-width: 16ch; }

/* the wordmark: one line, sized off the viewport so it always fills the band
 * and never widens the page (its glyphs run to about 0.8 of its own width) */
.closer__wordmark {
  margin-top: var(--mk-space-3xl);
  font-family: var(--mk-font-display);
  font-weight: var(--mk-serif-weight);
  font-size: clamp(3.5rem, 19.5vw, 18rem);
  line-height: 0.9;
  letter-spacing: -0.03em;
  text-align: center;
  color: var(--mk-ink);
  white-space: nowrap;
}

@media (max-width: 639px) {
  .closer__wordmark { margin-top: var(--mk-space-xl); }
  .closer__row .mk-btn { width: 100%; }
}
</style>
