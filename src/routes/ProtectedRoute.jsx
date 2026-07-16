import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { token, user } = useAuth()
  return token && user?.role === 'ADMIN' ? children : <Navigate to="/login" replace />
}
