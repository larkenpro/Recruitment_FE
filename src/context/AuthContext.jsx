import { createContext, useContext, useEffect, useState } from 'react'
import { getMe } from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(!!token)

  useEffect(() => {
    if (!token) {
      setAuthLoading(false)
      return
    }
    getMe()
      .then((res) => setUser(res.data.data))
      .catch(() => {
        localStorage.removeItem('token')
        setToken(null)
        setUser(null)
      })
      .finally(() => setAuthLoading(false))
  }, [token])

  const loginUser = (data) => {
    localStorage.setItem('token', data.token)
    setToken(data.token)
    setUser({ username: data.username, email: data.email, pages: data.pages })
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  const hasPage = (key) => !!user?.pages?.includes(key)

  return (
    <AuthContext.Provider value={{ token, user, authLoading, loginUser, logout, hasPage }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
