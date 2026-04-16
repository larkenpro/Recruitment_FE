import { useState, useMemo } from 'react'

/**
 * Drives column-based filtering for a table.
 *
 * @param {Array}  data        - raw array of rows (may be undefined while loading)
 * @param {Array<{ key: string, label: string, getVal: (row) => any }>} filterKeys
 *   - defined as a module-level constant in each consuming component so the
 *     reference is stable and omitting it from the useMemo dep array is safe.
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

  // filterKeys is a stable module-level constant in every caller — safe to omit
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filteredData = useMemo(() => {
    if (!data) return []
    return data.filter(row =>
      filterKeys.every(({ key, getVal }) =>
        filters[key] == null || String(getVal(row) ?? '') === filters[key]
      )
    )
  }, [data, filters])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const optionMap = useMemo(() => {
    if (!data) return {}
    return Object.fromEntries(
      filterKeys.map(({ key, getVal }) => [
        key,
        [...new Set(data.map(row => getVal(row)).filter(v => v != null && v !== ''))]
          .sort((a, b) => String(a).localeCompare(String(b)))
          .map(v => ({ value: String(v), label: String(v) }))
      ])
    )
  }, [data])

  return { filteredData, filters, setFilter, removeFilter, optionMap }
}
