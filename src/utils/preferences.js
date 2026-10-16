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

// Whether any pair is for a position in the IT department (department is free text).
export const hasItPosition = (pairs) => pairs.some((p) => p.position.department?.trim().toLowerCase() === 'it')

// Whether any pair involves an internship: the Internship and Intern-to-FTE types.
export const hasInternship = (pairs) => pairs.some((p) => /intern/i.test(p.type.name))

// The ticked pairs, in ranked order.
export const tickedPairs = (ranked, selected) => ranked.filter((p) => selected.has(preferenceKey(p)))

// Ticked pairs in ranked order, as the JSON endpoints take them.
export const selectedPreferences = (ranked, selected) =>
  ranked
    .filter((p) => selected.has(preferenceKey(p)))
    .map((p) => ({ positionId: p.position.id, typeId: p.type.id }))

// The offer dropdown: every pair the event hires for with the candidate's rank for it (null if they
// didn't rank it), ranked pairs first.
export const offerPairs = (eventPositions, preferences) => {
  const rank = Object.fromEntries((preferences ?? []).map((p, i) => [preferenceKey(p), i + 1]))
  return eventPairs(eventPositions)
    .map((p) => ({ key: preferenceKey(p), label: preferenceLabel(p), rank: rank[preferenceKey(p)] ?? null }))
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
}
