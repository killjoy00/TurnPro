import type { Sport } from './league.ts'
import type { AthleteSnapshot, Team, TurnEvent } from './match.ts'

export const FOCUS_XP = 3

export const MATCH_FOCUSES = {
  'roll-basket': { sport: 'basketball', skill: 'finishing', label: 'Finish the roll',
    instruction: 'Score after a screener rolls to the rim and receives a pass.' },
  'defensive-glass': { sport: 'basketball', skill: 'defense', label: 'Own the defensive glass',
    instruction: 'Win a defensive rebound with an athlete assigned Protect paint.' },
  'wide-switch': { sport: 'soccer', skill: 'passing', label: 'Use the far flank',
    instruction: 'Complete a switch of play to a teammate using Show wide.' },
  'press-recovery': { sport: 'soccer', skill: 'defense', label: 'Win it back',
    instruction: 'Win the ball with an athlete ordered to press the carrier.' },
  'bank-breakout': { sport: 'hockey', skill: 'passing', label: 'Beat the forecheck',
    instruction: 'Complete a bank outlet to a teammate using Show at the boards.' },
  'screened-goal': { sport: 'hockey', skill: 'finishing', label: 'Finish through a screen',
    instruction: 'Score a one-timer with a teammate screening the goalie.' },
  'fake-conversion': { sport: 'football', skill: 'passing', label: 'Make the run fake count',
    instruction: 'Throw for a first down or touchdown on play-action.' },
  'blitz-sack': { sport: 'football', skill: 'defense', label: 'Get to the quarterback',
    instruction: 'Record a sack while sending at least one blitzer.' },
} as const

export type FocusId = keyof typeof MATCH_FOCUSES
export interface MatchFocus { id: FocusId; athlete?: string }
export interface FocusAchievement { id: FocusId; team: Team; athlete: string }

export function isFocusForSport(value: unknown, sport: Sport): value is FocusId {
  return typeof value === 'string' && Object.hasOwn(MATCH_FOCUSES, value)
    && MATCH_FOCUSES[value as FocusId].sport === sport
}

export function focusAchievement(id: FocusId, athlete: AthleteSnapshot): FocusAchievement {
  return { id, team: athlete.team, athlete: athlete.name }
}

export function creditFocus(focus: MatchFocus, events: readonly TurnEvent[]): MatchFocus {
  if (focus.athlete) return focus
  const found = events.find(event => event.achievement?.id === focus.id && event.achievement.team === 0)
  return found?.achievement ? { ...focus, athlete: found.achievement.athlete } : focus
}
