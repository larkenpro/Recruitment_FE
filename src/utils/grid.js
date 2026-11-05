// The cell a key moves to in a grid of `rows` × `cols`. Stops at the edges, except Tab, which wraps
// to the next row and gives null past either end so focus can leave the table.
export function moveCell({ row, col }, key, { ctrl = false, shift = false, rows, cols }) {
  const lastRow = rows - 1
  const lastCol = cols - 1
  switch (key) {
    case 'ArrowUp': return { row: ctrl ? 0 : Math.max(row - 1, 0), col }
    case 'ArrowDown': return { row: ctrl ? lastRow : Math.min(row + 1, lastRow), col }
    case 'ArrowLeft': return { row, col: ctrl ? 0 : Math.max(col - 1, 0) }
    case 'ArrowRight': return { row, col: ctrl ? lastCol : Math.min(col + 1, lastCol) }
    case 'Home': return { row: ctrl ? 0 : row, col: 0 }
    case 'End': return { row: ctrl ? lastRow : row, col: lastCol }
    case 'Enter': return { row: shift ? Math.max(row - 1, 0) : Math.min(row + 1, lastRow), col }
    case 'Tab': {
      const next = row * cols + col + (shift ? -1 : 1)
      return next < 0 || next >= rows * cols ? null : { row: Math.floor(next / cols), col: next % cols }
    }
    default: return null
  }
}

// Cell values as Excel copies and pastes them: tabs between columns, a line per row.
export const toTsv = (matrix) => matrix.map((row) => row.join('\t')).join('\n')

export const parseTsv = (text) => {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n')
  return lines.map((line) => line.split('\t'))
}
