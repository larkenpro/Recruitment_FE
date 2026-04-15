import { beforeAll, afterAll } from 'vitest'

// In a Node environment, localStorage and window don't exist.
// axios.js reads the auth token from localStorage and redirects on 401 via
// window.location.href — polyfill both so the interceptor works in tests.
if (typeof localStorage === 'undefined') {
  const store = {}
  global.localStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
    clear: () => { Object.keys(store).forEach(k => delete store[k]) },
  }
}

if (typeof window === 'undefined') {
  global.window = { location: { href: '' } }
}

// Seed auth token. Override with VITE_TEST_TOKEN env var for a real JWT backend.
beforeAll(() => {
  localStorage.setItem('token', import.meta.env.VITE_TEST_TOKEN ?? 'dev-token')
})

afterAll(() => {
  localStorage.clear()
})
