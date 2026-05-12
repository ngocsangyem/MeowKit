<script setup lang="ts">
// Extra scroll travel for the 7-phase animation (px scrolled past the sticky inner)
const EXTRA_SCROLL = 1050

const scrollTrackRef = ref<HTMLElement | null>(null)
const headerRef = ref<HTMLElement | null>(null)
const scrollProgress = ref(0)
const headerVisible = ref(false)

function handleScroll() {
  const el = scrollTrackRef.value
  if (!el) return
  const { top } = el.getBoundingClientRect()
  // top = 0: sticky inner just reached viewport top → progress starts
  // top = -EXTRA_SCROLL: animation complete
  scrollProgress.value = Math.max(0, Math.min(1, -top / EXTRA_SCROLL))
}

let headerObserver: IntersectionObserver | null = null

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  handleScroll()

  headerObserver = new IntersectionObserver(
    (entries) => { if (entries[0]?.isIntersecting) headerVisible.value = true },
    { threshold: 0.1 },
  )
  if (headerRef.value) headerObserver.observe(headerRef.value)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  headerObserver?.disconnect()
})
</script>

<template>
  <section id="how-it-works" class="hiw" aria-labelledby="hiw-heading">
    <!-- Header: normal flow, scrolls off screen before the sticky body kicks in -->
    <div class="hiw__header-zone">
      <div class="container-landing">
        <div ref="headerRef" class="hiw__header" :class="{ 'hiw__header--visible': headerVisible }">
          <p class="hiw__eyebrow">Process</p>
          <h2 id="hiw-heading" class="hiw__heading">
            The 7-Phase<br />
            <span class="gradient-text">Workflow</span>
          </h2>
          <p class="hiw__sub">
            Every task follows the same enforced sequence — orient, plan, test, build, review, ship,
            reflect. Two hard gates block shipping unreviewed or untested code.
          </p>
        </div>
      </div>
    </div>

    <!-- Scroll track: gives the sticky body room to animate through EXTRA_SCROLL px -->
    <div ref="scrollTrackRef" class="hiw-scroll-track">
      <div class="hiw-sticky">
        <div class="container-landing hiw__container">
          <div class="hiw__body">
            <div class="hiw__timeline">
              <WorkflowTimeline :scroll-progress="scrollProgress" />
            </div>
            <div class="hiw__comparison">
              <p class="hiw__comparison-label">See the difference</p>
              <CodeComparison />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hiw {
  background: linear-gradient(180deg, transparent 0%, rgba(10, 31, 68, 0.3) 50%, transparent 100%);
}

/* ─ Header zone: normal flow, scrolls away before sticky body pins ─ */
.hiw__header-zone {
  padding: 5rem 1rem 3rem;
}

@media (min-width: 640px) {
  .hiw__header-zone { padding: 5rem 1.5rem 3rem; }
}

@media (min-width: 1024px) {
  .hiw__header-zone { padding: 5rem 2rem 3rem; }
}

.hiw__header {
  text-align: center;
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}

.hiw__header--visible {
  opacity: 1;
  transform: none;
}

.hiw__eyebrow {
  font-size: 0.8125rem;
  font-family: "Fira Code", monospace;
  color: #66CCFF;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin: 0 0 0.875rem;
}

.hiw__heading {
  font-size: clamp(1.875rem, 4vw, 3rem);
  font-weight: 500;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: #F8FAFC;
  margin: 0 0 1rem;
}

.hiw__sub {
  font-size: 1.0625rem;
  color: #94A3B8;
  line-height: 1.7;
  max-width: 38rem;
  margin: 0 auto;
}

/* ─ Scroll track: sized to give sticky body EXTRA_SCROLL px of travel ─ */
.hiw-scroll-track {
  position: relative;
  height: calc(100vh + 1050px);
}

/* ─ Sticky body: pins at viewport top, fills 100vh, no overflow ─ */
.hiw-sticky {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  align-items: center;
  overflow: hidden;
  padding: 0 1rem;
}

@media (min-width: 640px) {
  .hiw-sticky { padding: 0 1.5rem; }
}

@media (min-width: 1024px) {
  .hiw-sticky { padding: 0 2rem; }
}

/* ─ Below 2-column breakpoint: disable sticky so single-column content scrolls naturally ─ */
@media (max-width: 1023px) {
  .hiw-scroll-track {
    height: auto;
  }
  .hiw-sticky {
    position: static;
    height: auto;
    padding: 0 1rem 4rem;
  }
}

@media (max-width: 639px) {
  .hiw-sticky {
    padding: 0 1rem 3rem;
  }
}

.hiw__container {
  width: 100%;
}

/* ─ Two-column body: timeline left, comparison right ─ */
.hiw__body {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2.5rem;
  align-items: start;
}

@media (min-width: 1024px) {
  .hiw__body {
    grid-template-columns: 1fr 1fr;
    gap: 4rem;
  }
}

.hiw__comparison-label {
  font-size: 0.8125rem;
  font-family: "Fira Code", monospace;
  color: rgba(148, 163, 184, 0.6);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0 0 1.25rem;
}
</style>
