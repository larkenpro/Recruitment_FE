import { useState } from 'react'
import { Button, Checkbox, Popover } from 'antd'
import { HolderOutlined, SettingOutlined } from '@ant-design/icons'
import { placeKey, resolveChoice, saveChoice, toggleKey } from '../utils/columns'

// Bumped when the saved shape or tables' column keys change; v3 saves { shown, seen } per table.
const STORAGE_KEY = 'tableColumns.v3'
const ACCENT = '#4f46e5'

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}
  } catch {
    return {}
  }
}

/**
 * Which columns each table shows and in what order, remembered per browser.
 * `columnsFor(table, columns, defaults)` returns `{ shown, picker }`: the chosen columns in the chosen
 * order, and the button whose list shows, hides and reorders them. Columns move by dragging — a header
 * onto another header, or a row of the list — and land before or after the target, wherever the line
 * shows; the list's handles also move them with the arrow keys. A column is known by its `key`, else
 * its title; `defaults` (every column, in order, if left out) are shown until someone picks.
 */
export function useColumnChoice() {
  const [choice, setChoice] = useState(load)
  // Where a dragged column would land: { table, key, after }.
  const [dropAt, setDropAt] = useState(null)
  const [dragging, setDragging] = useState(null)

  const save = (table, shown, columnKeys) => {
    const next = { ...choice, [table]: saveChoice(choice[table], shown, columnKeys) }
    setChoice(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // private window or blocked storage: the choice just won't outlive the page
    }
  }

  const endDrag = () => {
    setDragging(null)
    setDropAt(null)
  }

  return (table, columns, defaults) => {
    const keyOf = (c) => c.key ?? c.title
    const byKey = Object.fromEntries(columns.map((c) => [keyOf(c), c]))
    const chosen = resolveChoice(choice[table], defaults ?? columns.map(keyOf))
    const choose = (_, keys) => save(table, keys, columns.map(keyOf))
    // A saved key whose column isn't there right now (e.g. still loading) keeps its place.
    const visible = chosen.filter((k) => byKey[k])
    const hidden = columns.map(keyOf).filter((k) => !chosen.includes(k))
    const hint = (key) => (dropAt?.table === table && dropAt.key === key ? dropAt : null)

    // `horizontal`: headers split left/right of their middle, list rows above/below.
    const dragProps = (key, horizontal) => ({
      draggable: true,
      onDragStart: (e) => {
        e.dataTransfer.setData('text/plain', `${table}|${key}`)
        e.dataTransfer.effectAllowed = 'move'
        setDragging({ table, key })
      },
      onDragOver: (e) => {
        if (dragging?.table !== table) return
        e.preventDefault()
        const box = e.currentTarget.getBoundingClientRect()
        const after = horizontal ? e.clientX > box.left + box.width / 2 : e.clientY > box.top + box.height / 2
        const current = hint(key)
        if (!current || current.after !== after) setDropAt({ table, key, after })
      },
      onDrop: (e) => {
        e.preventDefault()
        const [fromTable, from] = e.dataTransfer.getData('text/plain').split('|')
        const at = hint(key)
        if (fromTable === table && at) choose(table, placeKey(chosen, from, key, at.after))
        endDrag()
      },
      onDragEnd: endDrag,
    })

    const isDragged = (key) => dragging?.table === table && dragging.key === key

    const headerCell = (key) => {
      const at = hint(key)
      return {
        ...dragProps(key, true),
        title: 'Drag to move this column',
        style: {
          cursor: 'grab',
          opacity: isDragged(key) ? 0.4 : 1,
          boxShadow: at ? `inset ${at.after ? -3 : 3}px 0 0 ${ACCENT}` : undefined,
        },
      }
    }

    const keyboardMove = (e, key) => {
      const at = visible.indexOf(key)
      if (e.key === 'ArrowUp' && at > 0) choose(table, placeKey(chosen, key, visible[at - 1], false))
      else if (e.key === 'ArrowDown' && at < visible.length - 1) choose(table, placeKey(chosen, key, visible[at + 1], true))
      else return
      e.preventDefault()
    }

    const shownRow = (key) => {
      const at = hint(key)
      return (
        <div
          key={key}
          {...dragProps(key, false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '2px 4px',
            borderRadius: 4,
            cursor: 'grab',
            opacity: isDragged(key) ? 0.4 : 1,
            boxShadow: at ? `0 ${at.after ? 2 : -2}px 0 ${ACCENT}` : undefined,
          }}
        >
          <Button
            size="small"
            type="text"
            icon={<HolderOutlined />}
            aria-label={`Move ${byKey[key].title}: drag, or press the up and down arrow keys`}
            style={{ cursor: 'grab' }}
            onKeyDown={(e) => keyboardMove(e, key)}
          />
          <Checkbox checked onChange={() => choose(table, toggleKey(chosen, key))}>{byKey[key].title}</Checkbox>
        </div>
      )
    }

    const hiddenRow = (key) => (
      <div key={key} style={{ padding: '2px 4px 2px 34px' }}>
        <Checkbox checked={false} onChange={() => choose(table, toggleKey(chosen, key))}>{byKey[key].title}</Checkbox>
      </div>
    )

    return {
      shown: visible.map((k) => ({ ...byKey[k], onHeaderCell: () => headerCell(k) })),
      picker: (
        <Popover
          trigger="click"
          placement="bottomRight"
          content={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 220 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                Drag to reorder — here or by the column headers
              </div>
              {visible.map(shownRow)}
              {hidden.length > 0 && <div style={{ borderTop: '1px solid #f0f0f0', margin: '4px 0' }} />}
              {hidden.map(hiddenRow)}
            </div>
          }
        >
          <Button size="small" icon={<SettingOutlined />}>Columns</Button>
        </Popover>
      ),
    }
  }
}
