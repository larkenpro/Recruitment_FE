import { Select, Tag, Space, InputNumber, Input } from 'antd'
import { FilterOutlined, SearchOutlined } from '@ant-design/icons'

export default function FilterBar({ filterKeys, optionMap, filters, setFilter, removeFilter }) {
  const activeTags = Object.entries(filters)

  return (
    <div style={{ marginBottom: 16 }}>
      <Space wrap>
        {filterKeys.map(({ key, label, type }) => {
          if (type === 'text') {
            return (
              <Input
                key={key}
                placeholder={`Search ${label}`}
                size="small"
                style={{ width: 180 }}
                allowClear
                prefix={<SearchOutlined style={{ color: '#bbb' }} />}
                value={filters[key] ?? ''}
                onChange={e => setFilter(key, e.target.value || null)}
              />
            )
          }

          if (type === 'min' || type === 'max') {
            const prefix = type === 'min' ? '≥' : '≤'
            return (
              <Space key={key} size={4}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>{label} {prefix}</span>
                <InputNumber
                  placeholder={label}
                  size="small"
                  style={{ width: 90 }}
                  value={filters[key] ?? null}
                  onChange={val => setFilter(key, val ?? null)}
                />
              </Space>
            )
          }

          return (
            <Select
              key={key}
              placeholder={`Filter by ${label}`}
              style={{ minWidth: 160 }}
              allowClear
              value={filters[key] ?? null}
              options={optionMap[key] ?? []}
              onChange={val => setFilter(key, val ?? null)}
              suffixIcon={<FilterOutlined style={{ pointerEvents: 'none' }} />}
            />
          )
        })}
      </Space>

      {activeTags.length > 0 && (
        <Space wrap style={{ marginTop: 8 }}>
          {activeTags.map(([key, value]) => {
            const filterDef = filterKeys.find(f => f.key === key)
            const label = filterDef?.label ?? key
            const prefix = filterDef?.type === 'min' ? '≥' : filterDef?.type === 'max' ? '≤' : null
            return (
              <Tag
                key={key}
                closable
                onClose={() => removeFilter(key)}
                color="blue"
                style={{ borderRadius: 999, padding: '2px 12px', fontSize: 13 }}
              >
                {label}: {prefix ? `${prefix} ${value}` : value}
              </Tag>
            )
          })}
        </Space>
      )}
    </div>
  )
}
