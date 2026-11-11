<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

/* Section 3 — the statement. The sentence lights word by word as the section
 * crosses the viewport; the closing clause stays in the accent.
 * Copy verbatim from the mockup; the moment is written here, not borrowed. */
const SENTENCE = 'Automation runs between the gates and never supplies the approval. A passing test, a reviewer score and a green build are evidence you read before'
const CLOSER = 'you type yes.'

const words = SENTENCE.split(' ')
const closerWords = CLOSER.split(' ')
const total = words.length + closerWords.length

const el = ref<HTMLElement | null>(null)
const { progress } = useScrollProgress(el, { startAt: 0.9, endAt: 0.55 })

// Server-rendered and pre-hydration the sentence is fully lit: a reader without
// JavaScript must never meet a page of near-invisible words.
const live = ref(false)
onMounted(() => { live.value = true })

// one extra so the last word reaches full ink before the section leaves
const lit = computed(() => (live.value ? Math.round(progress.value * (total + 1)) : total))
</script>

<template>
  <section ref="el" class="rule" id="rule" aria-label="The gate rule">
    <div class="mk-wrap">
      <p class="mk-label rule__label">The gate rule</p>
      <p class="rule__text">
        <!-- the sentence is read as one string by assistive tech; the spans are visual only -->
        <span class="mk-sr-only">{{ SENTENCE }} {{ CLOSER }}</span>
        <span aria-hidden="true">
          <!-- the space is interpolated: a literal trailing space in the template is
               condensed away by the compiler, which would leave one unbreakable word -->
          <span
            v-for="(w, i) in words"
            :key="`w${i}`"
            class="rule__w"
            :class="{ 'is-lit': i < lit }"
          >{{ w }}{{ ' ' }}</span>
          <strong
            v-for="(w, i) in closerWords"
            :key="`c${i}`"
            class="rule__w rule__w--strong"
            :class="{ 'is-lit': words.length + i < lit }"
          >{{ w }}{{ ' ' }}</strong>
        </span>
      </p>
    </div>
  </section>
</template>

<style scoped>
.rule {
  display: flex;
  align-items: center;
  min-height: 72svh;
  padding-block: var(--mk-space-4xl);
}

.rule__label { margin-block-end: var(--mk-space-md); }

.rule__text {
  max-width: 24ch;
  font-family: var(--mk-font-display);
  font-weight: var(--mk-serif-weight);
  font-size: var(--mk-text-h2);
  line-height: 1.22;
  letter-spacing: var(--mk-serif-track);
}

.rule__w {
  color: var(--mk-line);
  font-weight: inherit;
  transition: color 0.35s var(--mk-ease);
}
.rule__w.is-lit { color: var(--mk-ink); }
.rule__w--strong.is-lit { color: var(--mk-accent); }

@media (min-width: 900px) {
  .rule__text { max-width: 20ch; font-size: clamp(2.5rem, 3.4vw + 1rem, 4rem); }
}

/* Nothing may stay unreadable: without motion the whole sentence is already lit. */
@media (prefers-reduced-motion: reduce) {
  .rule__w { color: var(--mk-ink); transition: none; }
  .rule__w--strong { color: var(--mk-accent); }
}
</style>
