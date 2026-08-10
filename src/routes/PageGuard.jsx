import { Navigate } from 'react-router-dom'
import { Empty } from 'antd'
import { useAuth } from '../context/AuthContext'
import { PAGE_ROUTES } from '../utils/pages'

export default function PageGuard({ page, children }) {
  const { user } = useAuth()

  if (user?.pages?.includes(page)) return children

  const firstAllowedPage = Object.keys(PAGE_ROUTES).find((key) => user?.pages?.includes(key))
  if (firstAllowedPage) return <Navigate to={PAGE_ROUTES[firstAllowedPage]} replace />

  return <Empty description="No pages assigned. Contact your administrator." style={{ marginTop: 80 }} />
}
