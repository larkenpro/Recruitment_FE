import { useState, useMemo } from 'react'

/**
 * filterKeys entry shapes:
 *   { key, label, getVal }               — dropdown (exact string match)
 *   { key, label, type: 'min', getVal }  — single value, row >= value
 *   { key, label, type: 'max', getVal }  — single value, row <= value
 */
export function useColumnFilter(data, filterKeys) {
  const [filters, setFilters] = useState({})

  const setFilter = (key, value) => {
    setFilters(prev => {
      if (value == null) {
        const next = { ...prev }
        delete next[key]
        return next
      }
      return { ...prev, [key]: value }
    })
  }

  const removeFilter = (key) => {
    setFilters(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filteredData = useMemo(() => {
    if (!data) return []
    return data.filter(row =>
      filterKeys.every(({ key, type, getVal }) => {
        const val = getVal(row)
        if (type === 'min') return filters[key] == null || (val != null && val >= filters[key])
        if (type === 'max') return filters[key] == null || (val != null && val <= filters[key])
        return filters[key] == null || String(val ?? '') === filters[key]
      })
    )
  }, [data, filters])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const optionMap = useMemo(() => {
    if (!data) return {}
    return Object.fromEntries(
      filterKeys
        .filter(({ type }) => !type)
        .map(({ key, getVal }) => [
          key,
          [...new Set(data.map(row => getVal(row)).filter(v => v != null && v !== ''))]
            .sort((a, b) => String(a).localeCompare(String(b)))
            .map(v => ({ value: String(v), label: String(v) }))
        ])
    )
  }, [data])

  return { filteredData, filters, setFilter, removeFilter, optionMap }
}
