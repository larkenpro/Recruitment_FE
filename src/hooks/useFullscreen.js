import { useEffect, useState } from 'react'

// Below antd's modals and dropdowns (1000 and up), so they still open on top of it.
export const FULLSCREEN_STYLE = { position: 'fixed', inset: 0, zIndex: 999, background: '#fff' }

// Fullscreens the page, with the caller covering it using FULLSCREEN_STYLE, not the element itself:
// antd renders dropdowns, modals and messages on <body>, and the browser hides whatever is outside
// the fullscreen element. If the browser refuses, the caller still fills the window.
export function useFullscreen() {
  const [on, setOn] = useState(false)

  // Esc is handled by the browser, so this is how we hear about it.
  useEffect(() => {
    const sync = () => { if (!document.fullscreenElement) setOn(false) }
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  useEffect(() => {
    if (!on) return undefined
    document.documentElement.requestFullscreen?.().catch(() => {})
    return () => { if (document.fullscreenElement) document.exitFullscreen() }
  }, [on])

  return [on, () => setOn((v) => !v)]
}
