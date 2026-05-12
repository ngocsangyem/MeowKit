<template>
  <footer class="footer" role="contentinfo">
    <div class="container-landing footer__inner">
      <div class="footer__brand">
        <TheLogo size="sm" />
        <p class="footer__tagline">Built with MeowKit ✦</p>
      </div>

      <nav class="footer__nav" aria-label="Footer navigation">
        <a href="https://meowkit.dev/docs" class="footer__link" target="_blank" rel="noopener noreferrer">Docs</a>
        <a href="https://github.com/meowkit" class="footer__link" target="_blank" rel="noopener noreferrer">GitHub</a>
        <a href="https://www.npmjs.com/package/meowkit" class="footer__link" target="_blank" rel="noopener noreferrer">npm</a>
        <a href="https://meowkit.dev/changelog" class="footer__link" target="_blank" rel="noopener noreferrer">Changelog</a>
      </nav>

      <p class="footer__license">MIT License &bull; Open Source</p>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  border-top: 1px solid var(--color-border);
  padding: 2rem 1rem;
}

.footer__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  text-align: center;
}

@media (min-width: 640px) {
  .footer__inner {
    flex-direction: row;
    justify-content: space-between;
    text-align: left;
  }
}

.footer__brand {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.footer__tagline {
  font-size: 0.75rem;
  color: #94A3B8;
  margin: 0;
}

.footer__nav {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-wrap: wrap;
  justify-content: center;
}

.footer__link {
  font-size: 0.875rem;
  color: #94A3B8;
  text-decoration: none;
  transition: color 0.2s ease;
}
.footer__link:hover { color: #F8FAFC; }

.footer__license {
  font-size: 0.75rem;
  color: #94A3B8;
  margin: 0;
}
</style>
