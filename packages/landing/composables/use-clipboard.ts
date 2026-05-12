export function useClipboard() {
  const copied = ref(false)
  let timer: ReturnType<typeof setTimeout>

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      clearTimeout(timer)
      timer = setTimeout(() => { copied.value = false }, 2000)
    }
    catch {
      // Fallback for environments without clipboard API
      const el = document.createElement('textarea')
      el.value = text
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      copied.value = true
      clearTimeout(timer)
      timer = setTimeout(() => { copied.value = false }, 2000)
    }
  }

  onUnmounted(() => clearTimeout(timer))

  return { copied, copy }
}
