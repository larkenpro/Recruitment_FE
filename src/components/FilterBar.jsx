import { Select, Tag, Space, InputNumber, Input } from 'antd'
import { FilterOutlined, SearchOutlined } from '@ant-design/icons'
import { SPACE, FONT_SIZE, INK, RADIUS, useLayoutMetrics } from '../theme'

export default function FilterBar({ filterKeys, optionMap, filters, setFilter, removeFilter }) {
  const activeTags = Object.entries(filters)
  // Fixed control widths leave ragged half-empty rows on a phone; stack them full-width instead.
  const { isNarrow: isMobile } = useLayoutMetrics()
  const controlWidth = (desktop) => (isMobile ? '100%' : desktop)

  return (
    <div style={{ marginBottom: SPACE.md }}>
      <Space wrap style={{ width: '100%' }} styles={{ item: isMobile ? { width: '100%' } : undefined }}>
        {filterKeys.map(({ key, label, type }) => {
          if (type === 'text') {
            return (
              <Input
                key={key}
                placeholder={`Search ${label}`}
                size="small"
                style={{ width: controlWidth(180) }}
                allowClear
                prefix={<SearchOutlined style={{ color: INK.faint }} />}
                value={filters[key] ?? ''}
                onChange={e => setFilter(key, e.target.value || null)}
              />
            )
          }

          if (type === 'min' || type === 'max') {
            const prefix = type === 'min' ? '≥' : '≤'
            return (
              <Space key={key} size={4} style={{ width: isMobile ? '100%' : undefined }}>
                <span style={{ fontSize: FONT_SIZE.small, color: INK.muted, whiteSpace: 'nowrap' }}>{label} {prefix}</span>
                <InputNumber
                  placeholder={label}
                  size="small"
                  style={{ width: controlWidth(90) }}
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
              size="small"
              style={isMobile ? { width: '100%' } : { minWidth: 160 }}
              allowClear
              value={filters[key] ?? null}
              options={optionMap[key] ?? []}
              onChange={val => setFilter(key, val ?? null)}
              suffixIcon={<FilterOutlined style={{ pointerEvents: 'none', color: INK.faint }} />}
            />
          )
        })}
      </Space>

      {activeTags.length > 0 && (
        <Space wrap style={{ marginTop: SPACE.xs }}>
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
                style={{ borderRadius: RADIUS.pill, padding: `2px ${SPACE.sm}px`, fontSize: FONT_SIZE.body }}
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
