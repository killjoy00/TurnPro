import * as basketball from './basketball.ts'
import * as soccer from './soccer.ts'
import * as hockey from './hockey.ts'
import * as football from './football.ts'
import { planTurn as basketballAI, type DefenseStyle } from './opponent.ts'
import { planTurn as soccerAI } from './soccer-opponent.ts'
import { planTurn as hockeyAI, type HockeyStyle } from './hockey-opponent.ts'
import { planTurn as footballAI, type FootballStyle } from './football-opponent.ts'

declare const TURN_PRO_FULL_PROTOTYPE: boolean

export const SPORTS = ['basketball', 'soccer', 'hockey', 'football'] as const
export type Sport = typeof SPORTS[number]
export type SeasonMode = Sport | 'both' | 'all'
export type Score = [number, number]
export const TURN_LIMITS: Record<Sport, number> = {
  basketball: basketball.TURN_LIMIT, soccer: soccer.TURN_LIMIT, hockey: hockey.TURN_LIMIT, football: football.TURN_LIMIT,
}

export function seasonSports(mode: SeasonMode): readonly Sport[] {
  return mode === 'all' ? SPORTS : mode === 'both' ? ['basketball', 'soccer'] : [mode]
}

export const RIVALS = [
  { rival: 'Forge', basketball: 'switch', soccer: 'press', hockey: 'pressure', football: 'pressure' },
  { rival: 'Breakers', basketball: 'help', soccer: 'compact', hockey: 'slot', football: 'shell' },
  { rival: 'Rovers', basketball: 'stay', soccer: 'balanced', hockey: 'balanced', football: 'balanced' },
] as const satisfies readonly { rival: string; basketball: DefenseStyle; soccer: soccer.DefenseShape; hockey: HockeyStyle; football: FootballStyle }[]

export type Rival = typeof RIVALS[number]['rival']
export type Team = 'Comets' | Rival
const TEAMS: readonly Team[] = ['Comets', ...RIVALS.map(club => club.rival)]

export interface Fixture {
  week: number
  sport: Sport
  seed: number
  rival: Rival
  basketball: DefenseStyle
  soccer: soccer.DefenseShape
  hockey: HockeyStyle
  football: FootballStyle
  stage: 'regular' | 'final'
}

export interface LeagueProgress {
  seedOffset: number
  otherResults: Score[]
}

export interface SeasonRecord {
  mode: SeasonMode
  results: Score[]
  league: LeagueProgress | null
}

export function schedule(mode: SeasonMode, seedOffset = 0): Fixture[] {
  const makeFixture = (rival: typeof RIVALS[number], sport: Sport, index: number, leg: number): Fixture => ({
    ...rival, week: index + 1, sport, seed: (2026 + seedOffset + index * 17 + leg) >>> 0, stage: 'regular',
  })
  if (mode === 'both') {
    return RIVALS.flatMap((rival, index) => (['basketball', 'soccer'] as const)
      .map((sport, leg) => makeFixture(rival, sport, index, leg)))
  }
  if (mode === 'all') {
    return RIVALS.flatMap((rival, index) => SPORTS.map((sport, leg) => makeFixture(rival, sport, index * 2 + Math.floor(leg / 2), leg % 2)))
  }
  return [...RIVALS, RIVALS[0]].map((rival, index) => makeFixture(rival, mode, index, 0))
}

export function rivalPair(fixture: Fixture): readonly [Rival, Rival] {
  const [home, away] = RIVALS.filter(club => club.rival !== fixture.rival)
  return [home.rival, away.rival]
}

export function simulateRivals(fixture: Fixture, options?: { rulesVersion: number }): Score {
  const [home, away] = RIVALS.filter(club => club.rival !== fixture.rival)
  const seed = (fixture.seed + 4127) >>> 0
  const openingTeam = (seed % 2) as 0 | 1
  if (fixture.sport === 'basketball') {
    let match = basketball.createMatch(seed, openingTeam)
    while (!basketball.finished(match)) {
      match = basketball.resolveTurn(match, [
        basketballAI(match, 0, home.basketball), basketballAI(match, 1, away.basketball),
      ]).match
    }
    return match.score
  }
  if (typeof TURN_PRO_FULL_PROTOTYPE === 'undefined' || TURN_PRO_FULL_PROTOTYPE) {
    if (fixture.sport === 'hockey') {
      let match = hockey.createMatch(seed, openingTeam)
      while (!hockey.finished(match)) match = hockey.resolveTurn(match, [hockeyAI(match, 0, home.hockey), hockeyAI(match, 1, away.hockey)]).match
      return match.score
    }
    if (fixture.sport === 'football') {
      let match = football.createMatch(seed, openingTeam)
      if (options?.rulesVersion === football.PREVIOUS_RULES_VERSION) match.rulesVersion = football.PREVIOUS_RULES_VERSION
      while (!football.finished(match)) match = football.resolveTurn(match, [footballAI(match, 0, home.football), footballAI(match, 1, away.football)]).match
      return match.score
    }
  }
  if (fixture.sport !== 'soccer') throw new Error('This fixture requires the four-sport build.')
  let match = soccer.createMatch(seed, openingTeam, 3, away.soccer)
  if (options?.rulesVersion === soccer.PREVIOUS_RULES_VERSION) match.rulesVersion = soccer.PREVIOUS_RULES_VERSION
  match.shapes[0] = home.soccer
  while (!soccer.finished(match)) {
    match = soccer.resolveTurn(match, [soccerAI(match, 0), soccerAI(match, 1)]).match
  }
  return match.score
}

export interface LeagueRow {
  team: Team
  played: number
  wins: number
  draws: number
  losses: number
  points: number
}

function seasonPoints([a, b]: Score): number {
  return a > b ? 3 : a === b ? 1 : 0
}

export function leagueTable(record: SeasonRecord, season: number): LeagueRow[] {
  const rows = new Map(TEAMS.map(team => [team, { team, played: 0, wins: 0, draws: 0, losses: 0, points: 0 }]))
  const headToHead = new Map(TEAMS.map(team => [team, new Map<Team, number>()]))
  function add(home: Team, away: Team, score: Score) {
    const row = rows.get(home)!
    row.played += 1
    row.points += seasonPoints(score)
    if (score[0] > score[1]) row.wins += 1
    else if (score[0] === score[1]) row.draws += 1
    else row.losses += 1
    const totals = headToHead.get(home)!
    totals.set(away, (totals.get(away) ?? 0) + seasonPoints(score))
  }
  schedule(record.mode).forEach((fixture, index) => {
    const played = record.results[index]
    const other = record.league?.otherResults[index]
    if (!played || !other) return
    const [home, away] = rivalPair(fixture)
    add('Comets', fixture.rival, played)
    add(fixture.rival, 'Comets', [played[1], played[0]])
    add(home, away, other)
    add(away, home, [other[1], other[0]])
  })
  const standings = [...rows.values()]
  const tiedPoints = new Map(standings.map(row => [row.team, standings
    .filter(peer => peer.points === row.points && peer.wins === row.wins && peer.team !== row.team)
    .reduce((sum, peer) => sum + (headToHead.get(row.team)?.get(peer.team) ?? 0), 0)]))
  const preseasonRank = (team: Team) => (TEAMS.indexOf(team) - ((season - 1) % TEAMS.length) + TEAMS.length) % TEAMS.length
  return standings.sort((a, b) => b.points - a.points || b.wins - a.wins
    || tiedPoints.get(b.team)! - tiedPoints.get(a.team)! || preseasonRank(a.team) - preseasonRank(b.team))
}

export function seasonSchedule(record: SeasonRecord, season: number): Fixture[] {
  const regular = schedule(record.mode, record.league?.seedOffset)
  if (!record.league || record.results.length < regular.length) return regular
  const finalists = leagueTable(record, season).slice(0, 2)
  if (!finalists.some(row => row.team === 'Comets')) return regular
  const opponent = RIVALS.find(club => finalists.some(row => row.team === club.rival))!
  const sports = seasonSports(record.mode)
  return [...regular, ...sports.map((sport, leg): Fixture => ({
    ...opponent, sport, week: regular.at(-1)!.week + 1 + Math.floor(leg / 2),
    seed: (2599 + record.league!.seedOffset + leg * 17) >>> 0, stage: 'final',
  }))]
}

export type SeasonOutcome = 'Finished' | 'Missed the final' | 'Champion' | 'Runner-up'

export function seasonOutcome(record: SeasonRecord, season: number): SeasonOutcome | undefined {
  const seasonFixtures = seasonSchedule(record, season)
  if (record.results.length < seasonFixtures.length) return undefined
  if (!record.league) return 'Finished'
  const regular = schedule(record.mode).length
  if (seasonFixtures.length === regular) return 'Missed the final'
  const final = record.results.slice(regular)
  const earned = final.reduce((sum, score) => sum + seasonPoints(score), 0)
  const allowed = final.reduce((sum, [home, away]) => sum + seasonPoints([away, home]), 0)
  const topSeed = leagueTable(record, season)[0].team === 'Comets'
  return earned > allowed || (earned === allowed && topSeed) ? 'Champion' : 'Runner-up'
}

export function rivalryRecords(seasons: readonly SeasonRecord[]) {
  const totals = RIVALS.map(({ rival }) => ({ rival, wins: 0, draws: 0, losses: 0 }))
  seasons.forEach((record, index) => seasonSchedule(record, index + 1).forEach((fixture, position) => {
    const score = record.results[position]
    if (!score) return
    const row = totals.find(total => total.rival === fixture.rival)!
    if (score[0] > score[1]) row.wins += 1
    else if (score[0] === score[1]) row.draws += 1
    else row.losses += 1
  }))
  return totals
}
