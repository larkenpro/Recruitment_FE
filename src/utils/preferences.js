// A candidate preference is a (position, type) pair: { position: { id, title }, type: { id, name } }.
export const preferenceLabel = (p) => `${p.position.title} — ${p.type.name}`

export const preferenceKey = (p) => `${p.position.id}:${p.type.id}`

// Every (position, type) pair an event is hiring for, from GET /events/{id}/positions.
export const eventPairs = (eventPositions) =>
  (eventPositions ?? []).flatMap((position) => (position.types ?? []).map((type) => ({ position, type })))

// Ranker state for an existing application: its chosen pairs first in their order, then the event's
// other open pairs unticked. A chosen pair the event no longer offers is dropped.
export const rankedWithChosenFirst = (chosen, openPairs) => {
  const open = new Set(openPairs.map(preferenceKey))
  const chosenKeys = chosen.map(preferenceKey).filter((key) => open.has(key))
  const byKey = Object.fromEntries(openPairs.map((p) => [preferenceKey(p), p]))
  return {
    ranked: [...chosenKeys.map((key) => byKey[key]), ...openPairs.filter((p) => !chosenKeys.includes(preferenceKey(p)))],
    selected: new Set(chosenKeys),
  }
}

// Ticked pairs in ranked order, as the JSON endpoints take them.
export const selectedPreferences = (ranked, selected) =>
  ranked
    .filter((p) => selected.has(preferenceKey(p)))
    .map((p) => ({ positionId: p.position.id, typeId: p.type.id }))
