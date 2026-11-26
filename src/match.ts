import type { Point } from './math.ts'
import type { Athletics } from './athletics.ts'

export type Team = 0 | 1
export const TEAMS = ['Comets', 'Forge'] as const
export const COMMAND_LIMIT = 3

export type Technique = 'thread-pass' | 'read-play' | 'clean-look' | 'second-wind' | 'quick-step' | 'anchor'

export interface BaseAssignment {
  label: string
  target?: Point
}

export interface AthleteBuild {
  name: string
  stamina: number
  awareness: number
  passing: number
  finishing: number
  defense: number
  keeping: number
  technique?: Technique
  athletics?: Athletics
}

export interface Appearance {
  slot: number
  stamina: number
  orders: number
}

export interface AthleteSnapshot {
  id: string
  team: Team
  number: string
  name: string
  role: string
  position: Point
  stamina: number
  awareness?: number
  defense?: number
  technique?: Technique
  athletics?: Athletics
}

export interface MatchSnapshot {
  turn: number
  seed: number
  holder: string
  score: [number, number]
  teams?: [string, string]
  athletes: readonly AthleteSnapshot[]
}

export interface PlanCommand {
  athlete: string
  kind: string
  target?: string | number
}

export type Plans<C extends PlanCommand> = readonly [readonly C[], readonly C[]]

export type EventKind =
  | 'plan' | 'movement' | 'ball' | 'score' | 'possession' | 'turnover'
  | 'save' | 'restart' | 'finish'

export interface ResolvedMove {
  athlete: string
  from: Point
  to: Point
}

export type PlayCue =
  | { type: 'plan'; team: Team; commands: readonly PlanCommand[] }
  | { type: 'move'; moves: readonly ResolvedMove[] }
  | { type: 'contact'; athlete: string; opponent: string }
  | { type: 'ball'; action: 'pass' | 'shot' | 'interception' | 'rebound' | 'strip';
      from: Point; to: Point; holder?: string }
  | { type: 'reset'; moves: readonly ResolvedMove[]; holder: string }

export type TurnEvent = { cue?: PlayCue } & (
  | { kind: EventKind; text: string }
  | { kind: 'rebound'; text: string; offensive: boolean }
)

export function otherTeam(team: Team): Team {
  return team === 0 ? 1 : 0
}

export function findAthlete<A extends AthleteSnapshot>(athletes: readonly A[], id: string): A {
  const athlete = athletes.find(candidate => candidate.id === id)
  if (!athlete) throw new Error('Unknown athlete.')
  return athlete
}

export function validatePlans<S extends MatchSnapshot, C extends PlanCommand>(
  match: S, plans: Plans<C>, limit: number, legalCommands: (match: S, id: string) => readonly C[],
) {
  for (const team of [0, 1] as const) {
    const plan = plans[team]
    const used = new Set<string>()
    if (plan.length > limit) throw new Error(`A plan can use up to ${limit === 3 ? 'three' : limit} commands.`)
    for (const command of plan) {
      if (used.has(command.athlete)) throw new Error('An athlete can take one command per turn.')
      const athlete = findAthlete(match.athletes, command.athlete)
      if (athlete.team !== team || !legalCommands(match, athlete.id).some(legal =>
        legal.athlete === command.athlete && legal.kind === command.kind
        && ('target' in legal) === ('target' in command) && legal.target === command.target)) {
        throw new Error('That command is unavailable in this position.')
      }
      used.add(command.athlete)
    }
  }
}

export function teamNames(match: MatchSnapshot): readonly [string, string] {
  return match.teams ?? TEAMS
}

export function revealPlans<S extends MatchSnapshot, C extends PlanCommand>(
  match: S, plans: Plans<C>, label: (match: S, command: C) => string,
): TurnEvent[] {
  return ([0, 1] as const).map(team => {
    const descriptions = plans[team].map(command =>
      `${findAthlete(match.athletes, command.athlete).name} · ${label(match, command)}`)
    return { kind: 'plan', cue: { type: 'plan', team, commands: plans[team].map(command => ({ ...command })) }, text: `${teamNames(match)[team]}: ${descriptions.join(' / ') || 'Base assignments'}` }
  })
}

export function finalScore(match: MatchSnapshot): string {
  const [home, away] = match.score
  const result = home === away ? 'Draw' : `${teamNames(match)[home > away ? 0 : 1]} win`
  return `Final score: ${home}–${away}. ${result}.`
}
