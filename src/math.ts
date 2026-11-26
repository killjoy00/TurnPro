export interface Point {
  x: number
  y: number
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function stepToward(from: Point, to: Point, maxDistance: number): Point {
  const separation = distance(from, to)
  if (separation <= maxDistance) return { ...to }
  const fraction = maxDistance / separation
  return {
    x: from.x + (to.x - from.x) * fraction,
    y: from.y + (to.y - from.y) * fraction,
  }
}

export function closestPointOnSegment(point: Point, start: Point, end: Point): Point {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const squaredLength = dx * dx + dy * dy
  if (squaredLength === 0) return start
  const fraction = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / squaredLength, 0, 1)
  return { x: start.x + dx * fraction, y: start.y + dy * fraction }
}

export function distanceToSegment(point: Point, start: Point, end: Point): number {
  return distance(point, closestPointOnSegment(point, start, end))
}

export function seededRandom(seed: number) {
  let state = seed >>> 0
  return {
    next() {
      state = (state + 0x6D2B79F5) >>> 0
      let value = Math.imul(state ^ (state >>> 15), state | 1)
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296
    },
    get state() {
      return state
    },
  }
}
