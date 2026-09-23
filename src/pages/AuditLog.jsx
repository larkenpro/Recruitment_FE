import { useState } from 'react'
import { Card, Table, Tag, Input, Select, DatePicker, Switch, Space, Typography, Button } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { getAuditLog } from '../api/audit'
import { SPACE, TEXT } from '../theme'

const { RangePicker } = DatePicker

const METHODS = ['POST', 'PUT', 'PATCH', 'DELETE', 'GET']

const statusColour = (status) => (status >= 500 ? 'red' : status >= 400 ? 'orange' : 'green')
const methodColour = (method) => (method === 'DELETE' ? 'red' : method === 'POST' ? 'blue' : 'default')

export default function AuditLog() {
  const [filters, setFilters] = useState({ username: '', method: undefined, path: '', failuresOnly: false })
  const [range, setRange] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // Server-side paging: unlike the other tables in this app, audit_log grows without bound
  // and can't be pulled down in full and filtered in the browser.
  const params = {
    page: page - 1,
    size: pageSize,
    ...(filters.username && { username: filters.username }),
    ...(filters.method && { method: filters.method }),
    ...(filters.path && { path: filters.path }),
    ...(filters.failuresOnly && { failuresOnly: true }),
    ...(range?.[0] && { from: range[0].startOf('minute').format('YYYY-MM-DDTHH:mm:ss') }),
    ...(range?.[1] && { to: range[1].endOf('minute').format('YYYY-MM-DDTHH:mm:ss') }),
  }

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['auditLog', params],
    queryFn: () => getAuditLog(params).then((res) => res.data.data),
    placeholderData: keepPreviousData,
  })

  const update = (patch) => {
    setFilters((prev) => ({ ...prev, ...patch }))
    setPage(1)
  }

  const columns = [
    {
      title: 'When',
      dataIndex: 'occurredAt',
      width: 170,
      render: (value) => dayjs(value).format('DD MMM YYYY, HH:mm:ss'),
    },
    { title: 'User', dataIndex: 'username', width: 140, render: (value) => value || <Tag>anonymous</Tag> },
    {
      title: 'Method',
      dataIndex: 'method',
      width: 100,
      render: (value) => <Tag color={methodColour(value)}>{value}</Tag>,
    },
    { title: 'Path', dataIndex: 'path', ellipsis: true },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: (value, row) => (
        <Tag color={statusColour(value)}>{value}{row.errorCode ? ` ${row.errorCode}` : ''}</Tag>
      ),
    },
    { title: 'Took', dataIndex: 'durationMs', width: 90, render: (value) => `${value} ms` },
    { title: 'IP', dataIndex: 'ip', width: 130 },
    {
      title: 'Request ID',
      dataIndex: 'requestId',
      width: 110,
      render: (value) => <Typography.Text code copyable>{value}</Typography.Text>,
    },
  ]

  return (
    <div>
      <div style={{ ...TEXT.pageTitle, marginBottom: SPACE.md }}>Audit Log</div>

      <Card size="small" style={{ marginBottom: SPACE.md }}>
        <Space wrap size={SPACE.sm}>
          <Input
            placeholder="Username"
            allowClear
            style={{ width: 180 }}
            value={filters.username}
            onChange={(e) => update({ username: e.target.value })}
          />
          <Input
            placeholder="Path contains"
            allowClear
            style={{ width: 220 }}
            value={filters.path}
            onChange={(e) => update({ path: e.target.value })}
          />
          <Select
            placeholder="Method"
            allowClear
            style={{ width: 130 }}
            value={filters.method}
            onChange={(value) => update({ method: value })}
            options={METHODS.map((m) => ({ value: m, label: m }))}
          />
          <RangePicker showTime value={range} onChange={(value) => { setRange(value); setPage(1) }} />
          <Space size={SPACE.xxs}>
            <Switch checked={filters.failuresOnly} onChange={(value) => update({ failuresOnly: value })} />
            <span>Failures only</span>
          </Space>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>Refresh</Button>
        </Space>
      </Card>

      <Table
        rowKey="id"
        dataSource={data?.content ?? []}
        columns={columns}
        loading={isFetching}
        size="small"
        scroll={{ x: 'max-content' }}
        pagination={{
          current: page,
          pageSize,
          total: data?.totalElements ?? 0,
          showSizeChanger: true,
          pageSizeOptions: [25, 50, 100],
          showTotal: (total) => `${total} recorded requests`,
          onChange: (nextPage, nextSize) => { setPage(nextPage); setPageSize(nextSize) },
        }}
      />
    </div>
  )
}
