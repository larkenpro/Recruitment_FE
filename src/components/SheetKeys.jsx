import { useRef } from 'react'
import { message } from 'antd'
import { moveCell, parseTsv, toTsv } from '../utils/grid'

const ROW = 'tr.ant-table-row'
const TEXT_INPUT = 'input:not([type=checkbox]):not([role=combobox]), textarea'
const CONTROL = 'input:not([disabled]), textarea:not([disabled]), a[href], button:not([disabled])'
// An attribute, not a class: antd rewrites a cell's className as the mouse moves over its row.
const IN_RANGE = '[data-sheet-range]'
const MOVE_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']

const setInputValue = (input, value) => {
  const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  // Through the native setter, so React sees it as typing and the field's onChange runs.
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

/**
 * Makes the antd tables inside it work like a spreadsheet: arrows, Tab, Enter, Home/End and Ctrl move
 * between cells, continuing across the tables and pages; Enter or F2 opens a cell's control and typing
 * starts editing a cell's field; Shift+arrows or Shift+click select a range, Ctrl+C copies it for Excel
 * and Ctrl+V pastes into the fields below and beside the cell. A DOM layer, so columns need no changes.
 */
export default function SheetKeys({ children }) {
  const root = useRef(null)
  const anchor = useRef(null)

  const rows = () => [...root.current.querySelectorAll(ROW)]
  const posOf = (td) => ({ row: rows().indexOf(td.parentElement), col: td.cellIndex })
  const cellAt = ({ row, col }) => rows()[row]?.cells[col]
  const cellOf = (target) => {
    const td = target.closest?.('td')
    return td?.parentElement.matches(ROW) && root.current.contains(td) ? td : null
  }

  const paintRange = (from, to) => {
    root.current.querySelectorAll(IN_RANGE).forEach((td) => td.removeAttribute('data-sheet-range'))
    if (!from) return
    const all = rows()
    for (let r = Math.min(from.row, to.row); r <= Math.max(from.row, to.row); r++) {
      for (let c = Math.min(from.col, to.col); c <= Math.max(from.col, to.col); c++) {
        all[r]?.cells[c]?.setAttribute('data-sheet-range', '')
      }
    }
  }

  const focusCell = (td) => {
    td.tabIndex = -1
    td.focus()
  }

  const goTo = (pos, extend) => {
    const td = cellAt(pos)
    if (!td) return
    if (extend) {
      paintRange(anchor.current, pos)
    } else {
      anchor.current = pos
      paintRange(null)
    }
    focusCell(td)
  }

  // Past the last row or before the first, the table's pager takes over.
  const turnPage = (selector, pickRow) => {
    const pager = root.current.querySelector(selector)
    if (!pager || pager.getAttribute('aria-disabled') === 'true') return false
    const col = document.activeElement.closest('td')?.cellIndex ?? 0
    pager.querySelector('button')?.click()
    setTimeout(() => goTo({ row: pickRow(rows().length), col }), 50)
    return true
  }

  const move = (td, key, { shift = false, ctrl = false } = {}) => {
    const from = posOf(td)
    const next = moveCell(from, key, { rows: rows().length, cols: td.parentElement.cells.length, ctrl, shift })
    if (!next) return false
    const stuck = next.row === from.row && next.col === from.col
    if (stuck && (key === 'ArrowDown' || key === 'Enter') && !shift && turnPage('.ant-pagination-next', () => 0)) return true
    if (stuck && key === 'ArrowUp' && turnPage('.ant-pagination-prev', (n) => n - 1)) return true
    goTo(next, shift && key !== 'Tab' && key !== 'Enter')
    return true
  }

  const openControl = (td) => {
    const control = td.querySelector(CONTROL)
    if (!control) return false
    const select = control.closest('.ant-select')
    if (select) {
      control.focus()
      select.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    } else if (control.matches(TEXT_INPUT)) {
      control.focus()
      control.select()
    } else {
      control.click()
    }
    return true
  }

  const copyRange = () => {
    const marked = [...root.current.querySelectorAll(IN_RANGE)]
    const cells = marked.length > 0 ? marked : [document.activeElement]
    const byRow = new Map()
    cells.forEach((td) => {
      const input = td.querySelector(TEXT_INPUT)
      byRow.set(td.parentElement, [...(byRow.get(td.parentElement) ?? []), (input ? input.value : td.innerText).trim()])
    })
    navigator.clipboard.writeText(toTsv([...byRow.values()]))
    message.success(`Copied ${cells.length} cell${cells.length === 1 ? '' : 's'}`, 1)
  }

  const selectAll = (td) => {
    const lastRow = rows().length - 1
    anchor.current = { row: 0, col: 0 }
    paintRange(anchor.current, { row: lastRow, col: td.parentElement.cells.length - 1 })
  }

  const onKeyDown = (e) => {
    const td = cellOf(e.target)
    if (!td) return
    const { key, target } = e
    const handled = () => { e.preventDefault(); e.stopPropagation() }

    if (target !== td) {
      if (key === 'Escape' && !target.closest('.ant-select-open')) { handled(); focusCell(td); return }
      const select = target.closest('.ant-select')
      if (select) {
        if (select.classList.contains('ant-select-open')) {
          // A pick from a one-value list is finished; carry on from the cell, once the list has taken it.
          if (key === 'Enter' && !select.classList.contains('ant-select-multiple')) setTimeout(() => focusCell(td))
          return
        }
        if (key === 'Enter' || key === ' ') return
      } else if (target.matches(TEXT_INPUT)) {
        if (target.tagName === 'TEXTAREA' && key !== 'Tab') return
        const atStart = target.selectionStart === 0 && target.selectionEnd === 0
        const atEnd = target.selectionStart === target.value.length && target.selectionEnd === target.value.length
        if ((key === 'ArrowLeft' && !atStart) || (key === 'ArrowRight' && !atEnd)) return
      } else if (key === 'Enter') {
        return
      }
      const moves = MOVE_KEYS.includes(key) || key === 'Tab' || (key === 'Enter' && target.matches(TEXT_INPUT))
      if (moves && move(td, key, { shift: !MOVE_KEYS.includes(key) && e.shiftKey })) handled()
      return
    }

    const ctrl = e.ctrlKey || e.metaKey
    const modifiers = { shift: e.shiftKey, ctrl }
    if (ctrl && key.toLowerCase() === 'c') {
      if (!window.getSelection().toString()) { handled(); copyRange() }
    } else if (ctrl && key.toLowerCase() === 'a') {
      handled()
      selectAll(td)
    } else if (MOVE_KEYS.includes(key) || key === 'Tab' || key === 'Home' || key === 'End') {
      if (move(td, key, modifiers)) handled()
    } else if (key === 'F2' || key === 'Enter' || key === ' ') {
      handled()
      if (!openControl(td) && key === 'Enter') move(td, key, modifiers)
    } else if (key === 'Escape') {
      paintRange(null)
    } else if (key === 'PageDown') {
      handled()
      turnPage('.ant-pagination-next', () => posOf(td).row)
    } else if (key === 'PageUp') {
      handled()
      turnPage('.ant-pagination-prev', () => posOf(td).row)
    } else if (key === 'Backspace' || key === 'Delete') {
      const input = td.querySelector(TEXT_INPUT)
      if (input && !input.disabled) { handled(); setInputValue(input, '') }
    } else if (key.length === 1 && !ctrl && !e.altKey) {
      // Typing replaces the field, as in Excel: not prevented, so the key lands in the input focused here.
      const input = td.querySelector(TEXT_INPUT)
      if (input && !input.disabled) { input.focus(); input.select() }
    }
  }

  const onPaste = (e) => {
    const td = cellOf(e.target)
    if (!td) return
    const matrix = parseTsv(e.clipboardData.getData('text'))
    const single = matrix.length === 1 && matrix[0].length === 1
    if (e.target !== td && single) return
    const from = posOf(td)
    let pasted = 0
    matrix.forEach((values, r) => values.forEach((value, c) => {
      const input = cellAt({ row: from.row + r, col: from.col + c })?.querySelector(TEXT_INPUT)
      if (input && !input.disabled) { setInputValue(input, value); pasted += 1 }
    }))
    if (pasted > 0) {
      e.preventDefault()
      message.success(`Pasted ${pasted} cell${pasted === 1 ? '' : 's'}`, 1)
    }
  }

  const onMouseDown = (e) => {
    const td = cellOf(e.target)
    if (!td || e.target.closest(CONTROL) || e.target.closest('.ant-select')) return
    // Shift+click makes a range; without this the browser would select the text between.
    if (e.shiftKey) e.preventDefault()
  }

  const onClick = (e) => {
    const td = cellOf(e.target)
    if (!td || e.target.closest(CONTROL) || e.target.closest('.ant-select') || window.getSelection().toString()) return
    goTo(posOf(td), e.shiftKey && anchor.current)
  }

  return (
    <div ref={root} className="sheet" onKeyDownCapture={onKeyDown} onPasteCapture={onPaste} onMouseDown={onMouseDown} onClick={onClick}>
      {children}
    </div>
  )
}
