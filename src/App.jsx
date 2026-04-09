import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'
import AppLayout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Colleges from './pages/Colleges'
import Events from './pages/Events'
import Candidates from './pages/Candidates'
import CandidateDetail from './pages/CandidateDetail'
import Analytics from './pages/Analytics'
import Offers from './pages/Offers'
import Joining from './pages/Joining'
import Evaluation from './pages/Evaluation'
import PublicApply from './pages/PublicApply'

const queryClient = new QueryClient()

const theme = {
  token: {
    colorPrimary: '#4f46e5',
    borderRadius: 8,
    fontFamily: 'Inter, sans-serif',
  }
}

const P = ({ children }) => <ProtectedRoute><AppLayout>{children}</AppLayout></ProtectedRoute>

export default function App() {
  return (
    <ConfigProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/apply/:token" element={<PublicApply />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<P><Dashboard /></P>} />
              <Route path="/colleges" element={<P><Colleges /></P>} />
              <Route path="/events" element={<P><Events /></P>} />
              <Route path="/candidates" element={<P><Candidates /></P>} />
              <Route path="/candidates/:id" element={<P><CandidateDetail /></P>} />
              <Route path="/analytics" element={<P><Analytics /></P>} />
              <Route path="/offers" element={<P><Offers /></P>} />
              <Route path="/joining" element={<P><Joining /></P>} />
              <Route path="/evaluation" element={<P><Evaluation /></P>} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ConfigProvider>
  )
}
