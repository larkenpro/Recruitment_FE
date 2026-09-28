import { Form, Input, Button, Card, Typography, message } from 'antd'
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import { getErrorMessage } from '../utils/errorUtils'

const { Title, Text } = Typography

// Also rendered at /reset-password?token=... (the emailed link), where it shows the new-password form.
export default function Login() {
  const [loading, setLoading] = useState(false)
  const [forgot, setForgot] = useState(false)
  const [searchParams] = useSearchParams()
  const resetToken = searchParams.get('token')
  const { loginUser } = useAuth()
  const navigate = useNavigate()

  const submit = (request) => async (values) => {
    setLoading(true)
    try {
      await request(values)
    } catch (err) {
      message.error(getErrorMessage(err, `Request failed (${err.response?.status ?? 'network error'})`))
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = submit(async (values) => {
    const res = await api.post('/auth/login', values)
    loginUser(res.data.data)
    navigate('/colleges')
  })

  const handleForgot = submit(async ({ email }) => {
    const res = await api.post('/auth/forgot-password', { email: email.trim() })
    message.success(res.data.message, 6)
    setForgot(false)
  })

  const handleReset = submit(async ({ newPassword }) => {
    await api.post('/auth/reset-password', { token: resetToken, newPassword })
    message.success('Password reset — sign in with your new password')
    navigate('/login', { replace: true })
  })

  const backToLogin = (
    <Button type="link" block onClick={() => (resetToken ? navigate('/login', { replace: true }) : setForgot(false))}>
      Back to sign in
    </Button>
  )

  let subtitle, form
  if (resetToken) {
    subtitle = 'Choose a new password'
    form = (
      <Form layout="vertical" onFinish={handleReset}>
        <Form.Item name="newPassword" rules={[{ required: true }, { min: 8, message: 'Password must be at least 8 characters' }]}>
          <Input.Password prefix={<LockOutlined />} placeholder="New password" size="large" autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirm"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: 'Please confirm your password' },
            ({ getFieldValue }) => ({
              validator: (_, value) =>
                !value || getFieldValue('newPassword') === value ? Promise.resolve() : Promise.reject(new Error('Passwords do not match')),
            }),
          ]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="Confirm new password" size="large" autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block size="large" loading={loading}>
          Reset Password
        </Button>
        {backToLogin}
      </Form>
    )
  } else if (forgot) {
    subtitle = "Enter your account's email and we'll send you a reset link"
    form = (
      <Form layout="vertical" onFinish={handleForgot}>
        <Form.Item name="email" rules={[{ required: true }, { type: 'email', message: 'Enter a valid email' }]}>
          <Input prefix={<MailOutlined />} placeholder="Email" size="large" autoComplete="email" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block size="large" loading={loading}>
          Send Reset Link
        </Button>
        {backToLogin}
      </Form>
    )
  } else {
    subtitle = 'Sign in to your account'
    form = (
      <Form layout="vertical" onFinish={handleLogin}>
        <Form.Item name="username" rules={[{ required: true }]}>
          <Input prefix={<UserOutlined />} placeholder="Username" size="large" />
        </Form.Item>
        <Form.Item name="password" rules={[{ required: true }]} style={{ marginBottom: 8 }}>
          <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
        </Form.Item>
        <div style={{ textAlign: 'right', marginBottom: 16 }}>
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setForgot(true)}>
            Forgot password?
          </Button>
        </div>
        <Button type="primary" htmlType="submit" block size="large" loading={loading}>
          Sign In
        </Button>
      </Form>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Card style={{ width: '100%', maxWidth: 400, borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }} bordered={false}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🎯</div>
          <Title level={3} style={{ margin: 0, color: '#4f46e5' }}>Recruitment App</Title>
          <Text type="secondary">{subtitle}</Text>
        </div>
        {form}
      </Card>
    </div>
  )
}
