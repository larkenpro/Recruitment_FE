import { Select, Tag, Space } from 'antd'
import { FilterOutlined } from '@ant-design/icons'

/**
 * A row of column-filter dropdowns + removable bubble-tag chips for active filters.
 *
 * Props
 * ─────
 * filterKeys  Array<{ key, label }>           column descriptors
 * optionMap   { [key]: [{ value, label }] }   unique values per column
 * filters     { [key]: string }               currently active filters
 * setFilter   (key, value | null) => void
 * removeFilter (key) => void
 */
export default function FilterBar({ filterKeys, optionMap, filters, setFilter, removeFilter }) {
  const activeTags = Object.entries(filters)

  return (
    <div style={{ marginBottom: 16 }}>
      <Space wrap>
        {filterKeys.map(({ key, label }) => (
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
        ))}
      </Space>

      {activeTags.length > 0 && (
        <Space wrap style={{ marginTop: 8 }}>
          {activeTags.map(([key, value]) => {
            const label = filterKeys.find(f => f.key === key)?.label ?? key
            return (
              <Tag
                key={key}
                closable
                onClose={() => removeFilter(key)}
                color="blue"
                style={{ borderRadius: 999, padding: '2px 12px', fontSize: 13 }}
              >
                {label}: {value}
              </Tag>
            )
          })}
        </Space>
      )}
    </div>
  )
}
