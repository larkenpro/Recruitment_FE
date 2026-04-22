import { Layout, Menu, Avatar, Badge } from 'antd'
import {
  DashboardOutlined, BankOutlined, CalendarOutlined,
  UserOutlined, BarChartOutlined, GiftOutlined, LogoutOutlined, BellOutlined, AuditOutlined, CheckCircleOutlined, TeamOutlined
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const { Header, Sider, Content } = Layout

const menuItems = [
  { key: '/colleges', icon: <BankOutlined />, label: 'Colleges' },
  { key: '/events', icon: <CalendarOutlined />, label: 'Events' },
  { key: '/positions', icon: <AuditOutlined />, label: 'Positions' },
  { key: '/candidates', icon: <TeamOutlined />, label: 'Candidates' },
  { key: '/analytics', icon: <BarChartOutlined />, label: 'Analytics' },
]

export default function AppLayout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, user } = useAuth()

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
        <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #f0f0f0', marginBottom: 4 }}>
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
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ border: 'none', fontSize: 14 }}
        />
        <div style={{ position: 'absolute', bottom: 24, left: 0, right: 0, padding: '0 16px' }}>
          <Menu mode="inline" style={{ border: 'none' }}
            items={[{ key: 'logout', icon: <LogoutOutlined />, label: 'Logout', danger: true }]}
            onClick={handleLogout}
          />
        </div>
      </Sider>

      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <Badge count={0}><BellOutlined style={{ fontSize: 18 }} /></Badge>
            <Avatar icon={<UserOutlined />} style={{ background: '#4f46e5' }} />
            <span style={{ fontWeight: 500 }}>{user?.username}</span>
          </div>
        </Header>
        <Content style={{ margin: 24, background: '#f5f6fa', minHeight: 'calc(100vh - 64px)' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}
