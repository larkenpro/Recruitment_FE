import { Children } from 'react'
import { Divider, Space, Typography } from 'antd'
import { FONT_SIZE, SPACE } from '../theme'

// Related controls under a small caption, e.g. Bulk edit or Filter.
export function ToolGroup({ label, children }) {
  return (
    <Space size={SPACE.xs} wrap>
      {label && <Typography.Text type="secondary" style={{ fontSize: FONT_SIZE.small }}>{label}</Typography.Text>}
      {children}
    </Space>
  )
}

// A table's toolbar: its groups of actions, set apart by dividers, then the table's own tools (columns, download).
export default function TableToolbar({ children, tools }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: SPACE.sm, marginBottom: SPACE.sm }}>
      <Space wrap separator={<Divider orientation="vertical" />}>{Children.toArray(children)}</Space>
      <div style={{ marginLeft: 'auto' }}>
        <ToolGroup label="Table">
          <Space.Compact size="small">{tools}</Space.Compact>
        </ToolGroup>
      </div>
    </div>
  )
}
