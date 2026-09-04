import { useState } from 'react'
import {
  Card, Tabs, Table, Button, Modal, Form, Input, Select, Switch, Tag,
  Checkbox, Popconfirm, message,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getUsers, createUser, updateUser, setUserEnabled, deleteUser, resetUserPassword,
} from '../api/users'
import { getRoles, getRolePages, createRole, updateRole, deleteRole } from '../api/roles'

const errorMessage = (err, fallback) => err.response?.data?.message || `${fallback} (${err.response?.status ?? 'network error'})`

function UsersTab() {
  const queryClient = useQueryClient()
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [passwordModalUser, setPasswordModalUser] = useState(null)
  const [userForm] = Form.useForm()
  const [passwordForm] = Form.useForm()

  const { data: users, isLoading: usersLoading } = useQuery({ queryKey: ['users'], queryFn: () => getUsers().then(r => r.data.data) })
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: () => getRoles().then(r => r.data.data) })

  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: ['users'] })

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => { invalidateUsers(); closeUserModal(); message.success('User created!') },
    onError: (err) => message.error(errorMessage(err, 'Failed to create user')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateUser(id, data),
    onSuccess: () => { invalidateUsers(); closeUserModal(); message.success('User updated!') },
    onError: (err) => message.error(errorMessage(err, 'Failed to update user')),
  })

  const enabledMutation = useMutation({
    mutationFn: ({ id, enabled }) => setUserEnabled(id, enabled),
    onSuccess: invalidateUsers,
    onError: (err) => message.error(errorMessage(err, 'Failed to update status')),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => { invalidateUsers(); message.success('User deleted!') },
    onError: (err) => message.error(errorMessage(err, 'Failed to delete user')),
  })

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, newPassword }) => resetUserPassword(id, newPassword),
    onSuccess: () => { setPasswordModalUser(null); passwordForm.resetFields(); message.success('Password reset!') },
    onError: (err) => message.error(errorMessage(err, 'Failed to reset password')),
  })

  const openAdd = () => { setEditingUser(null); userForm.resetFields(); setUserModalOpen(true) }
  const openEdit = (record) => {
    setEditingUser(record)
    userForm.setFieldsValue({ email: record.email, roleIds: record.roles.map(r => r.id) })
    setUserModalOpen(true)
  }
  const closeUserModal = () => { setUserModalOpen(false); setEditingUser(null); userForm.resetFields() }

  const handleUserOk = () => userForm.validateFields().then(values => {
    if (editingUser) updateMutation.mutate({ id: editingUser.id, data: values })
    else createMutation.mutate(values)
  })

  const handlePasswordOk = () => passwordForm.validateFields().then(values => {
    resetPasswordMutation.mutate({ id: passwordModalUser.id, newPassword: values.newPassword })
  })

  const roleOptions = (roles || []).map(r => ({ value: r.id, label: r.name }))

  const columns = [
    { title: '#', dataIndex: 'id', width: 60 },
    { title: 'Username', dataIndex: 'username', render: t => <strong>{t}</strong> },
    { title: 'Email', dataIndex: 'email' },
    {
      title: 'Roles', dataIndex: 'roles',
      render: (roles) => roles.map(r => <Tag key={r.id} color={r.protectedRole ? 'red' : 'blue'}>{r.name}</Tag>),
    },
    {
      title: 'Enabled', dataIndex: 'enabled', width: 100,
      render: (enabled, record) => (
        <Switch checked={enabled} onChange={(checked) => enabledMutation.mutate({ id: record.id, enabled: checked })} />
      ),
    },
    {
      title: 'Actions', width: 140,
      render: (_, record) => (
        <>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
          <Button icon={<KeyOutlined />} size="small" style={{ marginLeft: 8 }} onClick={() => setPasswordModalUser(record)} />
          <Popconfirm title="Delete this user?" onConfirm={() => deleteMutation.mutate(record.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger style={{ marginLeft: 8 }} />
          </Popconfirm>
        </>
      ),
    },
  ]

  return (
    <Card
      title="Users"
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Add User</Button>}
      bordered={false} style={{ borderRadius: 12 }}
    >
      <Table dataSource={users} columns={columns} rowKey="id" loading={usersLoading} />

      <Modal
        title={editingUser ? 'Edit User' : 'Add User'}
        open={userModalOpen}
        onCancel={closeUserModal}
        onOk={handleUserOk}
        okText="Save"
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={userForm} layout="vertical">
          {!editingUser && (
            <Form.Item name="username" label="Username" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          )}
          <Form.Item name="email" label="Email" rules={[{ required: true }, { type: 'email', message: 'Enter a valid email' }]}>
            <Input />
          </Form.Item>
          {!editingUser && (
            <Form.Item name="password" label="Password" rules={[{ required: true }, { min: 8, message: 'At least 8 characters' }]}>
              <Input.Password />
            </Form.Item>
          )}
          <Form.Item name="roleIds" label="Roles" rules={[{ required: true, message: 'Select at least one role' }]}>
            <Select mode="multiple" options={roleOptions} placeholder="Select roles" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Reset password for ${passwordModalUser?.username ?? ''}`}
        open={!!passwordModalUser}
        onCancel={() => { setPasswordModalUser(null); passwordForm.resetFields() }}
        onOk={handlePasswordOk}
        okText="Reset"
        confirmLoading={resetPasswordMutation.isPending}
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item name="newPassword" label="New Password" rules={[{ required: true }, { min: 8, message: 'At least 8 characters' }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

function RolesTab() {
  const queryClient = useQueryClient()
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState(null)
  const [roleForm] = Form.useForm()

  const { data: roles, isLoading: rolesLoading } = useQuery({ queryKey: ['roles'], queryFn: () => getRoles().then(r => r.data.data) })
  const { data: pageOptions } = useQuery({ queryKey: ['rolePages'], queryFn: () => getRolePages().then(r => r.data.data) })

  const invalidateRoles = () => queryClient.invalidateQueries({ queryKey: ['roles'] })

  const createMutation = useMutation({
    mutationFn: createRole,
    onSuccess: () => { invalidateRoles(); closeRoleModal(); message.success('Role created!') },
    onError: (err) => message.error(errorMessage(err, 'Failed to create role')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateRole(id, data),
    onSuccess: () => { invalidateRoles(); closeRoleModal(); message.success('Role updated!') },
    onError: (err) => message.error(errorMessage(err, 'Failed to update role')),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteRole,
    onSuccess: () => { invalidateRoles(); message.success('Role deleted!') },
    onError: (err) => message.error(errorMessage(err, 'Failed to delete role')),
  })

  const openAdd = () => { setEditingRole(null); roleForm.resetFields(); setRoleModalOpen(true) }
  const openEdit = (record) => {
    setEditingRole(record)
    roleForm.setFieldsValue({ name: record.name, pages: record.pages })
    setRoleModalOpen(true)
  }
  const closeRoleModal = () => { setRoleModalOpen(false); setEditingRole(null); roleForm.resetFields() }

  const handleRoleOk = () => roleForm.validateFields().then(values => {
    if (editingRole) updateMutation.mutate({ id: editingRole.id, data: values })
    else createMutation.mutate(values)
  })

  const columns = [
    { title: '#', dataIndex: 'id', width: 60 },
    { title: 'Name', dataIndex: 'name', render: (t, r) => <strong>{t}{r.protectedRole ? ' (protected)' : ''}</strong> },
    {
      title: 'Pages', dataIndex: 'pages',
      render: (pages) => pages.map(p => <Tag key={p}>{p}</Tag>),
    },
    {
      title: 'Actions', width: 100,
      render: (_, record) => (
        <>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
          <Popconfirm
            title={record.protectedRole ? 'The ADMIN role cannot be deleted' : 'Delete this role?'}
            onConfirm={() => !record.protectedRole && deleteMutation.mutate(record.id)}
            disabled={record.protectedRole}
          >
            <Button icon={<DeleteOutlined />} size="small" danger disabled={record.protectedRole} style={{ marginLeft: 8 }} />
          </Popconfirm>
        </>
      ),
    },
  ]

  return (
    <Card
      title="Roles"
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Add Role</Button>}
      bordered={false} style={{ borderRadius: 12 }}
    >
      <Table dataSource={roles} columns={columns} rowKey="id" loading={rolesLoading} />

      <Modal
        title={editingRole ? 'Edit Role' : 'Add Role'}
        open={roleModalOpen}
        onCancel={closeRoleModal}
        onOk={handleRoleOk}
        okText="Save"
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={roleForm} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input disabled={editingRole?.protectedRole} />
          </Form.Item>
          <Form.Item name="pages" label="Pages" rules={[{ required: true, message: 'Select at least one page' }]}>
            <Checkbox.Group
              disabled={editingRole?.protectedRole}
              options={(pageOptions || []).map(p => ({ value: p.key, label: p.label }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

export default function UserManagement() {
  return (
    <Tabs
      defaultActiveKey="users"
      items={[
        { key: 'users', label: 'Users', children: <UsersTab /> },
        { key: 'roles', label: 'Roles', children: <RolesTab /> },
      ]}
    />
  )
}
