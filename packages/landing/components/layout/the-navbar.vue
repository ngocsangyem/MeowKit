<script setup lang="ts">
const mobileOpen = ref(false)

const navLinks = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Capabilities', href: '#features' },
  { label: 'Install', href: '#install' },
  { label: 'Docs', href: 'https://docs.meowkit.dev/', external: true },
]

function toggleMobile() {
  mobileOpen.value = !mobileOpen.value
}

function closeMobile() {
  mobileOpen.value = false
}

function handleNavClick(event: MouseEvent, href: string, external?: boolean) {
  if (external || !href.startsWith('#')) return
  event.preventDefault()
  closeMobile()

  const target = document.querySelector<HTMLElement>(href)
  if (!target) return

  const currentY = window.scrollY
  const targetY = target.getBoundingClientRect().top + currentY

  // If the scroll path crosses the sticky-scroll section, the browser's smooth-scroll
  // crawls through ~1800px of non-moving sticky content, appearing to freeze.
  // Detect crossing and jump instantly instead.
  const scrollTrack = document.querySelector<HTMLElement>('.hiw-scroll-track')
  let behavior: ScrollBehavior = 'smooth'

  if (scrollTrack) {
    const trackStart = scrollTrack.getBoundingClientRect().top + currentY
    const trackEnd = trackStart + scrollTrack.offsetHeight
    const crossesDown = currentY < trackEnd && targetY > trackEnd
    const crossesUp = currentY > trackStart && targetY < trackStart
    if (crossesDown || crossesUp) behavior = 'instant'
  }

  target.scrollIntoView({ behavior })
}
</script>

<template>
  <header role="banner">
    <!-- Floating pill: detached from page edges, blur sits over the dark canvas -->
    <nav class="nav-pill" aria-label="Main navigation">
      <TheLogo size="sm" />

      <ul class="nav-pill__links" role="list">
        <li v-for="link in navLinks" :key="link.href">
          <a
            :href="link.href"
            class="nav-pill__link"
            :target="link.external ? '_blank' : undefined"
            :rel="link.external ? 'noopener noreferrer' : undefined"
            @click="handleNavClick($event, link.href, link.external)"
          >{{ link.label }}</a>
        </li>
      </ul>

      <a
        href="https://github.com/ngocsangyem/MeowKit"
        class="nav-pill__cta"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View MeowKit on GitHub"
      >GitHub</a>

      <!-- Mobile toggle -->
      <button
        class="nav-pill__toggle"
        :aria-expanded="mobileOpen"
        aria-controls="mobile-menu"
        aria-label="Toggle navigation menu"
        @click="toggleMobile"
      >
        <svg v-if="!mobileOpen" class="nav-pill__toggle-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <svg v-else class="nav-pill__toggle-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </nav>

    <!-- Mobile menu: sheet below the pill -->
    <Transition name="slide-down">
      <div v-if="mobileOpen" id="mobile-menu" class="nav-sheet">
        <ul role="list" class="nav-sheet__links">
          <li v-for="link in navLinks" :key="link.href">
            <a
              :href="link.href"
              class="nav-sheet__link"
              :target="link.external ? '_blank' : undefined"
              :rel="link.external ? 'noopener noreferrer' : undefined"
              @click="handleNavClick($event, link.href, link.external)"
            >{{ link.label }}</a>
          </li>
          <li>
            <a
              href="https://github.com/ngocsangyem/MeowKit"
              class="nav-sheet__link"
              target="_blank"
              rel="noopener noreferrer"
              @click="closeMobile"
            >GitHub</a>
          </li>
        </ul>
      </div>
    </Transition>
  </header>
</template>

<style scoped>
.nav-pill {
  position: fixed;
  top: var(--space-md);
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: var(--space-lg);
  padding: var(--space-xs) var(--space-md);
  background: var(--color-nav-veil);
  backdrop-filter: blur(14px) saturate(120%);
  -webkit-backdrop-filter: blur(14px) saturate(120%);
  border: var(--rule-hair) solid var(--color-rule);
  border-radius: var(--radius-pill);
  z-index: var(--z-nav);
  max-width: calc(100vw - 2rem);
}

.nav-pill__links {
  display: none;
  align-items: center;
  gap: var(--space-lg);
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (min-width: 40rem) {
  .nav-pill__links { display: flex; }
}

.nav-pill__link {
  font-size: var(--text-sm);
  color: var(--color-ink-2);
  text-decoration: none;
  white-space: nowrap;
  transition: color var(--dur-short) var(--ease-out);
}
.nav-pill__link:hover { color: var(--color-ink); }

.nav-pill__cta {
  display: none;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-accent);
  text-decoration: none;
  white-space: nowrap;
  transition: color var(--dur-short) var(--ease-out);
}
.nav-pill__cta:hover { color: var(--color-focus); }

@media (min-width: 40rem) {
  .nav-pill__cta { display: inline-flex; }
}

.nav-pill__toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  margin: calc(var(--space-xs) * -1) calc(var(--space-xs) * -1);
  border: none;
  background: transparent;
  color: var(--color-ink-2);
  cursor: pointer;
  transition: color var(--dur-short) var(--ease-out);
}
.nav-pill__toggle:hover { color: var(--color-ink); }

@media (min-width: 40rem) {
  .nav-pill__toggle { display: none; }
}

.nav-pill__toggle-icon {
  width: 1.25rem;
  height: 1.25rem;
}

/* ─ Mobile sheet ─ */
.nav-sheet {
  position: fixed;
  top: calc(var(--space-md) + 3.5rem);
  left: 50%;
  transform: translateX(-50%);
  width: min(20rem, calc(100vw - 2rem));
  padding: var(--space-sm);
  background: var(--color-paper-2);
  border: var(--rule-hair) solid var(--color-rule);
  border-radius: var(--radius-sm);
  z-index: var(--z-nav);
}

@media (min-width: 40rem) {
  .nav-sheet { display: none; }
}

.nav-sheet__links {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  margin: 0;
  padding: 0;
  list-style: none;
}

.nav-sheet__link {
  display: block;
  padding: var(--space-sm);
  border-radius: var(--radius-sm);
  font-size: var(--text-base);
  color: var(--color-ink-2);
  text-decoration: none;
  white-space: nowrap;
  transition: color var(--dur-short) var(--ease-out),
              background-color var(--dur-short) var(--ease-out);
}
.nav-sheet__link:hover {
  color: var(--color-ink);
  background: var(--color-paper-3);
}
</style>
