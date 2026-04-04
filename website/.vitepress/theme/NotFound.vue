<script setup lang="ts">
import { useRouter } from 'vitepress'

const { go } = useRouter()

const suggestions = [
  { text: 'Introduction', link: '/introduction' },
  { text: 'Quick Start', link: '/quick-start' },
  { text: 'Skills Overview', link: '/reference/skills/' },
  { text: 'Agents Overview', link: '/reference/agents/' },
  { text: 'Workflows', link: '/workflows/' },
  { text: 'Cheatsheet', link: '/cheatsheet' },
]
</script>

<template>
  <div class="not-found">
    <div class="container">
      <p class="code">404</p>
      <h1 class="title">Page not found</h1>
      <p class="quote">
        Looks like this page wandered off. Even MeowKit's
        <code>meow:scout</code> couldn't find it.
      </p>

      <div class="action">
        <a class="link" href="/" @click.prevent="go('/')">
          ← Take me home
        </a>
      </div>

      <div class="suggestions">
        <p class="suggestions-title">Maybe you're looking for:</p>
        <ul>
          <li v-for="s in suggestions" :key="s.link">
            <a :href="s.link" @click.prevent="go(s.link)">{{ s.text }}</a>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.not-found {
  padding: 64px 24px 96px;
  text-align: center;
}

.container {
  max-width: 480px;
  margin: 0 auto;
}

.code {
  font-size: 64px;
  font-weight: 700;
  line-height: 1;
  color: var(--vp-c-brand-1);
}

.title {
  font-size: 24px;
  font-weight: 600;
  margin-top: 12px;
  color: var(--vp-c-text-1);
}

.quote {
  margin-top: 16px;
  font-size: 15px;
  color: var(--vp-c-text-2);
  line-height: 1.6;
}

.quote code {
  font-size: 13px;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  padding: 2px 6px;
  border-radius: 4px;
}

.action {
  margin-top: 28px;
}

.action .link {
  display: inline-block;
  padding: 8px 24px;
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-white);
  background: var(--vp-c-brand-1);
  border-radius: 8px;
  text-decoration: none;
  transition: background 0.2s;
}

.action .link:hover {
  background: var(--vp-c-brand-2);
}

.suggestions {
  margin-top: 36px;
  text-align: left;
  display: inline-block;
}

.suggestions-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.suggestions ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.suggestions li {
  margin: 4px 0;
}

.suggestions a {
  font-size: 14px;
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.suggestions a:hover {
  text-decoration: underline;
}
</style>
