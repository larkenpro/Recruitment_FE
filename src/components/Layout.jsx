import { Layout, Menu, Avatar, Badge } from 'antd'
import {
  DashboardOutlined, BankOutlined, CalendarOutlined,
  UserOutlined, BarChartOutlined, GiftOutlined, LogoutOutlined, BellOutlined, AuditOutlined, CheckCircleOutlined, TeamOutlined, SettingOutlined
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const { Header, Sider, Content } = Layout

const allMenuItems = [
  { key: '/colleges', page: 'COLLEGES', icon: <BankOutlined />, label: 'Colleges' },
  { key: '/positions', page: 'POSITIONS', icon: <AuditOutlined />, label: 'Positions' },
  { key: '/events', page: 'EVENTS', icon: <CalendarOutlined />, label: 'Events' },
  { key: '/candidates', page: 'CANDIDATES', icon: <TeamOutlined />, label: 'Candidates' },
  { key: '/analytics', page: 'ANALYTICS', icon: <BarChartOutlined />, label: 'Analytics' },
  { key: '/users', page: 'USER_MANAGEMENT', icon: <SettingOutlined />, label: 'User Management' },
]

export default function AppLayout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, user } = useAuth()

  const handleLogout = () => { logout(); navigate('/login') }

  const menuItems = allMenuItems
    .filter((item) => user?.pages?.includes(item.page))
    .map(({ page, ...rest }) => rest)

  const activeMenuKey = menuItems.find((item) => location.pathname.startsWith(item.key))?.key ?? location.pathname

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider width={220} style={{ background: '#fff', borderRight: '1px solid #f0f0f0', overflow: 'hidden' }}>
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #f0f0f0', marginBottom: 4, flexShrink: 0 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 15, letterSpacing: '-0.5px' }}>JJ</span>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1e1b4b', lineHeight: 1.2 }}>Recruit</div>
              <div style={{ fontSize: 10, color: '#a5b4fc', fontWeight: 500, letterSpacing: '0.04em', lineHeight: 1 }}>J&amp;J SOURCING</div>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <Menu
              mode="inline"
              selectedKeys={[activeMenuKey]}
              items={menuItems}
              onClick={({ key }) => navigate(key)}
              style={{ border: 'none', fontSize: 14 }}
            />
          </div>
          <div style={{ padding: '8px 16px', borderTop: '1px solid #f0f0f0', flexShrink: 0 }}>
            <Menu
              mode="inline"
              style={{ border: 'none' }}
              items={[{ key: 'logout', icon: <LogoutOutlined />, label: 'Logout', danger: true }]}
              onClick={handleLogout}
            />
          </div>
        </div>
      </Sider>

      <Layout style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <Badge count={0}><BellOutlined style={{ fontSize: 18 }} /></Badge>
            <Avatar icon={<UserOutlined />} style={{ background: '#4f46e5' }} />
            <span style={{ fontWeight: 500 }}>{user?.username}</span>
          </div>
        </Header>
        <Content style={{ flex: 1, overflow: 'auto', padding: 24, background: '#f5f6fa' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}
