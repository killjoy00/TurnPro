import { closestPointOnSegment, distance, type Point } from './math.ts'
import type { Sport } from './league.ts'
import type { AthleteSnapshot } from './match.ts'

export const SIGNATURES = {
  relay: {
    label: 'One-touch relay',
    sports: ['basketball', 'soccer'],
    specialty: 'Playmaker',
    slot: 'Active',
    detail: 'Pick a second teammate. If the first pass reaches this athlete, they immediately pass to that teammate. A turn can use one relay.',
  },
  'cut-and-finish': {
    label: 'Cut and finish',
    sports: ['basketball', 'soccer'],
    specialty: 'Finisher',
    slot: 'Active',
    detail: 'Queue an off-ball cut. If a teammate completes a pass to this athlete in shooting range, they shoot immediately.',
  },
  'jump-lane': {
    label: 'Jump the lane',
    sports: ['basketball', 'soccer'],
    specialty: 'Defender',
    slot: 'Reaction',
    detail: 'Leave this athlete unassigned. They can step into a nearby passing lane for 8 stamina, giving up recovery. Lofted crosses and switches bypass the reaction.',
  },
  'walk-point': {
    label: 'Walk the point',
    sports: ['hockey'],
    specialty: 'Playmaker',
    slot: 'Active',
    detail: 'Move laterally near the offensive blue line and shoot from the new lane. Costs more stamina than a wrist shot.',
  },
  'chip-release': {
    label: 'Chip and release',
    sports: ['football'],
    specialty: 'Defender',
    slot: 'Active',
    detail: 'A tight end can slow the rush and become a short outlet. A full pass protector offers stronger protection.',
  },
} as const

export type Signature = keyof typeof SIGNATURES
export const SIGNATURE_XP = 3
export const LANE_REACTION_COST = 8

export function signatureAvailable(signature: Signature, sport: Sport): boolean {
  const sports: readonly Sport[] = SIGNATURES[signature].sports
  return sports.includes(sport)
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
