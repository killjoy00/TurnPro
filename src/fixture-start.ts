import { isFormation, RULES_VERSION as FOOTBALL_RULES, PREVIOUS_RULES_VERSION as PREVIOUS_FOOTBALL_RULES, type Match as FootballMatch } from './football.ts'
import { SHAPE_NAMES, RULES_VERSION as SOCCER_RULES, PREVIOUS_RULES_VERSION as PREVIOUS_SOCCER_RULES, type Match as SoccerMatch } from './soccer.ts'
import { RULES_VERSION as BASKETBALL_RULES, type Match as BasketballMatch } from './basketball.ts'
import { RULES_VERSION as HOCKEY_RULES, type Match as HockeyMatch } from './hockey.ts'
import { HOCKEY_STYLES, type HockeyStyle } from './hockey-opponent.ts'
import { FOOTBALL_STYLES, type FootballStyle } from './football-opponent.ts'
import { DEFENSE_NAMES, type DefenseStyle } from './opponent.ts'
import type { AthleteBuild, MatchSnapshot } from './match.ts'
import { ATHLETIC_TRAITS, MAX_TRAIT } from './athletics.ts'
import { SIGNATURES } from './athlete-abilities.ts'
import type { Fixture } from './league.ts'

export const FIXTURE_START_V1 = 1
export const OPPONENT_POLICY_V1 = 1

type SportStart =
  | { sport: 'basketball'; match: BasketballMatch; defense: DefenseStyle }
  | { sport: 'soccer'; match: SoccerMatch }
  | { sport: 'hockey'; match: HockeyMatch; style: HockeyStyle }
  | { sport: 'football'; match: FootballMatch; style: FootballStyle }

export type FixtureStart = SportStart & {
  version: typeof FIXTURE_START_V1
  opponentPolicy: typeof OPPONENT_POLICY_V1
  starters: string[]
}

export type VersionedMatch = MatchSnapshot & { rulesVersion: number }

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function number(value: unknown, min = 0, max = 100): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function point(value: unknown): boolean {
  return record(value) && number(value.x, 0, 120) && number(value.y, 0, 85)
}

function safeLabel(value: unknown): value is string {
  return typeof value === 'string' && /^[\p{L}\p{N} .’'/+-]{1,45}$/u.test(value)
}

const TECHNIQUES = ['thread-pass', 'read-play', 'clean-look', 'second-wind', 'quick-step', 'anchor']

function loadout(value: Record<string, unknown>): boolean {
  const { technique, signature, athletics } = value
  return (technique === undefined || (typeof technique === 'string' && TECHNIQUES.includes(technique)))
    && (signature === undefined || (typeof signature === 'string' && Object.hasOwn(SIGNATURES, signature)))
    && (athletics === undefined || (record(athletics)
      && Object.keys(ATHLETIC_TRAITS).every(trait => Number.isInteger(athletics[trait]) && number(athletics[trait], 0, MAX_TRAIT + 1))))
}

function athlete(value: unknown, id: string, team: number): value is Record<string, unknown> {
  return record(value) && value.id === id && value.team === team && safeLabel(value.number)
    && safeLabel(value.name) && safeLabel(value.role) && point(value.position) && number(value.stamina)
    && ['awareness', 'defense', 'keeping', 'passing', 'finishing'].every(key =>
      value[key] === undefined || number(value[key], 0, 30))
    && loadout(value)
}

function build(value: unknown): value is AthleteBuild {
  return record(value) && Object.keys(value).every(key =>
    ['name', 'stamina', 'awareness', 'passing', 'finishing', 'defense', 'keeping', 'technique', 'signature', 'athletics'].includes(key))
    && safeLabel(value.name) && number(value.stamina) && ['awareness', 'passing', 'finishing', 'defense', 'keeping']
      .every(key => number(value[key], 0, 30)) && loadout(value)
}

function values(value: unknown, length: number, check: (entry: unknown) => boolean): boolean {
  return Array.isArray(value) && value.length === length && value.every(check)
}

function clubLineup(value: unknown, hockey: boolean): boolean {
  return record(value) && values(value.lineup, 11, build)
    && values(value.orders, 11, orders => orders === 0)
    && (!hockey || values(value.played, 11, played => played === false))
}

export function validFixtureStart(value: unknown, fixture: Fixture, rules: number, roster: readonly string[]): value is FixtureStart {
  if (!record(value) || value.version !== FIXTURE_START_V1 || value.opponentPolicy !== OPPONENT_POLICY_V1
    || value.sport !== fixture.sport || !record(value.match) || !Array.isArray(value.starters)) return false
  const { match } = value
  const sport = fixture.sport
  const size = sport === 'basketball' ? 5 : sport === 'hockey' ? 6 : 11
  const rosterSize = sport === 'hockey' ? 11 : size
  if (value.starters.length !== rosterSize || new Set(value.starters).size !== rosterSize
    || value.starters.some(id => typeof id !== 'string' || !roster.includes(id))) return false
  if (match.turn !== 1 || match.seed !== fixture.seed || match.randomState !== match.seed || match.rulesVersion !== rules
    || !values(match.score, 2, score => score === 0) || !Array.isArray(match.teams)
    || match.teams.length !== 2 || match.teams[0] !== 'Comets' || match.teams[1] !== fixture.rival
    || !Array.isArray(match.athletes) || match.athletes.length !== size * 2
    || !match.athletes.every((player, index) => {
      const team = Math.floor(index / size)
      const slot = index % size
      const id = sport === 'football' ? `${team}-${team === 0 ? 'o' : 'd'}-${slot}` : `${team}-${slot}`
      if (!athlete(player, id, team) || (sport !== 'basketball' && player.slot !== slot)) return false
      switch (sport) {
        case 'basketball': return point(player.home) && number(player.speed, 0, 30) && number(player.strength, 0, 30)
          && number(player.passing, 0, 30) && number(player.shooting, 0, 30)
        case 'soccer': return number(player.pace, 0, 30) && number(player.passing, 0, 30)
          && number(player.finishing, 0, 30) && number(player.keeping, 0, 30)
        case 'hockey': return number(player.speed, 0, 30) && number(player.passing, 0, 30) && number(player.finishing, 0, 30)
        case 'football': return true
      }
    }) || typeof match.holder !== 'string' || !match.athletes.some(player => player.id === match.holder && player.team === 0)
    || (sport !== 'basketball' && match.openingTeam !== 0)) return false

  switch (sport) {
    case 'basketball': return rules === BASKETBALL_RULES && typeof value.defense === 'string' && Object.hasOwn(DEFENSE_NAMES, value.defense)
    case 'soccer': return (rules === SOCCER_RULES || rules === PREVIOUS_SOCCER_RULES)
      && match.commandLimit === 3 && values(match.shapes, 2, shape => typeof shape === 'string' && Object.hasOwn(SHAPE_NAMES, shape))
    case 'hockey': return rules === HOCKEY_RULES && typeof value.style === 'string' && Object.hasOwn(HOCKEY_STYLES, value.style)
      && clubLineup(match.club, true) && values(match.lines, 2, line => line === 0)
      && values(match.bench, 2, team => values(team, 2, line => values(line, 5, stamina => number(stamina))))
    case 'football': return (rules === FOOTBALL_RULES || rules === PREVIOUS_FOOTBALL_RULES)
      && typeof value.style === 'string' && Object.hasOwn(FOOTBALL_STYLES, value.style)
      && match.offense === 0 && match.down === 1 && number(match.yard, 1, 99)
      && number(match.sticks, match.yard, 100) && (match.formation === undefined || isFormation(match.formation))
      && clubLineup(match.club, false) && values(match.energy, 2, team => record(team)
        && values(team.o, 11, stamina => number(stamina)) && values(team.d, 11, stamina => number(stamina)))
  }
}

export function fixtureAthleteName(start: FixtureStart, slot: number): string | undefined {
  if (start.sport === 'hockey' || start.sport === 'football') return start.match.club?.lineup[slot]?.name
  return start.match.athletes[slot]?.name
}
