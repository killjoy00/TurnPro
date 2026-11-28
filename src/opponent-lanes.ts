import { laneReaction, LANE_REACTION_COST } from './athlete-abilities.ts'
import type { AthleteSnapshot } from './match.ts'
import type { Point } from './math.ts'

export function laneReaders<A extends AthleteSnapshot>(athletes: readonly A[], project: (athlete: A) => Point): A[] {
  return athletes.filter(player => player.signature === 'jump-lane' && player.stamina >= LANE_REACTION_COST)
    .map(player => ({ ...player, position: project(player) }))
}

export function threatensLane<A extends AthleteSnapshot>(readers: readonly A[], from: Point, to: Point): boolean {
  return Boolean(laneReaction(readers, from, to, () => 7))
}
