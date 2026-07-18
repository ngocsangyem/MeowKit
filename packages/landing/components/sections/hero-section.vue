<template>
  <section class="hero" aria-labelledby="hero-heading">
    <div class="hero-content container-landing hero__content">
      <!-- Marquee statement — left-biased, bottom-anchored -->
      <h1 id="hero-heading" class="hero__heading">
        Enforced discipline for AI&nbsp;coding agents.
      </h1>

      <p class="hero__sub">
        Hard gates, TDD, security scanning, and human approval — so your AI agent
        ships production-quality code, not untested prototypes.
      </p>

      <div class="hero__rule" aria-hidden="true" />

      <div class="hero__actions">
        <a href="#install" class="btn-fill">Install in one command</a>
        <a href="#how-it-works" class="btn-text">How it works <span aria-hidden="true">↓</span></a>
      </div>

      <p class="hero__meta mono" aria-label="Key stats">
        77&nbsp;skills&ensp;·&ensp;17&nbsp;agents&ensp;·&ensp;7&nbsp;phases&ensp;·&ensp;2&nbsp;gates&ensp;·&ensp;MIT
      </p>
    </div>
  </section>
</template>

<style scoped>
.hero {
  min-height: 82dvh;
  display: grid;
  align-content: end;
  padding-block: var(--space-3xl) var(--space-2xl);
}

.hero__content {
  display: grid;
  gap: var(--space-lg);
  justify-items: start;
  text-align: left;
}

.hero__heading {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: var(--text-display);
  line-height: 1.05;
  letter-spacing: -0.03em;
  color: var(--color-ink);
  max-width: 16ch;
  margin: 0;
  overflow-wrap: anywhere;
  min-width: 0;
}

.hero__sub {
  font-size: var(--text-md);
  color: var(--color-muted);
  line-height: 1.6;
  max-width: 54ch;
  margin: 0;
}

.hero__rule {
  width: 100%;
  border-block-start: var(--rule-hair) solid var(--color-rule);
  margin-block-start: var(--space-md);
}

.hero__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-lg);
}

.hero__meta {
  margin: 0;
  letter-spacing: 0.02em;
}
</style>
