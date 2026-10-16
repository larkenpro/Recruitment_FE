import { describe, it, expect } from 'vitest'
import { placeKey, resolveChoice, saveChoice, toggleKey } from '../../utils/columns'

describe('placeKey', () => {
  const keys = ['a', 'b', 'c', 'd']

  it('drops just before or just after the target', () => {
    expect(placeKey(keys, 'a', 'c', false)).toEqual(['b', 'a', 'c', 'd'])
    expect(placeKey(keys, 'a', 'c', true)).toEqual(['b', 'c', 'a', 'd'])
    expect(placeKey(keys, 'd', 'b', false)).toEqual(['a', 'd', 'b', 'c'])
    expect(placeKey(keys, 'd', 'b', true)).toEqual(['a', 'b', 'd', 'c'])
  })

  it('reaches both ends', () => {
    expect(placeKey(keys, 'c', 'a', false)).toEqual(['c', 'a', 'b', 'd'])
    expect(placeKey(keys, 'b', 'd', true)).toEqual(['a', 'c', 'd', 'b'])
  })

  it('dropping next to where it already is changes nothing', () => {
    expect(placeKey(keys, 'b', 'c', false)).toEqual(keys)
    expect(placeKey(keys, 'b', 'a', true)).toEqual(keys)
  })

  it('ignores itself and keys from another table', () => {
    expect(placeKey(keys, 'b', 'b', true)).toBe(keys)
    expect(placeKey(keys, 'x', 'b', false)).toBe(keys)
  })
})

describe('toggleKey', () => {
  it('hides a shown column and shows a hidden one at the end', () => {
    expect(toggleKey(['a', 'b', 'c'], 'b')).toEqual(['a', 'c'])
    expect(toggleKey(['a', 'c'], 'b')).toEqual(['a', 'c', 'b'])
  })
})

describe('resolveChoice / saveChoice', () => {
  const defaults = ['status', 'name', 'response']

  it('nothing saved: the defaults', () => {
    expect(resolveChoice(undefined, defaults)).toEqual(defaults)
  })

  it('keeps the saved order and what was turned off', () => {
    const saved = saveChoice(undefined, ['name', 'status'], ['status', 'name', 'response', 'email'])
    expect(resolveChoice(saved, defaults)).toEqual(['name', 'status'])
  })

  it('a default column added after the save shows up at the end', () => {
    const saved = saveChoice(undefined, ['name', 'status'], ['status', 'name', 'email'])
    expect(resolveChoice(saved, defaults)).toEqual(['name', 'status', 'response'])
  })

  it('a new column that is not a default stays hidden', () => {
    const saved = saveChoice(undefined, ['name'], ['name'])
    expect(resolveChoice(saved, ['name'])).toEqual(['name'])
  })

  it('remembers columns seen in earlier saves, e.g. one still loading now', () => {
    const first = saveChoice(undefined, ['name'], ['name', 'response'])
    const second = saveChoice(first, ['name'], ['name'])
    expect(second.seen).toEqual(['name', 'response'])
    expect(resolveChoice(second, defaults)).toEqual(['name', 'status'])
  })
})
