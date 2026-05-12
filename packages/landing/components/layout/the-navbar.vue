<script setup lang="ts">
const mobileOpen = ref(false)
const scrolled = ref(false)

onMounted(() => {
  const { y } = useScroll(document.documentElement)
  watchEffect(() => { scrolled.value = y.value > 40 })
})

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Install', href: '#install' },
  { label: 'Docs', href: 'https://meowkit.dev/docs', external: true },
]

function toggleMobile() {
  mobileOpen.value = !mobileOpen.value
}

function closeMobile() {
  mobileOpen.value = false
}
</script>

<template>
  <header
    class="navbar"
    :class="{ 'navbar--scrolled': scrolled }"
    role="banner"
  >
    <nav class="navbar__inner container-landing" aria-label="Main navigation">
      <TheLogo size="sm" />

      <!-- Desktop links -->
      <ul class="navbar__links" role="list">
        <li v-for="link in navLinks" :key="link.href">
          <a
            :href="link.href"
            class="navbar__link"
            :target="link.external ? '_blank' : undefined"
            :rel="link.external ? 'noopener noreferrer' : undefined"
            @click="closeMobile"
          >{{ link.label }}</a>
        </li>
      </ul>

      <!-- Desktop CTA -->
      <UButton
        as="a"
        href="https://github.com/meowkit"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View MeowKit on GitHub"
        icon="i-simple-icons-github"
        size="sm"
        class="navbar__cta hidden sm:inline-flex"
      >
        GitHub
      </UButton>

      <!-- Mobile toggle -->
      <button
        class="navbar__toggle sm:hidden"
        :aria-expanded="mobileOpen"
        aria-controls="mobile-menu"
        aria-label="Toggle navigation menu"
        @click="toggleMobile"
      >
        <span class="sr-only">Menu</span>
        <svg v-if="!mobileOpen" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </nav>

    <!-- Mobile menu -->
    <Transition name="slide-down">
      <div v-if="mobileOpen" id="mobile-menu" class="navbar__mobile sm:hidden">
        <ul role="list" class="navbar__mobile-links">
          <li v-for="link in navLinks" :key="link.href">
            <a
              :href="link.href"
              class="navbar__mobile-link"
              :target="link.external ? '_blank' : undefined"
              :rel="link.external ? 'noopener noreferrer' : undefined"
              @click="closeMobile"
            >{{ link.label }}</a>
          </li>
        </ul>
        <a
          href="https://github.com/meowkit"
          class="btn-primary w-full justify-center mt-3"
          target="_blank"
          rel="noopener noreferrer"
          @click="closeMobile"
        >GitHub</a>
      </div>
    </Transition>
  </header>
</template>

<style scoped>
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  padding: 0.75rem 1rem;
  transition: background-color 0.3s ease, border-color 0.3s ease, backdrop-filter 0.3s ease;
}

.navbar--scrolled {
  background: var(--color-surface-alpha);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-border);
}

.navbar__inner {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.navbar__links {
  display: none;
  align-items: center;
  gap: 1.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
  flex: 1;
  margin-left: 1rem;
}

@media (min-width: 640px) {
  .navbar__links { display: flex; }
}

.navbar__link {
  font-size: 0.875rem;
  color: var(--color-muted, #94A3B8);
  text-decoration: none;
  transition: color 0.2s ease;
}
.navbar__link:hover { color: #F8FAFC; }

.navbar__cta {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  margin-left: auto;
}

.navbar__toggle {
  margin-left: auto;
  padding: 0.375rem;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #94A3B8;
  cursor: pointer;
  transition: color 0.2s ease;
}
.navbar__toggle:hover { color: #F8FAFC; }

.navbar__mobile {
  padding: 1rem;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface-alpha);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.navbar__mobile-links {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.navbar__mobile-link {
  display: block;
  padding: 0.625rem 0.75rem;
  border-radius: 6px;
  font-size: 0.9375rem;
  color: #94A3B8;
  text-decoration: none;
  transition: color 0.2s ease, background-color 0.2s ease;
}
.navbar__mobile-link:hover {
  color: #F8FAFC;
  background: rgba(255, 255, 255, 0.05);
}
</style>
