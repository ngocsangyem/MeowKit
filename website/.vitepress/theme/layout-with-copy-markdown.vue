<script setup>
import DefaultTheme from 'vitepress/theme-without-fonts'
import CopyAsMarkdown from './copy-as-markdown.vue'
import HomeHeroPipeline from './home-hero-pipeline.vue'
import HomeFeatureClusters from './home-feature-clusters.vue'
</script>

<template>
  <DefaultTheme.Layout>
    <template #doc-before>
      <CopyAsMarkdown />
    </template>
    <template #home-hero-image>
      <HomeHeroPipeline />
    </template>
    <template #home-features-after>
      <HomeFeatureClusters />
    </template>
  </DefaultTheme.Layout>
</template>
