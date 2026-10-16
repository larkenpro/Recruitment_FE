// A table's column choice is the visible column keys in display order.

// The label a dropdown shows for a stored value, for exports.
export const labelFor = (options, value) => options.find((o) => o.value === value)?.label ?? value ?? null

// Puts `from` just before `to`, or just after it; anything not in the list leaves it unchanged.
export const placeKey = (keys, from, to, after) => {
  if (from === to || !keys.includes(from) || !keys.includes(to)) return keys
  const rest = keys.filter((k) => k !== from)
  const at = rest.indexOf(to) + (after ? 1 : 0)
  return [...rest.slice(0, at), from, ...rest.slice(at)]
}

// Shows a hidden column at the end, or hides a shown one.
export const toggleKey = (keys, key) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key])

// A saved choice is { shown, seen }: the visible keys in order, and every column the table had when it
// was saved. A default column added since then wasn't there to be turned off, so it shows, at the end.
export const resolveChoice = (saved, defaults) =>
  saved ? [...saved.shown, ...defaults.filter((k) => !saved.seen.includes(k) && !saved.shown.includes(k))] : defaults

export const saveChoice = (saved, shown, columnKeys) => ({
  shown,
  seen: [...new Set([...(saved?.seen ?? []), ...columnKeys])],
})

// A table as it's laid out, for the Excel download: each shown column's title, and each row's cells as
// the page shows them — `exportValue(row)` when the column renders something richer than its data,
// else its `dataIndex`. Columns that only hold buttons say `noExport`. Empty cells are null.
export const tableToSheet = (columns, rows) => {
  const exported = columns.filter((c) => !c.noExport)
  const cell = (c, r) => {
    const value = c.exportValue ? c.exportValue(r) : c.dataIndex ? r[c.dataIndex] : null
    return value === undefined || value === '' ? null : value
  }
  return { columns: exported.map((c) => c.title), rows: rows.map((r) => exported.map((c) => cell(c, r))) }
}
