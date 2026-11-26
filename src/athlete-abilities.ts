import { closestPointOnSegment, distance, type Point } from './math.ts'
import type { AthleteSnapshot } from './match.ts'

export const SIGNATURES = {
  'cut-and-finish': {
    label: 'Cut and finish',
    specialty: 'Finisher',
    slot: 'Active',
    detail: 'Queue an off-ball cut. If a teammate completes a pass to this athlete in shooting range, they shoot immediately.',
  },
  'jump-lane': {
    label: 'Jump the lane',
    specialty: 'Defender',
    slot: 'Reaction',
    detail: 'Leave this athlete unassigned. They can step into a nearby passing lane for 8 stamina, giving up recovery. Lofted crosses bypass the reaction.',
  },
} as const

export type Signature = keyof typeof SIGNATURES
export const SIGNATURE_XP = 3
export const LANE_REACTION_COST = 8

export function supportsSignatures(sport: string) {
  return sport === 'basketball' || sport === 'soccer'
}

export function laneReaction<A extends AthleteSnapshot>(
  defenders: readonly A[], from: Point, to: Point, capacity: (athlete: A) => number,
) {
  if (distance(from, to) < 8) return undefined
  const options = defenders.flatMap(athlete => {
    if (athlete.signature !== 'jump-lane' || athlete.stamina < LANE_REACTION_COST) return []
    const point = closestPointOnSegment(athlete.position, from, to)
    const gap = distance(athlete.position, point)
    if (distance(from, point) < 3 || distance(to, point) < 3 || gap <= 3 || gap > Math.min(capacity(athlete), 7)) return []
    return [{ athlete, point, gap }]
  })
  return options.sort((a, b) => a.gap - b.gap || a.athlete.id.localeCompare(b.athlete.id))[0]
}
