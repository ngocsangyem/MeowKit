<template>
  <section class="cta" aria-labelledby="cta-heading">
    <div class="container-landing cta__inner">
      <h2 id="cta-heading" class="cta__heading">
        Ready to ship production-quality AI code?
      </h2>
      <p class="cta__sub">
        The harness is free, open-source, and works inside Claude Code today.
        No sign-up. No external dependencies. Just discipline.
      </p>
      <a href="#install" class="btn-fill cta__action">Install MeowKit</a>
    </div>
  </section>
</template>

<style scoped>
.cta {
  border-block-start: var(--rule-hair) solid var(--color-rule);
  padding-block: var(--space-3xl);
}

.cta__inner {
  display: grid;
  gap: var(--space-lg);
  justify-items: start;
}

.cta__heading {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: var(--text-display-s);
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--color-ink);
  max-width: 22ch;
  margin: 0;
  overflow-wrap: anywhere;
  min-width: 0;
}

.cta__sub {
  font-size: var(--text-md);
  color: var(--color-muted);
  line-height: 1.6;
  max-width: 50ch;
  margin: 0;
}

.cta__action {
  margin-block-start: var(--space-xs);
}
</style>
