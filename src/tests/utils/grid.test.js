import { describe, it, expect } from 'vitest'
import { moveCell, parseTsv, toTsv } from '../../utils/grid'

const size = { rows: 3, cols: 4 }
const at = (row, col) => ({ row, col })

describe('moveCell', () => {
  it('moves one cell with the arrows, and stops at the edges', () => {
    expect(moveCell(at(1, 1), 'ArrowDown', size)).toEqual(at(2, 1))
    expect(moveCell(at(1, 1), 'ArrowRight', size)).toEqual(at(1, 2))
    expect(moveCell(at(0, 0), 'ArrowUp', size)).toEqual(at(0, 0))
    expect(moveCell(at(0, 0), 'ArrowLeft', size)).toEqual(at(0, 0))
    expect(moveCell(at(2, 3), 'ArrowDown', size)).toEqual(at(2, 3))
    expect(moveCell(at(2, 3), 'ArrowRight', size)).toEqual(at(2, 3))
  })

  it('jumps to the edge with Ctrl+arrow', () => {
    expect(moveCell(at(1, 1), 'ArrowDown', { ...size, ctrl: true })).toEqual(at(2, 1))
    expect(moveCell(at(1, 1), 'ArrowLeft', { ...size, ctrl: true })).toEqual(at(1, 0))
  })

  it('goes to the row ends with Home and End, and the table corners with Ctrl', () => {
    expect(moveCell(at(1, 1), 'Home', size)).toEqual(at(1, 0))
    expect(moveCell(at(1, 1), 'End', size)).toEqual(at(1, 3))
    expect(moveCell(at(1, 1), 'Home', { ...size, ctrl: true })).toEqual(at(0, 0))
    expect(moveCell(at(1, 1), 'End', { ...size, ctrl: true })).toEqual(at(2, 3))
  })

  it('moves down with Enter and up with Shift+Enter', () => {
    expect(moveCell(at(0, 2), 'Enter', size)).toEqual(at(1, 2))
    expect(moveCell(at(1, 2), 'Enter', { ...size, shift: true })).toEqual(at(0, 2))
  })

  it('wraps Tab across rows, and gives null past either end', () => {
    expect(moveCell(at(0, 3), 'Tab', size)).toEqual(at(1, 0))
    expect(moveCell(at(1, 0), 'Tab', { ...size, shift: true })).toEqual(at(0, 3))
    expect(moveCell(at(2, 3), 'Tab', size)).toBeNull()
    expect(moveCell(at(0, 0), 'Tab', { ...size, shift: true })).toBeNull()
  })

  it('ignores other keys', () => {
    expect(moveCell(at(1, 1), 'a', size)).toBeNull()
  })
})

describe('tsv', () => {
  it('writes tabs between columns and a line per row', () => {
    expect(toTsv([['a', 'b'], ['c', 'd']])).toBe('a\tb\nc\td')
  })

  it("reads what Excel copies, ignoring its trailing line break", () => {
    expect(parseTsv('7\t8\r\n9\t\r\n')).toEqual([['7', '8'], ['9', '']])
    expect(parseTsv('7')).toEqual([['7']])
  })
})
