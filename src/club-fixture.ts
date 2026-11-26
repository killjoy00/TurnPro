import * as basketball from './basketball.ts'
import * as soccer from './soccer.ts'
import * as hockey from './hockey.ts'
import * as football from './football.ts'
import { clubAthlete, nextFixture, physicalProfile, ratings, settleFixture, startFixture, type Club, type Sport } from './club.ts'
import { planTurn as basketballAI, type DefenseStyle } from './opponent.ts'
import { planTurn as soccerAI } from './soccer-opponent.ts'
import { planTurn as hockeyAI, type HockeyStyle } from './hockey-opponent.ts'
import { planTurn as footballAI, type FootballStyle } from './football-opponent.ts'
import type { AthleteBuild, MatchSnapshot, PlanCommand, Plans, Team, TurnEvent } from './match.ts'
import { TURN_LIMITS } from './league.ts'

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

export function beginClubFixture(club: Club): Club {
  const fixture = nextFixture(club)
  if (!fixture) throw new Error('This season is complete.')
  const started = startFixture(club, RULES[fixture.sport])
  const athletics = club.lineups[fixture.sport].map(id => physicalProfile(clubAthlete(club, id)))
  return { ...started, pending: { ...started.pending!, athletics, opponentPlans: [] } }
}

function replay<S extends MatchSnapshot & { rulesVersion: number }, C extends PlanCommand>(
  pending: NonNullable<Club['pending']>, match: S, fixedOpponent: (match: S, team: Team) => C[],
  resolve: (match: S, plans: Plans<C>) => { match: S; events: TurnEvent[] },
  setFormation?: (match: S, formation: football.Formation) => S,
) {
  if (pending.rules !== match.rulesVersion) throw new Error('This fixture uses a different rules version.')
  const history: LoggedTurn[] = []
  for (const [index, orders] of pending.turns.entries()) {
    const formation = pending.formations?.[index]
    if (formation && setFormation) match = setFormation(match, formation)
    const stored = pending.opponentPlans?.[index] as C[] | null | undefined
    const next = resolve(match, [orders as C[], stored ?? fixedOpponent(match, 1)])
    history.push({ turn: match.turn, score: next.match.score, events: next.events })
    match = next.match
  }
  return { match, history }
}

export function openClubFixture(club: Club):
  | { sport: 'basketball'; match: basketball.Match; defense: DefenseStyle; history: LoggedTurn[] }
  | { sport: 'soccer'; match: soccer.Match; history: LoggedTurn[] }
  | { sport: 'hockey'; match: hockey.Match; style: HockeyStyle; history: LoggedTurn[] }
  | { sport: 'football'; match: football.Match; style: FootballStyle; history: LoggedTurn[] } {
  const fixture = nextFixture(club)
  const pending = club.pending
  if (!fixture || !pending) throw new Error('Start your fixture first.')
  const lineup = club.lineups[fixture.sport].map((id, slot) => {
    const athlete = clubAthlete(club, id)
    return ratings(athlete, fixture.sport, slot, pending.athletics?.[slot] ?? athlete.athletics)
  })
  if (fixture.sport === 'basketball') {
    const match = basketball.createMatch(fixture.seed)
    applyLineup(lineup, 'basketball', match, fixture.rival)
    return { sport: 'basketball', defense: fixture.basketball,
      ...replay(pending, match, (state, team) => basketballAI(state, team, fixture.basketball), basketball.resolveTurn) }
  }
  if (fixture.sport === 'soccer') {
    const match = soccer.createMatch(fixture.seed, 0, 3, fixture.soccer)
    if (pending.rules === soccer.PREVIOUS_RULES_VERSION) match.rulesVersion = soccer.PREVIOUS_RULES_VERSION
    applyLineup(lineup, 'soccer', match, fixture.rival)
    return { sport: 'soccer', ...replay(pending, match, soccerAI, soccer.resolveTurn) }
  }
  if (fixture.sport === 'hockey') {
    const match = hockey.createMatch(fixture.seed, 0, lineup)
    match.teams = ['Comets', fixture.rival]
    return { sport: 'hockey', style: fixture.hockey,
      ...replay(pending, match, (state, team) => hockeyAI(state, team, fixture.hockey), hockey.resolveTurn) }
  }
  const match = football.createMatch(fixture.seed, 0, lineup)
  if (pending.rules === football.PREVIOUS_RULES_VERSION) match.rulesVersion = football.PREVIOUS_RULES_VERSION
  match.teams = ['Comets', fixture.rival]
  return { sport: 'football', style: fixture.football,
    ...replay(pending, match, (state, team) => footballAI(state, team, fixture.football), football.resolveTurn, football.setFormation) }
}

export function saveClubTurn(
  club: Club, orders: readonly PlanCommand[], match: MatchSnapshot, formation?: football.Formation, opponent?: readonly PlanCommand[],
): Club {
  const fixture = nextFixture(club)
  const pending = club.pending
  if (!fixture || !pending || match.seed !== fixture.seed || match.turn !== pending.turns.length + 2) {
    throw new Error('The fixture changed before this turn could be saved.')
  }
  const next = { ...club, pending: { ...pending, turns: [...pending.turns, [...orders]] } }
  if (pending.opponentPlans !== undefined || opponent !== undefined) {
    next.pending.opponentPlans = [...(pending.opponentPlans ?? pending.turns.map(() => null)),
      opponent?.map(order => ({ ...order })) ?? null]
  }
  if (fixture.sport === 'football' && (formation || pending.formations)) {
    next.pending.formations = [...(pending.formations ?? pending.turns.map(() => null)), formation ?? null]
  }
  if (match.turn <= TURN_LIMITS[fixture.sport]) return next
  if (fixture.sport === 'hockey') return settleFixture(next, match.score, match.athletes, hockey.clubAppearances(match as hockey.Match))
  if (fixture.sport === 'football') return settleFixture(next, match.score, match.athletes, football.clubAppearances(match as football.Match))
  return settleFixture(next, match.score, match.athletes)
}
