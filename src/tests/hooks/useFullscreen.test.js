// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFullscreen } from '../../hooks/useFullscreen'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

describe('useFullscreen', () => {
  let current
  let root
  let fullscreenElement

  const Probe = () => {
    current = useFullscreen()
    return null
  }
  const browserLeaves = () => act(() => {
    fullscreenElement = null
    document.dispatchEvent(new Event('fullscreenchange'))
  })

  beforeEach(async () => {
    fullscreenElement = null
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreenElement })
    document.documentElement.requestFullscreen = vi.fn(async () => { fullscreenElement = document.documentElement })
    document.exitFullscreen = vi.fn(async () => { fullscreenElement = null })
    root = createRoot(document.createElement('div'))
    await act(async () => root.render(createElement(Probe)))
  })

  afterEach(() => act(() => root.unmount()))

  it('asks the browser for the whole page, and leaves on the second toggle', async () => {
    expect(current[0]).toBe(false)
    await act(async () => current[1]())
    expect(current[0]).toBe(true)
    expect(document.documentElement.requestFullscreen).toHaveBeenCalledOnce()

    await act(async () => current[1]())
    expect(current[0]).toBe(false)
    expect(document.exitFullscreen).toHaveBeenCalledOnce()
  })

  it('turns off when the browser leaves full screen (Esc)', async () => {
    await act(async () => current[1]())
    browserLeaves()
    expect(current[0]).toBe(false)
    expect(document.exitFullscreen).not.toHaveBeenCalled()
  })

  it('stays on, filling the window, when the browser refuses', async () => {
    document.documentElement.requestFullscreen = vi.fn(() => Promise.reject(new Error('denied')))
    await act(async () => current[1]())
    expect(current[0]).toBe(true)
  })

  it('leaves full screen if unmounted while on', async () => {
    await act(async () => current[1]())
    act(() => root.unmount())
    expect(document.exitFullscreen).toHaveBeenCalledOnce()
    root = createRoot(document.createElement('div'))
  })
})
