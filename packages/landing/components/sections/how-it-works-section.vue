<script setup lang="ts">
// Extra scroll travel for the 7-phase animation (px scrolled past the sticky inner)
const EXTRA_SCROLL = 1050

const scrollTrackRef = ref<HTMLElement | null>(null)
const scrollProgress = ref(0)

function handleScroll() {
  const el = scrollTrackRef.value
  if (!el) return
  const { top } = el.getBoundingClientRect()
  // top = 0: sticky inner just reached viewport top → progress starts
  // top = -EXTRA_SCROLL: animation complete
  scrollProgress.value = Math.max(0, Math.min(1, -top / EXTRA_SCROLL))
}

// rAF-throttled scroll handler — prevents multiple getBoundingClientRect calls per frame
let rafId: number | null = null
function onScroll() {
  if (rafId !== null) return
  rafId = requestAnimationFrame(() => {
    handleScroll()
    rafId = null
  })
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  handleScroll()
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  if (rafId !== null) cancelAnimationFrame(rafId)
})
</script>

<template>
  <section id="how-it-works" class="hiw" aria-labelledby="hiw-heading">
    <!-- Header: normal flow, scrolls off screen before the sticky body kicks in -->
    <div class="hiw__header-zone container-landing">
      <div class="section-head">
        <h2 id="hiw-heading" class="section-head__title">The 7-phase workflow.</h2>
        <p class="section-head__sub">
          Every task follows the same enforced sequence — orient, plan, test, build,
          review, ship, reflect. Two hard gates block shipping unreviewed or untested code.
        </p>
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
              <CodeComparison />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hiw__header-zone {
  padding-block: var(--space-3xl) var(--space-xl);
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
}

/* ─ Below 2-column breakpoint: disable sticky so single-column content scrolls naturally ─ */
@media (max-width: 59.999rem) {
  .hiw-scroll-track {
    height: auto;
  }
  .hiw-sticky {
    position: static;
    height: auto;
    padding-block-end: var(--space-2xl);
  }
}

.hiw__container {
  width: 100%;
}

/* ─ Two-column body: timeline left, comparison right ─ */
.hiw__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-xl);
  align-items: start;
}

@media (min-width: 60rem) {
  .hiw__body {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--space-2xl);
  }
}
</style>
