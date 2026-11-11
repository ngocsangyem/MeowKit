<script setup lang="ts">
const mobileOpen = ref(false)

const navLinks = [
  { label: 'Workflow', href: '#workflow' },
  { label: 'Features', href: '#features' },
  { label: 'Questions', href: '#questions' },
  { label: 'Install', href: '#install' },
]

const docsUrl = 'https://docs.meowkit.dev/'

function closeMobile() {
  mobileOpen.value = false
}

function handleNavClick(event: MouseEvent, href: string) {
  if (!href.startsWith('#')) return
  closeMobile()
  const target = document.querySelector<HTMLElement>(href)
  if (!target) return
  event.preventDefault()
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' })
  history.replaceState(null, '', href)
}
</script>

<template>
  <header class="topbar" :class="{ 'is-open': mobileOpen }" role="banner">
    <div class="mk-wrap topbar__row">
      <a class="mk-skip" href="#main-content">Skip to content</a>
      <TheLogo size="sm" class="topbar__brand" />

      <nav class="topbar__menu" aria-label="Main">
        <a
          v-for="link in navLinks"
          :key="link.href"
          class="topbar__item"
          :href="link.href"
          @click="handleNavClick($event, link.href)"
        >{{ link.label }}</a>
      </nav>

      <div class="topbar__actions">
        <a class="topbar__item topbar__item--docs" :href="docsUrl">Docs</a>
        <a class="mk-btn mk-btn--primary topbar__cta" href="#install" @click="handleNavClick($event, '#install')">
          Install MeowKit
        </a>
      </div>

      <button
        class="topbar__burger"
        type="button"
        :aria-expanded="mobileOpen"
        aria-controls="nav-sheet"
        aria-label="Menu"
        @click="mobileOpen = !mobileOpen"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path
            :d="mobileOpen ? 'M4 4l10 10M14 4L4 14' : 'M2 5h14M2 13h14'"
            stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"
          />
        </svg>
      </button>
    </div>

    <div v-show="mobileOpen" id="nav-sheet" class="topbar__drawer">
      <a
        v-for="link in navLinks"
        :key="link.href"
        class="topbar__drawer-link"
        :href="link.href"
        @click="handleNavClick($event, link.href)"
      >{{ link.label }}</a>
      <a class="topbar__drawer-link" :href="docsUrl" @click="closeMobile">Docs</a>
      <a class="mk-btn mk-btn--primary topbar__drawer-cta" href="#install" @click="handleNavClick($event, '#install')">
        Install MeowKit
      </a>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: var(--mk-z-bar);
  background: var(--mk-veil);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: var(--mk-hairline) solid var(--mk-line);
}

.topbar__row {
  display: flex;
  align-items: center;
  gap: var(--mk-space-sm);
  min-height: var(--mk-bar-height);
}

.topbar__brand { margin-inline-end: auto; }

.topbar__menu,
.topbar__actions { display: none; }

.topbar__item {
  font-size: var(--mk-text-base);
  color: var(--mk-ink);
  text-decoration: none;
  white-space: nowrap;
  transition: color var(--mk-dur-base) var(--mk-ease);
}
.topbar__item:hover { color: var(--mk-accent); }

.topbar__burger {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 44px;
  height: 44px;
  /* no negative inline margin: the button must end on the container's right
   * line, not 10px past it */
  margin-inline-end: 0;
  border: 0;
  border-radius: var(--mk-radius-chip);
  background: none;
  color: var(--mk-ink);
  cursor: pointer;
}

/* ─ The sheet: a plain stacked list under the bar ─ */
.topbar__drawer {
  display: flex;
  flex-direction: column;
  gap: var(--mk-space-3xs);
  width: min(100% - 2 * var(--mk-rail), var(--mk-measure));
  margin-inline: auto;
  padding-block: var(--mk-space-xs) var(--mk-space-md);
  border-top: var(--mk-hairline) solid var(--mk-line);
}
.topbar__drawer-link {
  padding: var(--mk-space-xs) 0;
  font-size: var(--mk-text-base);
  color: var(--mk-ink);
  text-decoration: none;
}
.topbar__drawer-cta { margin-top: var(--mk-space-2xs); }

@media (min-width: 900px) {
  .topbar__menu,
  .topbar__actions {
    display: flex;
    align-items: center;
    gap: var(--mk-space-md);
  }
  .topbar__menu { margin-inline: auto; }
  .topbar__brand { margin-inline-end: 0; }
  .topbar__burger,
  .topbar__drawer { display: none; }
}

/* The bar never widens the page: below 360px the wordmark alone carries the brand
 * and the menu button stays reachable. */
@media (max-width: 359px) {
  .topbar__row { gap: var(--mk-space-2xs); }
}
</style>
