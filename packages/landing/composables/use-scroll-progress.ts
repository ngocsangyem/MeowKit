import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue'

/**
 * Progress of an element through the viewport, 0 → 1.
 *
 * 0 while the element's top is still below `startAt` of the viewport height,
 * 1 once its bottom has risen past `endAt`. Driven by one rAF-throttled scroll
 * listener; under `prefers-reduced-motion: reduce` it pins to 1 so any
 * scroll-told moment shows its finished state at once.
 */
export function useScrollProgress(
  el: Ref<HTMLElement | null>,
  options: { startAt?: number, endAt?: number } = {},
) {
  const startAt = options.startAt ?? 0.85
  const endAt = options.endAt ?? 0.35
  const progress = ref(0)
  let frame = 0

  function measure() {
    frame = 0
    const node = el.value
    if (!node) return
    const vh = window.innerHeight || 1
    const rect = node.getBoundingClientRect()
    const from = vh * startAt
    const to = vh * endAt - rect.height
    const span = from - to
    const k = span <= 0 ? 1 : (from - rect.top) / span
    progress.value = Math.min(1, Math.max(0, k))
  }

  function schedule() {
    if (frame) return
    frame = requestAnimationFrame(measure)
  }

  onMounted(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      progress.value = 1
      return
    }
    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
  })

  onBeforeUnmount(() => {
    if (frame) cancelAnimationFrame(frame)
    window.removeEventListener('scroll', schedule)
    window.removeEventListener('resize', schedule)
  })

  return { progress }
}
