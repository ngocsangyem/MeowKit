import DefaultTheme from 'vitepress/theme'
import LayoutWithCopyMarkdown from './layout-with-copy-markdown.vue'
import './custom.css'

export default {
  ...DefaultTheme,
  Layout: LayoutWithCopyMarkdown,
}
