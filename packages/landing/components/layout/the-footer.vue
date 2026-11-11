<script setup lang="ts">
/* Section 7b — the footer links. Shares the closing band's colour with
 * CtaSection, so no gap opens between the statement and the links. */
const columns = [
  { title: 'Product', links: [
    { label: 'Workflow', href: '/#workflow' },
    { label: 'Features', href: '/#features' },
  ] },
  { title: 'Start', links: [
    { label: 'Install', href: '/#install' },
    { label: 'Questions', href: '/#questions' },
  ] },
  { title: 'Docs', links: [
    { label: 'Quick start', href: 'https://docs.meowkit.dev/' },
    { label: 'Gate rules', href: 'https://docs.meowkit.dev/' },
  ] },
  { title: 'Source', links: [
    { label: 'GitHub', href: 'https://github.com/ngocsangyem/MeowKit' },
    { label: 'npm', href: 'https://www.npmjs.com/package/mewkit' },
  ] },
]

const year = new Date().getFullYear()
</script>

<template>
  <footer class="ft">
    <div class="mk-wrap">
      <div class="mk-grid ft__grid">
        <div class="mk-col-4 ft__brand">
          <TheLogo size="sm" />
          <p class="mk-small mk-dim">A workflow toolkit for coding agents.</p>
        </div>

        <div v-for="col in columns" :key="col.title" class="mk-col-2 ft__col">
          <h3 class="ft__title">{{ col.title }}</h3>
          <ul>
            <li v-for="l in col.links" :key="l.label">
              <a :href="l.href">{{ l.label }}</a>
            </li>
          </ul>
        </div>
      </div>

      <div class="ft__legal">
        <span>&copy; {{ year }} MeowKit &nbsp; MIT licence</span>
        <span>Product names and logos are trademarks of their owners</span>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.ft {
  padding-block: var(--mk-space-3xl) var(--mk-space-lg);
  background: var(--mk-surface);
}

.ft__grid { row-gap: var(--mk-space-xl); }

.ft__brand { display: grid; gap: var(--mk-space-xs); justify-items: start; }

.ft__title {
  font-family: var(--mk-font-sans);
  font-weight: 500;
  font-size: var(--mk-text-small);
  letter-spacing: 0;
  color: var(--mk-ink);
}
.ft__col ul { display: grid; gap: var(--mk-space-2xs); margin: var(--mk-space-xs) 0 0; padding: 0; list-style: none; }
.ft__col a {
  font-size: var(--mk-text-small);
  color: var(--mk-muted);
  text-decoration: none;
  transition: color var(--mk-dur-base) var(--mk-ease);
}
.ft__col a:hover { color: var(--mk-ink); }

.ft__legal {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--mk-space-xs);
  margin-top: var(--mk-space-2xl);
  padding-top: var(--mk-space-md);
  border-top: 1px solid var(--mk-line);
  font-size: var(--mk-text-micro);
  color: var(--mk-muted);
}

/* two columns of links on a phone rather than four 80px-wide ones */
@media (max-width: 899px) {
  .ft__col { grid-column: span 6; }
  .ft__brand { grid-column: 1 / -1; }
}
@media (min-width: 900px) {
  .ft__col { grid-column: span 2; }
}
</style>
