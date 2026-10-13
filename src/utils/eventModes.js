export const EVENT_MODES = [
  { value: 'ON_CAMPUS', label: 'On-campus', color: 'blue' },
  { value: 'VIRTUAL', label: 'Virtual', color: 'purple' },
  { value: 'HYBRID', label: 'Hybrid', color: 'cyan' },
]

export const EVENT_MODE_OPTIONS = EVENT_MODES.map(({ value, label }) => ({ value, label }))

export const eventMode = (value) => EVENT_MODES.find((m) => m.value === value) ?? { value, label: value ?? '—', color: 'default' }
