import { STORAGE_KEYS } from '@/lib/storage-keys'
import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'

function applyThemeClass(theme: Theme) {
  const root = document.documentElement
  if (
    theme === 'dark' ||
    (theme === 'system' && matchMedia('(prefers-color-scheme:dark)').matches)
  ) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(STORAGE_KEYS.THEME) as Theme) ?? 'system',
  )

  useEffect(() => {
    applyThemeClass(theme)
    localStorage.setItem(STORAGE_KEYS.THEME, theme)

    if (theme === 'system') {
      const mq = matchMedia('(prefers-color-scheme:dark)')
      const handler = () => applyThemeClass('system')
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])

  const handleThemeChange = useCallback((newTheme: Theme) => {
    setTheme(newTheme)
  }, [])

  return { theme, onThemeChange: handleThemeChange }
}
