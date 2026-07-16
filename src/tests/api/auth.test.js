import axios from 'axios'
import { describe, it, expect } from 'vitest'

const login = (data) => axios.post(`${import.meta.env.VITE_PUBLIC_API_URL}/api/v1/auth/login`, data)

describe('Auth API', () => {
  // ── valid credentials ────────────────────────────────────────────────────
  it('POST /auth/login — valid credentials return a token and role', async () => {
    const res = await login({ username: 'admin', password: 'j&j.hire' })
    expect(res.data.status).toBe('success')
    expect(typeof res.data.data.token).toBe('string')
    expect(res.data.data.username).toBe('admin')
    expect(res.data.data.role).toBe('ADMIN')
  })

  // ── invalid credentials ───────────────────────────────────────────────────
  it('POST /auth/login — wrong password returns 401', async () => {
    await expect(login({ username: 'admin', password: 'wrong-password' })).rejects.toMatchObject({
      response: { status: 401, data: { status: 'error', errorCode: 'UNAUTHORIZED' } },
    })
  })

  it('POST /auth/login — unknown username returns 401', async () => {
    await expect(login({ username: 'nobody', password: 'irrelevant' })).rejects.toMatchObject({
      response: { status: 401 },
    })
  })

  // ── validation ────────────────────────────────────────────────────────────
  it('POST /auth/login — missing fields returns 400', async () => {
    await expect(login({})).rejects.toMatchObject({
      response: { status: 400, data: { errorCode: 'VALIDATION_ERROR' } },
    })
  })
})
