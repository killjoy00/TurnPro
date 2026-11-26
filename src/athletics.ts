import type { AthleteSnapshot } from './match.ts'

export const ATHLETIC_TRAITS = {
  speed: { name: 'Speed', detail: 'Extends movement and football routes.' },
  strength: { name: 'Strength', detail: 'Improves rebounds, tackles, forechecks, and run contact.' },
  endurance: { name: 'Endurance', detail: 'Recovers more stamina when unassigned.' },
  composure: { name: 'Composure', detail: 'Reduces the accuracy penalty from low stamina.' },
} as const
export type AthleticTrait = keyof typeof ATHLETIC_TRAITS
export type Athletics = Record<AthleticTrait, number>
export const MAX_TRAIT = 2
export const UNTRAINED: Athletics = { speed: 0, strength: 0, endurance: 0, composure: 0 }

export function isAthleticTrait(value: unknown): value is AthleticTrait {
  return typeof value === 'string' && Object.hasOwn(ATHLETIC_TRAITS, value)
}

export function quickStep(player: AthleteSnapshot, ordered: boolean): boolean {
  return ordered && player.technique === 'quick-step' && player.stamina >= 50
}

export function movementMultiplier(player: AthleteSnapshot, ordered = false): number {
  return 1 + (player.athletics?.speed ?? 0) * 0.055 + (quickStep(player, ordered) ? 0.15 : 0)
}

export function contactBonus(player: AthleteSnapshot): number {
  return (player.athletics?.strength ?? 0) + (player.technique === 'anchor' ? 1.5 : 0)
}

export function recoveryBonus(player: AthleteSnapshot): number {
  return (player.athletics?.endurance ?? 0) * 2
}

export function fatiguePenalty(player: AthleteSnapshot, threshold: number, rate: number): number {
  return Math.max(0, threshold - player.stamina) * rate * (1 - (player.athletics?.composure ?? 0) * 0.2)
}
