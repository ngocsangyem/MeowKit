import DefaultTheme from 'vitepress/theme-without-fonts'
import LayoutWithCopyMarkdown from './layout-with-copy-markdown.vue'
import NotFound from './NotFound.vue'
import './tokens.css'
import './custom.css'

export default {
  ...DefaultTheme,
  Layout: LayoutWithCopyMarkdown,
  NotFound,
}
