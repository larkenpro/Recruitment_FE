import { Form, Input, Button, Card, Typography, Alert } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

const { Title, Text } = Typography

export default function Login() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { loginUser } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (values) => {
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/login', values)
      loginUser(res.data.data)
      navigate('/colleges')
    } catch {
      setError('Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Card style={{ width: 400, borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }} bordered={false}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🎯</div>
          <Title level={3} style={{ margin: 0, color: '#4f46e5' }}>Recruitment App</Title>
          <Text type="secondary">Sign in to your account</Text>
        </div>
        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="username" rules={[{ required: true }]}>
            <Input prefix={<UserOutlined />} placeholder="Username" size="large" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={loading}>
            Sign In
          </Button>
        </Form>
      </Card>
    </div>
  )
}
