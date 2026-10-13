import { Button, Checkbox, Space, Tag } from 'antd'
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons'
import { preferenceKey } from '../utils/preferences'

// Tick the (position, type) pairs to apply for and rank them; only ticked pairs get a rank.
export default function PreferenceRanker({ ranked, selected, onChange }) {
  const move = (index, dir) => {
    const next = index + dir
    if (next < 0 || next >= ranked.length) return
    const updated = [...ranked]
    ;[updated[index], updated[next]] = [updated[next], updated[index]]
    onChange(updated, selected)
  }

  const toggle = (key, checked) => {
    const next = new Set(selected)
    if (checked) next.add(key)
    else next.delete(key)
    onChange(ranked, next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {ranked.map((pair, index) => {
        const key = preferenceKey(pair)
        const isSelected = selected.has(key)
        const rank = ranked.slice(0, index + 1).filter((p) => selected.has(preferenceKey(p))).length
        return (
          <div
            key={key}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, background: isSelected ? '#fff' : '#fafafa' }}
          >
            <Checkbox
              checked={isSelected}
              onChange={(e) => toggle(key, e.target.checked)}
              aria-label={`Apply for ${pair.position.title} as ${pair.type.name}`}
            />
            <Tag style={{ fontWeight: 600, minWidth: 36, textAlign: 'center', flexShrink: 0 }}>{isSelected ? rank : '—'}</Tag>
            <span style={{ fontWeight: 500, color: isSelected ? '#1e1b4b' : '#9ca3af', fontSize: 14, flex: 1 }}>
              {pair.position.title}
              <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>— {pair.type.name}</span>
            </span>
            <Space size={4}>
              <Button size="small" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move up" />
              <Button size="small" icon={<ArrowDownOutlined />} disabled={index === ranked.length - 1} onClick={() => move(index, 1)} aria-label="Move down" />
            </Space>
          </div>
        )
      })}
    </div>
  )
}
