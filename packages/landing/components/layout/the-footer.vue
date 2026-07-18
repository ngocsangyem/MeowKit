<template>
  <footer class="foot" role="contentinfo">
    <div class="container-landing foot__inner">
      <!-- Statement: the page's closing line -->
      <p class="foot__line">
        Models provide intelligence. The harness provides discipline.
      </p>

      <div class="foot__meta">
        <TheLogo size="sm" />
        <nav class="foot__nav" aria-label="Footer navigation">
          <a href="https://docs.meowkit.dev/" class="foot__link" target="_blank" rel="noopener noreferrer">Docs</a>
          <a href="https://github.com/ngocsangyem/MeowKit" class="foot__link" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href="https://www.npmjs.com/package/mewkit" class="foot__link" target="_blank" rel="noopener noreferrer">npm</a>
        </nav>
        <span class="foot__license mono">MIT © {{ new Date().getFullYear() }}</span>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.foot {
  padding-block: var(--space-2xl) var(--space-xl);
}

.foot__inner {
  display: grid;
  gap: var(--space-xl);
}

.foot__line {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(1.5rem, 3.5vw + 0.5rem, 2.4414rem);
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--color-ink);
  max-width: 24ch;
  margin: 0;
  overflow-wrap: anywhere;
  min-width: 0;
}

.foot__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md) var(--space-lg);
  padding-block-start: var(--space-md);
  border-block-start: var(--rule-hair) solid var(--color-rule);
}

.foot__nav {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
}

.foot__link {
  font-size: var(--text-sm);
  color: var(--color-muted);
  text-decoration: none;
  white-space: nowrap;
  transition: color var(--dur-short) var(--ease-out);
}
.foot__link:hover { color: var(--color-ink); }

.foot__license {
  letter-spacing: 0.02em;
}
</style>
