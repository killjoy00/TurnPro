import { creditFocus, isFocusForSport, type FocusId } from './match-focus.ts'
import * as basketball from './basketball.ts'
import * as soccer from './soccer.ts'
import * as hockey from './hockey.ts'
import * as football from './football.ts'
import { clubAthlete, nextFixture, physicalProfile, ratings, settleFixture, startFixture, type Club, type Sport } from './club.ts'
import { planTurn as basketballAI, type DefenseStyle } from './opponent.ts'
import { planTurn as soccerAI } from './soccer-opponent.ts'
import { planTurn as hockeyAI, type HockeyStyle } from './hockey-opponent.ts'
import { planTurn as footballAI, type FootballStyle } from './football-opponent.ts'
import { FIXTURE_START_V1, OPPONENT_POLICY_V1, type FixtureStart, type VersionedMatch } from './fixture-start.ts'
import type { AthleteBuild, MatchSnapshot, PlanCommand, Plans, Team, TurnEvent } from './match.ts'
import { TURN_LIMITS, type Fixture } from './league.ts'

const RULES: Record<Sport, number> = {
  basketball: basketball.RULES_VERSION, soccer: soccer.RULES_VERSION,
  hockey: hockey.RULES_VERSION, football: football.RULES_VERSION,
}

export interface LoggedTurn {
  turn: number
  score: [number, number]
  events: TurnEvent[]
}

function applyLineup(lineup: AthleteBuild[], sport: 'basketball' | 'soccer', match: MatchSnapshot, rival: string) {
  match.teams = ['Comets', rival]
  match.athletes.filter(player => player.team === 0).forEach((player, slot) => {
    const { finishing, keeping, ...stats } = lineup[slot]
    Object.assign(player, stats, sport === 'basketball' ? { shooting: finishing } : { finishing, keeping })
  })
}

function captureStart(club: Club, fixture: Fixture, rules: number, legacy: boolean): FixtureStart {
  const starters = [...club.lineups[fixture.sport]]
  const header = { version: FIXTURE_START_V1, opponentPolicy: OPPONENT_POLICY_V1, starters } as const
  const lineup = starters.map((id, slot) => {
    const athlete = clubAthlete(club, id)
    const traits = legacy ? club.pending?.athletics?.[slot] ?? athlete.athletics : physicalProfile(athlete)
    return ratings(athlete, fixture.sport, slot, traits)
  })
  const { sport, seed, rival } = fixture
  if (sport === 'basketball') {
    const match = basketball.createMatch(seed)
    applyLineup(lineup, sport, match, rival)
    return { ...header, sport, match, defense: fixture.basketball }
  }
  if (sport === 'soccer') {
    const match = soccer.createMatch(seed, 0, 3, fixture.soccer)
    if (rules === soccer.PREVIOUS_RULES_VERSION) match.rulesVersion = rules
    applyLineup(lineup, sport, match, rival)
    return { ...header, sport, match }
  }
  if (sport === 'hockey') {
    const match = hockey.createMatch(seed, 0, lineup)
    match.teams = ['Comets', rival]
    return { ...header, sport, match, style: fixture.hockey }
  }
  const match = football.createMatch(seed, 0, lineup)
  if (rules === football.PREVIOUS_RULES_VERSION) match.rulesVersion = rules
  match.teams = ['Comets', rival]
  return { ...header, sport, match, style: fixture.football }
}

export function beginClubFixture(club: Club, focus?: FocusId): Club {
  const fixture = nextFixture(club)
  if (!fixture) throw new Error('This season is complete.')
  if (focus !== undefined && !isFocusForSport(focus, fixture.sport)) throw new Error('Choose a focus for this sport.')
  const rules = RULES[fixture.sport]
  const started = startFixture(club, rules)
  const start = captureStart(started, fixture, rules, false)
  return { ...started, pending: { rules, turns: [], start, opponentPlans: [], ...(focus ? { focus: { id: focus } } : {}) } }
}

function replay<S extends VersionedMatch, C extends PlanCommand>(
  pending: NonNullable<Club['pending']>, initial: S, opponent: (match: S, team: Team) => C[],
  resolve: (match: S, plans: Plans<C>) => { match: S; events: TurnEvent[] },
  setFormation?: (match: S, formation: football.Formation) => S,
) {
  if (pending.rules !== initial.rulesVersion) throw new Error('This fixture uses a different rules version.')
  let match = structuredClone(initial)
  const history: LoggedTurn[] = []
  const opponentPlans: C[][] = []
  for (const [index, orders] of pending.turns.entries()) {
    const formation = pending.formations?.[index]
    if (formation && setFormation) match = setFormation(match, formation)
    const stored = pending.opponentPlans?.[index] as C[] | null | undefined
    if (stored == null && pending.start) throw new Error('A committed opponent plan is missing.')
    const reply = stored ?? opponent(match, 1)
    opponentPlans.push(reply.map(order => ({ ...order })))
    const next = resolve(match, [orders as C[], reply])
    history.push({ turn: match.turn, score: next.match.score, events: next.events })
    match = next.match
  }
  if (pending.focus && creditFocus({ id: pending.focus.id }, history.flatMap(turn => turn.events)).athlete !== pending.focus.athlete) {
    throw new Error('The match focus does not match the saved plays.')
  }
  return { match, history, opponentPlans, opponent }
}

function replayFromStart(pending: NonNullable<Club['pending']>, start: FixtureStart) {
  // When adding a policy, retain the v1 planners for fixtures started under v1.
  if (start.opponentPolicy !== OPPONENT_POLICY_V1) throw new Error('Unsupported fixture opponent policy.')
  if (start.sport === 'basketball') {
    const opponent = (match: basketball.Match, team: Team) => basketballAI(match, team, start.defense)
    return { sport: start.sport, defense: start.defense, ...replay(pending, start.match, opponent, basketball.resolveTurn) }
  }
  if (start.sport === 'soccer') return { sport: start.sport, ...replay(pending, start.match, soccerAI, soccer.resolveTurn) }
  if (start.sport === 'hockey') {
    const opponent = (match: hockey.Match, team: Team) => hockeyAI(match, team, start.style)
    return { sport: start.sport, style: start.style, ...replay(pending, start.match, opponent, hockey.resolveTurn) }
  }
  const opponent = (match: football.Match, team: Team) => footballAI(match, team, start.style)
  return { sport: start.sport, style: start.style, ...replay(pending, start.match, opponent, football.resolveTurn, football.setFormation) }
}

export function upgradeClubFixture(club: Club): Club {
  const pending = club.pending
  if (!pending || pending.start) return club
  const fixture = nextFixture(club)
  if (!fixture) throw new Error('There is no current fixture.')
  const start = captureStart(club, fixture, pending.rules, true)
  const { opponentPlans } = replayFromStart(pending, start)
  const { athletics, ...saved } = pending
  return { ...club, pending: { ...saved, start, opponentPlans } }
}

export function openClubFixture(club: Club) {
  const pending = club.pending
  const fixture = nextFixture(club)
  if (!fixture || !pending) throw new Error('Start your fixture first.')
  return replayFromStart(pending, pending.start ?? captureStart(club, fixture, pending.rules, true))
}

export function saveClubTurn(
  club: Club, orders: readonly PlanCommand[], match: VersionedMatch, formation: football.Formation | undefined,
  opponent: readonly PlanCommand[], events?: readonly TurnEvent[],
): Club {
  const fixture = nextFixture(club)
  const prepared = upgradeClubFixture(club)
  const pending = prepared.pending
  if (!fixture || !pending?.start || !pending.opponentPlans || match.seed !== pending.start.match.seed || match.rulesVersion !== pending.rules
    || match.turn !== pending.turns.length + 2) {
    throw new Error('The fixture changed before this turn could be saved.')
  }
  const next = { ...prepared, pending: { ...pending, turns: [...pending.turns, orders.map(order => ({ ...order }))],
    opponentPlans: [...pending.opponentPlans, opponent.map(order => ({ ...order }))] } }
  if (pending.focus) {
    if (!events) throw new Error('Resolved events are required to record a match focus.')
    next.pending.focus = creditFocus(pending.focus, events)
  }
  if (fixture.sport === 'football' && (formation || pending.formations)) {
    next.pending.formations = [...(pending.formations ?? pending.turns.map(() => null)), formation ?? null]
  }
  if (match.turn <= TURN_LIMITS[fixture.sport]) return next
  if (fixture.sport === 'hockey') return settleFixture(next, match.score, match.athletes, hockey.clubAppearances(match as hockey.Match))
  if (fixture.sport === 'football') return settleFixture(next, match.score, match.athletes, football.clubAppearances(match as football.Match))
  return settleFixture(next, match.score, match.athletes)
}
