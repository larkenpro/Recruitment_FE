import { Layout, Menu, Avatar, Badge, Input } from 'antd'
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
        <div style={{ padding: '20px 24px', fontSize: 20, fontWeight: 700, color: '#4f46e5', display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo.png" alt="J&J Logo" width="32" height="32" style={{ borderRadius: '6px' }} />
          Recruit
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
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0' }}>
          <Input.Search placeholder="Search..." style={{ width: 300 }} />
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
