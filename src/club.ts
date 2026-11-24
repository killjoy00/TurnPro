import { clamp } from './math.ts'
import type { PlanCommand } from './match.ts'
import type { DefenseStyle } from './opponent.ts'
import type { DefenseShape } from './soccer.ts'

export type Sport = 'basketball' | 'soccer'
export type SeasonMode = Sport | 'both'
export type Specialty = 'Playmaker' | 'Defender' | 'Finisher'
export const SPECIALTIES: Record<Specialty, string> = {
  Playmaker: '+2 passing, −1 finishing',
  Defender: '+2 defensive pressure, −1 finishing',
  Finisher: '+2 finishing, −1 passing',
}

interface Profile {
  id: string
  name: string
  awareness: number
  basketball: number
  soccer: number
  specialty: Specialty
  keeper?: boolean
}

const profiles: Profile[] = [
  { id: 'reed', name: 'Reed', awareness: 9, basketball: 3, soccer: 1, specialty: 'Playmaker' },
  { id: 'vale', name: 'Vale', awareness: 6, basketball: 2, soccer: 2, specialty: 'Finisher' },
  { id: 'blake', name: 'Blake', awareness: 7, basketball: 2, soccer: 3, specialty: 'Defender' },
  { id: 'diaz', name: 'Diaz', awareness: 6, basketball: 2, soccer: 2, specialty: 'Defender' },
  { id: 'okafor', name: 'Okafor', awareness: 7, basketball: 3, soccer: 2, specialty: 'Defender' },
  { id: 'shaw', name: 'Shaw', awareness: 6, basketball: 1, soccer: 3, specialty: 'Defender', keeper: true },
  { id: 'mora', name: 'Mora', awareness: 5, basketball: 1, soccer: 3, specialty: 'Defender' },
  { id: 'chen', name: 'Chen', awareness: 8, basketball: 1, soccer: 3, specialty: 'Playmaker' },
  { id: 'santos', name: 'Santos', awareness: 7, basketball: 1, soccer: 3, specialty: 'Playmaker' },
  { id: 'adeyemi', name: 'Adeyemi', awareness: 6, basketball: 1, soccer: 3, specialty: 'Finisher' },
  { id: 'ito', name: 'Ito', awareness: 5, basketball: 1, soccer: 3, specialty: 'Finisher' },
  { id: 'rowan', name: 'Rowan', awareness: 6, basketball: 2, soccer: 2, specialty: 'Playmaker' },
]

export const PROSPECTS: readonly Profile[] = [
  { id: 'imani', name: 'Imani', awareness: 8, basketball: 1, soccer: 3, specialty: 'Defender', keeper: true },
  { id: 'cruz', name: 'Cruz', awareness: 6, basketball: 3, soccer: 2, specialty: 'Finisher' },
  { id: 'lin', name: 'Lin', awareness: 9, basketball: 2, soccer: 2, specialty: 'Playmaker' },
]

export const ROLES: Record<Sport, readonly string[]> = {
  basketball: ['PG', 'SG', 'SF', 'PF', 'C'],
  soccer: ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'CM', 'AM', 'LW', 'ST', 'RW'],
}

export interface ClubAthlete {
  id: string
  specialty: Specialty
  xp: Record<Sport, number>
  fatigue: number
}

export interface Club {
  version: 1
  mode: SeasonMode
  roster: ClubAthlete[]
  lineups: Record<Sport, string[]>
  trainedWeek: number
  results: [number, number][]
  pending: { rules: number; turns: PlanCommand[][] } | null
}

interface Fixture {
  week: number
  sport: Sport
  seed: number
  rival: string
  basketball: DefenseStyle
  soccer: DefenseShape
}

const RIVALS = [
  { rival: 'Forge', basketball: 'switch', soccer: 'press' },
  { rival: 'Breakers', basketball: 'help', soccer: 'compact' },
  { rival: 'Rovers', basketball: 'stay', soccer: 'balanced' },
] as const

export function profile(id: string): Profile {
  const found = [...profiles, ...PROSPECTS].find(candidate => candidate.id === id)
  if (!found) throw new Error('Unknown club athlete.')
  return found
}

function makeAthlete(entry: Profile): ClubAthlete {
  return { id: entry.id, specialty: entry.specialty, xp: { basketball: 0, soccer: 0 }, fatigue: 0 }
}

export function createClub(mode: SeasonMode): Club {
  return {
    version: 1, mode, roster: profiles.map(makeAthlete),
    lineups: {
      basketball: ['reed', 'vale', 'blake', 'diaz', 'okafor'],
      soccer: ['shaw', 'mora', 'blake', 'okafor', 'diaz', 'chen', 'reed', 'santos', 'vale', 'adeyemi', 'ito'],
    },
    trainedWeek: 0, results: [], pending: null,
  }
}

export function schedule(mode: SeasonMode): Fixture[] {
  if (mode === 'both') {
    return RIVALS.flatMap((rival, index) => (['basketball', 'soccer'] as const).map((sport, offset) => ({
      ...rival, week: index + 1, sport, seed: 2026 + index * 17 + offset,
    })))
  }
  return [RIVALS[0], RIVALS[1], RIVALS[2], RIVALS[0]].map((rival, index) => ({
    ...rival, week: index + 1, sport: mode, seed: 2026 + index * 17,
  }))
}

export function nextFixture(club: Club): Fixture | undefined {
  return schedule(club.mode)[club.results.length]
}

export function clubAthlete(club: Club, id: string): ClubAthlete {
  const athlete = club.roster.find(player => player.id === id)
  if (!athlete) throw new Error('That athlete is outside your club.')
  return athlete
}

function openWeek(club: Club): number {
  if (club.pending) throw new Error('Finish the current fixture to change your club.')
  const next = nextFixture(club)
  if (!next) throw new Error('This season is complete.')
  return next.week
}

export function recruit(club: Club, id: string): Club {
  openWeek(club)
  const prospect = PROSPECTS.find(candidate => candidate.id === id)
  if (!prospect || club.roster.length !== profiles.length) throw new Error('Choose one available prospect this season.')
  return { ...club, roster: [...club.roster, makeAthlete(prospect)] }
}

export function train(club: Club, id: string, sport: Sport): Club {
  const week = openWeek(club)
  if (club.trainedWeek === week) throw new Error('You have used this week’s training session.')
  if (club.mode !== 'both' && club.mode !== sport) throw new Error('Choose a sport in your season.')
  const athlete = clubAthlete(club, id)
  const improved = { ...athlete, xp: { ...athlete.xp, [sport]: athlete.xp[sport] + 3 } }
  return { ...club, trainedWeek: week, roster: club.roster.map(player => player.id === id ? improved : player) }
}

export function specialize(club: Club, id: string, specialty: Specialty): Club {
  openWeek(club)
  clubAthlete(club, id)
  if (!Object.hasOwn(SPECIALTIES, specialty)) throw new Error('Choose a valid specialty.')
  return { ...club, roster: club.roster.map(player => player.id === id ? { ...player, specialty } : player) }
}

export function setStarter(club: Club, sport: Sport, slot: number, id: string): Club {
  openWeek(club)
  clubAthlete(club, id)
  const ids = [...club.lineups[sport]]
  if (!Number.isInteger(slot) || slot < 0 || slot >= ids.length) throw new Error('Choose a valid lineup position.')
  const existing = ids.indexOf(id)
  if (existing >= 0) ids[existing] = ids[slot]
  ids[slot] = id
  if (sport === 'soccer' && !profile(ids[0]).keeper) throw new Error('The goalkeeper slot needs a trained keeper.')
  return { ...club, lineups: { ...club.lineups, [sport]: ids } }
}

export function development(player: ClubAthlete, sport: Sport): number {
  return Math.min(3, Math.floor(player.xp[sport] / 3))
}

export function ratings(player: ClubAthlete, sport: Sport) {
  const entry = profile(player.id)
  const skill = entry[sport] + development(player, sport)
  const pass = player.specialty === 'Playmaker' ? 2 : player.specialty === 'Finisher' ? -1 : 0
  const finish = player.specialty === 'Finisher' ? 2 : -1
  return {
    name: entry.name, stamina: 100 - player.fatigue, awareness: entry.awareness,
    passing: clamp(4 + skill + pass, 2, 12), finishing: clamp(4 + skill + finish, 2, 12),
    defense: player.specialty === 'Defender' ? 2 : 0,
    keeping: entry.keeper ? 6 + skill : 0,
  }
}

export function startFixture(club: Club, rules: number): Club {
  openWeek(club)
  return { ...club, pending: { rules, turns: [] } }
}

export function settleFixture(club: Club, score: [number, number], players: readonly { team: number; stamina: number }[]): Club {
  const fixture = nextFixture(club)
  const pending = club.pending
  if (!fixture || !pending) throw new Error('There is no current fixture.')
  const starters = club.lineups[fixture.sport]
  const onField = players.filter(player => player.team === 0)
  const roster = club.roster.map(player => {
    const slot = starters.indexOf(player.id)
    if (slot < 0) return { ...player, fatigue: Math.max(0, player.fatigue - 14) }
    const earned = pending.turns.filter(turn => turn.some(order => order.athlete === `0-${slot}`)).length
    const exertion = Math.max(0, 100 - player.fatigue - onField[slot].stamina)
    return {
      ...player, fatigue: clamp(player.fatigue + 23 + Math.round(exertion / 3), 0, 65),
      xp: { ...player.xp, [fixture.sport]: player.xp[fixture.sport] + (earned >= 3 ? 2 : 1) },
    }
  })
  const next = { ...club, roster, results: [...club.results, score], pending: null }
  if (nextFixture(next)?.week !== fixture.week) {
    next.roster = roster.map(player => ({ ...player, fatigue: Math.max(0, player.fatigue - 18) }))
  }
  return next
}

function record(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === 'object' && !Array.isArray(input)
}

function integer(input: unknown, min: number, max: number): boolean {
  return typeof input === 'number' && Number.isSafeInteger(input) && input >= min && input <= max
}

export function readClub(raw: string): Club {
  if (raw.length > 128_000) throw new Error('This file is too large to be a club save.')
  const data: unknown = JSON.parse(raw)
  if (!record(data) || data.version !== 1 || typeof data.mode !== 'string' || !['both', 'basketball', 'soccer'].includes(data.mode)) {
    throw new Error('This is an unsupported club save.')
  }
  const club = data as unknown as Club
  if (!Array.isArray(club.roster) || club.roster.length < profiles.length || club.roster.length > profiles.length + 1
    || club.roster.some(player => !record(player) || typeof player.id !== 'string'
      || typeof player.specialty !== 'string' || !Object.hasOwn(SPECIALTIES, player.specialty) || !integer(player.fatigue, 0, 65)
      || !record(player.xp) || !integer(player.xp.basketball, 0, 60) || !integer(player.xp.soccer, 0, 60))) {
    throw new Error('The club roster in this save is invalid.')
  }
  const ids = club.roster.map(player => profile(player.id).id)
  if (new Set(ids).size !== ids.length || profiles.some(player => !ids.includes(player.id))
    || !record(club.lineups) || (['basketball', 'soccer'] as const).some(sport =>
      !Array.isArray(club.lineups[sport]) || club.lineups[sport].length !== ROLES[sport].length
        || new Set(club.lineups[sport]).size !== ROLES[sport].length
        || club.lineups[sport].some(id => !ids.includes(id))) || !profile(club.lineups.soccer[0]).keeper) {
    throw new Error('The lineups in this save are invalid.')
  }
  if (!Array.isArray(club.results) || club.results.length > schedule(club.mode).length
    || club.results.some(score => !Array.isArray(score) || score.length !== 2 || score.some(value => !integer(value, 0, 54)))
    || !integer(club.trainedWeek, 0, nextFixture(club)?.week ?? 4)) {
    throw new Error('The season schedule in this save is invalid.')
  }
  if (club.pending !== null) {
    const upcoming = nextFixture(club)
    if (!record(club.pending) || !upcoming || !Array.isArray(club.pending.turns)
      || club.pending.turns.length >= (upcoming.sport === 'basketball' ? 12 : 18)
      || club.pending.turns.some(turn => !Array.isArray(turn) || turn.length > 3
        || turn.some(order => !record(order) || typeof order.athlete !== 'string' || typeof order.kind !== 'string'
          || ('target' in order && typeof order.target !== 'string' && typeof order.target !== 'number')))) {
      throw new Error('The current fixture in this save is invalid.')
    }
  }
  return club
}
