import { useState, useEffect } from 'react'
import { Layout, Menu, Avatar, Badge, Drawer, Button } from 'antd'
import {
  DashboardOutlined, BankOutlined, CalendarOutlined,
  UserOutlined, BarChartOutlined, GiftOutlined, LogoutOutlined, BellOutlined, AuditOutlined, CheckCircleOutlined, TeamOutlined, SettingOutlined,
  ImportOutlined, MenuOutlined
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { SPACE, FONT_SIZE, FONT_WEIGHT, INK, RADIUS, TEXT, useLayoutMetrics } from '../theme'

const { Header, Sider, Content } = Layout

const allMenuItems = [
  { key: '/colleges', page: 'COLLEGES', icon: <BankOutlined />, label: 'Colleges' },
  { key: '/positions', page: 'POSITIONS', icon: <AuditOutlined />, label: 'Positions' },
  { key: '/events', page: 'EVENTS', icon: <CalendarOutlined />, label: 'Events' },
  { key: '/candidates', page: 'CANDIDATES', icon: <TeamOutlined />, label: 'Candidates' },
  { key: '/import', page: 'CANDIDATES', icon: <ImportOutlined />, label: 'Import' },
  { key: '/analytics', page: 'ANALYTICS', icon: <BarChartOutlined />, label: 'Analytics' },
  { key: '/users', page: 'USER_MANAGEMENT', icon: <SettingOutlined />, label: 'User Management' },
]

function Brand() {
  return (
    <div style={{ padding: `${SPACE.md}px ${SPACE.lg}px`, display: 'flex', alignItems: 'center', gap: SPACE.xs, borderBottom: '1px solid #f0f0f0', marginBottom: SPACE.xxs, flexShrink: 0 }}>
      <div style={{
        width: 34, height: 34, borderRadius: RADIUS.control,
        background: `linear-gradient(135deg, ${INK.brand}, #7c3aed)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{ color: INK.onBrand, fontWeight: FONT_WEIGHT.heavy, fontSize: FONT_SIZE.subtitle, letterSpacing: '-0.5px' }}>JJ</span>
      </div>
      <div>
        <div style={{ ...TEXT.sectionTitle, color: '#1e1b4b' }}>Recruit</div>
        <div style={{ fontSize: FONT_SIZE.caption, color: '#a5b4fc', fontWeight: FONT_WEIGHT.medium, letterSpacing: '0.04em', lineHeight: 1 }}>J&amp;J SOURCING</div>
      </div>
    </div>
  )
}

export default function AppLayout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, user } = useAuth()
  const { isMobile, pagePadding } = useLayoutMetrics()
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => { setDrawerOpen(false) }, [location.pathname])

  const handleLogout = () => { logout(); navigate('/login') }

  const menuItems = allMenuItems
    .filter((item) => user?.pages?.includes(item.page))
    .map(({ page, ...rest }) => rest)

  const activeMenuKey = menuItems.find((item) => location.pathname.startsWith(item.key))?.key ?? location.pathname

  const navigation = (showBrand) => (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {showBrand && <Brand />}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Menu
          mode="inline"
          selectedKeys={[activeMenuKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ border: 'none', fontSize: FONT_SIZE.base }}
        />
      </div>
      <div style={{ padding: `${SPACE.xs}px ${SPACE.md}px`, borderTop: '1px solid #f0f0f0', flexShrink: 0 }}>
        <Menu
          mode="inline"
          style={{ border: 'none' }}
          items={[{ key: 'logout', icon: <LogoutOutlined />, label: 'Logout', danger: true }]}
          onClick={handleLogout}
        />
      </div>
    </div>
  )

  return (
    <Layout style={{ height: '100vh' }}>
      {!isMobile && (
        <Sider width={220} style={{ background: '#fff', borderRight: '1px solid #f0f0f0', overflow: 'hidden' }}>
          {navigation(true)}
        </Sider>
      )}

      {isMobile && (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={260}
          closable={false}
          styles={{ body: { padding: 0 } }}
        >
          {navigation(true)}
        </Drawer>
      )}

      <Layout style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Header style={{ background: '#fff', padding: `0 ${pagePadding}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', flexShrink: 0, gap: SPACE.sm }}>
          {isMobile ? (
            <Button
              type="text"
              icon={<MenuOutlined style={{ fontSize: FONT_SIZE.heading }} />}
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation menu"
              style={{ width: 44, height: 44 }}
            />
          ) : <span />}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? SPACE.sm : SPACE.lg, minWidth: 0 }}>
            <Badge count={0}><BellOutlined style={{ fontSize: FONT_SIZE.heading }} /></Badge>
            <Avatar icon={<UserOutlined />} style={{ background: INK.brand, flexShrink: 0 }} />
            {!isMobile && <span style={{ fontWeight: FONT_WEIGHT.medium }}>{user?.username}</span>}
          </div>
        </Header>
        <Content style={{ flex: 1, overflow: 'auto', padding: pagePadding, background: '#f5f6fa' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}
