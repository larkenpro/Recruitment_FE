import axios from 'axios'
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

// Log in against the real backend with the seeded admin account to get a real JWT.
// Override with VITE_TEST_ADMIN_USERNAME / VITE_TEST_ADMIN_PASSWORD for a different account.
beforeAll(async () => {
  const username = import.meta.env.VITE_TEST_ADMIN_USERNAME ?? 'admin'
  const password = import.meta.env.VITE_TEST_ADMIN_PASSWORD ?? 'j&j.hire'

  const res = await axios.post(`${import.meta.env.VITE_PUBLIC_API_URL}/api/v1/auth/login`, { username, password })
  localStorage.setItem('token', res.data.data.token)
  localStorage.setItem('user', JSON.stringify({ username: res.data.data.username, role: res.data.data.role }))
})

afterAll(() => {
  localStorage.clear()
})
