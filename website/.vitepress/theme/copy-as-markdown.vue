<script setup>
import { ref } from 'vue'
import { useData } from 'vitepress'

const { page, isDark } = useData()
const copied = ref(false)
const error = ref(false)

/**
 * Resolves current page to its .md file URL.
 * Uses page.relativePath (e.g. "reference/skills/cook.md") which is the actual source path.
 * In production: vitepress-plugin-llms generates .md files at same paths in dist.
 * In dev: fetch the raw source file directly via Vite's file serving.
 */
function resolveMarkdownUrl() {
  const relativePath = page.value.relativePath
  if (!relativePath) return '/index.md'
  // relativePath is already like "reference/skills/cook.md"
  return '/' + relativePath
}

async function copyMarkdown() {
  try {
    error.value = false
    const url = resolveMarkdownUrl()
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to fetch ${url}`)
    const text = await res.text()

    // Validate we got markdown, not HTML (dev server fallback protection)
    if (text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')) {
      throw new Error('Received HTML instead of Markdown — .md files may not be available in dev mode')
    }

    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch (e) {
    console.error('Copy as Markdown failed:', e)
    error.value = true
    setTimeout(() => { error.value = false }, 3000)
  }
}
</script>

<template>
  <div class="copy-as-markdown">
    <button
      class="copy-btn"
      :class="{ copied, error }"
      @click="copyMarkdown"
      :title="copied ? 'Copied!' : error ? 'Failed — try in production build' : 'Copy page as Markdown'"
    >
      <svg v-if="copied" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      <svg v-else-if="error" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      <span>{{ copied ? 'Copied!' : error ? 'Unavailable' : 'Copy as MD' }}</span>
    </button>
  </div>
</template>

<style scoped>
.copy-as-markdown {
  float: right;
  margin-top: 4px;
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: var(--mk-radius-sm, 6px);
  border: 1px solid var(--vp-c-border);
  background: transparent;
  color: var(--vp-c-text-3);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  line-height: 1;
}

.copy-btn:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-soft);
}

.copy-btn.copied {
  border-color: var(--mk-color-success, #22C55E);
  color: var(--mk-color-success, #22C55E);
}

.copy-btn.error {
  border-color: var(--vp-c-text-3);
  color: var(--vp-c-text-3);
  opacity: 0.6;
}
</style>
