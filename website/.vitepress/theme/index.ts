import DefaultTheme from 'vitepress/theme'
import LayoutWithCopyMarkdown from './layout-with-copy-markdown.vue'
import NotFound from './NotFound.vue'
import './custom.css'

export default {
  ...DefaultTheme,
  Layout: LayoutWithCopyMarkdown,
  NotFound,
}
