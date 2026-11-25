import * as basketball from './basketball.ts'
import * as soccer from './soccer.ts'
import * as hockey from './hockey.ts'
import * as football from './football.ts'
import { clubAthlete, nextFixture, ratings, settleFixture, startFixture, type Club, type Sport } from './club.ts'
import { planTurn as basketballAI, type DefenseStyle } from './opponent.ts'
import { planTurn as soccerAI } from './soccer-opponent.ts'
import { planTurn as hockeyAI, type HockeyStyle } from './hockey-opponent.ts'
import { planTurn as footballAI, type FootballStyle } from './football-opponent.ts'
import type { MatchSnapshot, PlanCommand, Plans, Team, TurnEvent } from './match.ts'
import { TURN_LIMITS } from './league.ts'

declare const TURN_PRO_FULL_PROTOTYPE: boolean

const RULES: Record<Sport, number> = {
  basketball: basketball.RULES_VERSION, soccer: soccer.RULES_VERSION,
  hockey: hockey.RULES_VERSION, football: football.RULES_VERSION,
}

export interface LoggedTurn {
  turn: number
  score: [number, number]
  events: TurnEvent[]
}

function applyLineup(club: Club, sport: 'basketball' | 'soccer', match: MatchSnapshot, rival: string) {
  match.teams = ['Comets', rival]
  const lineup = club.lineups[sport]
  match.athletes.filter(player => player.team === 0).forEach((player, slot) => {
    const { finishing, keeping, ...stats } = ratings(clubAthlete(club, lineup[slot]), sport)
    Object.assign(player, stats, sport === 'basketball' ? { shooting: finishing } : { finishing, keeping })
  })
}

export function beginClubFixture(club: Club): Club {
  const fixture = nextFixture(club)
  if (!fixture) throw new Error('This season is complete.')
  return startFixture(club, RULES[fixture.sport])
}

function replay<S extends MatchSnapshot & { rulesVersion: number }, C extends PlanCommand>(
  pending: NonNullable<Club['pending']>, match: S, fixedOpponent: (match: S, team: Team) => C[],
  resolve: (match: S, plans: Plans<C>) => { match: S; events: TurnEvent[] },
) {
  if (pending.rules !== match.rulesVersion) throw new Error('This fixture uses a different rules version.')
  const history: LoggedTurn[] = []
  for (const orders of pending.turns) {
    const next = resolve(match, [orders as C[], fixedOpponent(match, 1)])
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
  if (!fixture || !club.pending) throw new Error('Start your fixture first.')
  if (fixture.sport === 'basketball') {
    const match = basketball.createMatch(fixture.seed)
    applyLineup(club, 'basketball', match, fixture.rival)
    return { sport: 'basketball', defense: fixture.basketball,
      ...replay(club.pending, match, (state, team) => basketballAI(state, team, fixture.basketball), basketball.resolveTurn) }
  }
  if (fixture.sport === 'soccer') {
    const match = soccer.createMatch(fixture.seed, 0, 3, fixture.soccer)
    applyLineup(club, 'soccer', match, fixture.rival)
    return { sport: 'soccer', ...replay(club.pending, match, soccerAI, soccer.resolveTurn) }
  }
  if (typeof TURN_PRO_FULL_PROTOTYPE === 'undefined' || TURN_PRO_FULL_PROTOTYPE) {
    const lineup = club.lineups[fixture.sport].map(id => ratings(clubAthlete(club, id), fixture.sport))
    if (fixture.sport === 'hockey') {
      const match = hockey.createMatch(fixture.seed, 0, lineup)
      match.teams = ['Comets', fixture.rival]
      return { sport: 'hockey', style: fixture.hockey,
        ...replay(club.pending, match, (state, team) => hockeyAI(state, team, fixture.hockey), hockey.resolveTurn) }
    }
    const match = football.createMatch(fixture.seed, 0, lineup)
    match.teams = ['Comets', fixture.rival]
    return { sport: 'football', style: fixture.football,
      ...replay(club.pending, match, (state, team) => footballAI(state, team, fixture.football), football.resolveTurn) }
  }
  throw new Error('This fixture requires the four-sport build.')
}

export function saveClubTurn(club: Club, orders: readonly PlanCommand[], match: MatchSnapshot): Club {
  const fixture = nextFixture(club)
  const pending = club.pending
  if (!fixture || !pending || match.seed !== fixture.seed || match.turn !== pending.turns.length + 2) {
    throw new Error('The fixture changed before this turn could be saved.')
  }
  const next = { ...club, pending: { ...pending, turns: [...pending.turns, [...orders]] } }
  if (match.turn <= TURN_LIMITS[fixture.sport]) return next
  if (typeof TURN_PRO_FULL_PROTOTYPE === 'undefined' || TURN_PRO_FULL_PROTOTYPE) {
    if (fixture.sport === 'hockey') return settleFixture(next, match.score, match.athletes, hockey.clubAppearances(match as hockey.Match))
    if (fixture.sport === 'football') return settleFixture(next, match.score, match.athletes, football.clubAppearances(match as football.Match))
  }
  return settleFixture(next, match.score, match.athletes)
}
