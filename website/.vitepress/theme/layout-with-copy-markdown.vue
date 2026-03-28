<script setup>
import DefaultTheme from 'vitepress/theme'
import CopyAsMarkdown from './copy-as-markdown.vue'
</script>

<template>
  <DefaultTheme.Layout>
    <template #doc-before>
      <CopyAsMarkdown />
    </template>
  </DefaultTheme.Layout>
</template>
