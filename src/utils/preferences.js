// A candidate preference is a (position, type) pair: { position: { id, title }, type: { id, name } }.
export const preferenceLabel = (p) => `${p.position.title} — ${p.type.name}`

export const preferenceKey = (p) => `${p.position.id}:${p.type.id}`

// Every (position, type) pair an event is hiring for, from GET /events/{id}/positions.
export const eventPairs = (eventPositions) =>
  (eventPositions ?? []).flatMap((position) => (position.types ?? []).map((type) => ({ position, type })))
