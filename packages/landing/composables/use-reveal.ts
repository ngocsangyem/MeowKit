import { onMounted, onBeforeUnmount } from 'vue'

/** The class a revealable element carries, and the class marking it arrived. */
export const REVEAL_CLASS = 'mk-reveal'
export const REVEAL_IN_CLASS = 'is-in'
/**
 * Set on <html> by this composable, and the only thing that makes the hidden
 * resting state in main.css apply. Owning the gate here means a selector that
 * no longer matches — a renamed class, say — degrades to "everything visible"
 * instead of "everything invisible".
 */
export const REVEAL_ARMED_CLASS = 'mk-reveal-armed'

/**
 * Scroll reveal: adds `.is-in` to every `.mk-reveal` inside the document once
 * it enters the viewport, then stops observing it. One observer for the page.
 *
 * Under `prefers-reduced-motion: reduce` every element is marked in at once.
 */
export function useReveal(options: { selector?: string, rootMargin?: string } = {}) {
  const selector = options.selector ?? `.${REVEAL_CLASS}`
  const rootMargin = options.rootMargin ?? '0px 0px -12% 0px'
  let observer: IntersectionObserver | null = null

  onMounted(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>(selector))
    // Nothing to reveal: leave the gate closed so nothing can be hidden.
    if (!targets.length) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || typeof IntersectionObserver === 'undefined') {
      targets.forEach(el => el.classList.add(REVEAL_IN_CLASS))
      return
    }

    document.documentElement.classList.add(REVEAL_ARMED_CLASS)

    observer = new IntersectionObserver((entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add(REVEAL_IN_CLASS)
        obs.unobserve(entry.target)
      }
    }, { rootMargin, threshold: 0.08 })

    targets.forEach(el => observer!.observe(el))
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
    observer = null
    document.documentElement.classList.remove(REVEAL_ARMED_CLASS)
  })
}
