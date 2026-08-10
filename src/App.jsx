import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'
import PageGuard from './routes/PageGuard'
import AppLayout from './components/Layout'
import Login from './pages/Login'
import Colleges from './pages/Colleges'
import Events from './pages/Events'
import Positions from './pages/Positions'
import CandidateDetail from './pages/CandidateDetail'
import EventDetail from './pages/EventDetail'
import PublicApply from './pages/PublicApply'
import Analytics from './pages/Analytics'
import Candidates from './pages/Candidates'
import UserManagement from './pages/UserManagement'

const queryClient = new QueryClient()

const theme = {
  token: {
    colorPrimary: '#4f46e5',
    borderRadius: 8,
    fontFamily: 'Inter, sans-serif',
  }
}

const P = ({ page, children }) => (
  <ProtectedRoute><AppLayout><PageGuard page={page}>{children}</PageGuard></AppLayout></ProtectedRoute>
)

export default function App() {
  return (
    <ConfigProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/apply/:token" element={<PublicApply />} />
              <Route path="/" element={<Navigate to="/colleges" replace />} />
              <Route path="/colleges" element={<P page="COLLEGES"><Colleges /></P>} />
              <Route path="/events" element={<P page="EVENTS"><Events/></P>} />
              <Route path="/events/:id" element={<P page="EVENTS"><EventDetail /></P>} />
              <Route path="/positions" element={<P page="POSITIONS"><Positions /></P>} />
              <Route path="/candidates" element={<P page="CANDIDATES"><Candidates /></P>} />
              <Route path="/candidates/:id" element={<P page="CANDIDATES"><CandidateDetail /></P>} />
              <Route path="/analytics" element={<P page="ANALYTICS"><Analytics /></P>} />
              <Route path="/users" element={<P page="USER_MANAGEMENT"><UserManagement /></P>} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ConfigProvider>
  )
}
