import * as basketball from './basketball.ts'
import * as soccer from './soccer.ts'
import { clubAthlete, nextFixture, ratings, settleFixture, startFixture, type Club } from './club.ts'
import { planTurn as basketballAI, type DefenseStyle } from './opponent.ts'
import { planTurn as soccerAI } from './soccer-opponent.ts'
import type { MatchSnapshot, PlanCommand, TurnEvent } from './match.ts'

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
  return startFixture(club, fixture.sport === 'basketball' ? basketball.RULES_VERSION : soccer.RULES_VERSION)
}

export function openClubFixture(club: Club):
  | { sport: 'basketball'; match: basketball.Match; defense: DefenseStyle; history: LoggedTurn[] }
  | { sport: 'soccer'; match: soccer.Match; history: LoggedTurn[] } {
  const fixture = nextFixture(club)
  if (!fixture || !club.pending) throw new Error('Start your fixture first.')
  const history: LoggedTurn[] = []
  if (fixture.sport === 'basketball') {
    let match = basketball.createMatch(fixture.seed)
    if (club.pending.rules !== match.rulesVersion) throw new Error('This fixture uses a different basketball rules version.')
    applyLineup(club, 'basketball', match, fixture.rival)
    for (const orders of club.pending.turns) {
      const next = basketball.resolveTurn(match, [orders as basketball.Command[], basketballAI(match, 1, fixture.basketball)])
      history.push({ turn: match.turn, score: next.match.score, events: next.events })
      match = next.match
    }
    return { sport: 'basketball', match, defense: fixture.basketball, history }
  }
  let match = soccer.createMatch(fixture.seed, 0, 3, fixture.soccer)
  if (club.pending.rules !== match.rulesVersion) throw new Error('This fixture uses a different soccer rules version.')
  applyLineup(club, 'soccer', match, fixture.rival)
  for (const orders of club.pending.turns) {
    const next = soccer.resolveTurn(match, [orders as soccer.Command[], soccerAI(match, 1)])
    history.push({ turn: match.turn, score: next.match.score, events: next.events })
    match = next.match
  }
  return { sport: 'soccer', match, history }
}

export function saveClubTurn(club: Club, orders: readonly PlanCommand[], match: MatchSnapshot): Club {
  const fixture = nextFixture(club)
  const pending = club.pending
  if (!fixture || !pending || match.seed !== fixture.seed || match.turn !== pending.turns.length + 2) {
    throw new Error('The fixture changed before this turn could be saved.')
  }
  const next = { ...club, pending: { ...pending, turns: [...pending.turns, [...orders]] } }
  const limit = fixture.sport === 'basketball' ? basketball.TURN_LIMIT : soccer.TURN_LIMIT
  return match.turn > limit ? settleFixture(next, match.score, match.athletes) : next
}
