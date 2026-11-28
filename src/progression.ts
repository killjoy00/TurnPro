import type { Sport } from './league.ts'
import type { Technique } from './match.ts'

export const SPECIALTY_NAMES = ['Playmaker', 'Defender', 'Finisher'] as const
export type Specialty = typeof SPECIALTY_NAMES[number]
export type Mastery = Record<Specialty, number>
export const SIGNATURE_MASTERY = 3
export const MAX_MASTERY = 6

export const MASTERY_BRANCHES = {
  Playmaker: ['thread-pass', 'second-wind'],
  Defender: ['read-play', 'anchor'],
  Finisher: ['clean-look', 'quick-step'],
} as const satisfies Record<Specialty, readonly Technique[]>
export type MasteryBranches = Partial<Record<Specialty, Technique>>

export function canChooseBranch(role: Specialty, branch: Technique): boolean {
  const choices: readonly Technique[] = MASTERY_BRANCHES[role]
  return choices.includes(branch)
}

export const TECHNICAL_SKILLS = ['passing', 'finishing', 'defense'] as const
export type TechnicalSkill = typeof TECHNICAL_SKILLS[number]
export type TechnicalTraining = Record<Sport, Record<TechnicalSkill, number>>
export const TECHNICAL_PREREQUISITE = 3
export const MAX_TECHNICAL_RANK = 2

export const DRILLS: Record<Sport, Record<TechnicalSkill, string>> = {
  basketball: { passing: 'Passing', finishing: 'Shooting', defense: 'Shot contests' },
  soccer: { passing: 'Distribution', finishing: 'Finishing', defense: 'Tackling' },
  hockey: { passing: 'Puck distribution', finishing: 'Shot placement', defense: 'Puck pressure' },
  football: { passing: 'Passing', finishing: 'Runs and catches', defense: 'Coverage and gaps' },
}

export function emptyProgression(): { mastery: Mastery; technical: TechnicalTraining } {
  return {
    mastery: { Playmaker: 0, Defender: 0, Finisher: 0 },
    technical: {
      basketball: { passing: 0, finishing: 0, defense: 0 },
      soccer: { passing: 0, finishing: 0, defense: 0 },
      hockey: { passing: 0, finishing: 0, defense: 0 },
      football: { passing: 0, finishing: 0, defense: 0 },
    },
  }
}

export function specialtyRank(points: number): string {
  if (points >= MAX_MASTERY) return 'Mastered'
  if (points >= SIGNATURE_MASTERY) return 'Practiced'
  return 'Learning'
}
