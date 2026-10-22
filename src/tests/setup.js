import { beforeAll, afterAll } from 'vitest'
import axios from 'axios'

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

// The candidate page keeps its session in sessionStorage (api/portal.js).
if (typeof sessionStorage === 'undefined') {
  const store = {}
  global.sessionStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
    clear: () => { Object.keys(store).forEach(k => delete store[k]) },
  }
}

if (typeof window === 'undefined') {
  global.window = { location: { href: '' } }
}

// API tests run against the dev backend: use VITE_TEST_TOKEN, or log in as the seeded admin
// (VITE_TEST_USERNAME / VITE_TEST_PASSWORD, defaulting to application.properties' admin).
beforeAll(async () => {
  let token = import.meta.env.VITE_TEST_TOKEN
  if (!token) {
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/auth/login`, {
        username: import.meta.env.VITE_TEST_USERNAME ?? 'admin',
        password: import.meta.env.VITE_TEST_PASSWORD ?? 'j&j.hire',
      })
      token = res.data.data.token
    } catch {
      // Backend not running: the unit tests still run; API tests fail with their own errors.
    }
  }
  if (token) localStorage.setItem('token', token)
})

afterAll(() => {
  localStorage.clear()
})
