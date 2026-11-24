import { clamp } from './math.ts'
import type { PlanCommand, Technique } from './match.ts'
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

export const TECHNIQUES: Record<Technique, { label: string; detail: string; specialty?: Specialty }> = {
  'thread-pass': { label: 'Thread the pass', detail: 'Improves guarded passes.', specialty: 'Playmaker' },
  'read-play': { label: 'Read the play', detail: 'Improves contests, interceptions and saves.', specialty: 'Defender' },
  'clean-look': { label: 'Clean look', detail: 'Improves uncontested shots.', specialty: 'Finisher' },
  'second-wind': { label: 'Second wind', detail: 'Recovers more stamina on turns without an order.' },
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
  { id: 'foster', name: 'Foster', awareness: 7, basketball: 2, soccer: 3, specialty: 'Defender', keeper: true },
  { id: 'sato', name: 'Sato', awareness: 8, basketball: 1, soccer: 3, specialty: 'Finisher' },
  { id: 'miles', name: 'Miles', awareness: 8, basketball: 3, soccer: 1, specialty: 'Playmaker' },
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
  equipped: Record<Sport, Technique | null>
}

export interface SeasonRecord {
  mode: SeasonMode
  results: [number, number][]
}

export interface Club {
  version: 2
  season: number
  history: SeasonRecord[]
  recruitedSeason: number
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
  return { id: entry.id, specialty: entry.specialty, xp: { basketball: 0, soccer: 0 }, fatigue: 0, equipped: { basketball: null, soccer: null } }
}

export function createClub(mode: SeasonMode): Club {
  return {
    version: 2, season: 1, history: [], recruitedSeason: 0, mode, roster: profiles.map(makeAthlete),
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

export function nextSeason(club: Club, mode: SeasonMode): Club {
  if (nextFixture(club) || club.pending) throw new Error('Finish the current season first.')
  return {
    ...club, mode, season: club.season + 1, history: [...club.history, { mode: club.mode, results: club.results }],
    results: [], pending: null, trainedWeek: 0,
    roster: club.roster.map(player => ({ ...player, fatigue: Math.max(0, player.fatigue - 30) })),
  }
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

export function availableProspects(club: Club): readonly Profile[] {
  return club.recruitedSeason === club.season ? [] : PROSPECTS.filter(entry => !club.roster.some(player => player.id === entry.id))
}

export function recruit(club: Club, id: string): Club {
  openWeek(club)
  const prospect = availableProspects(club).find(candidate => candidate.id === id)
  if (!prospect) throw new Error('Choose one available prospect this season.')
  return { ...club, recruitedSeason: club.season, roster: [...club.roster, makeAthlete(prospect)] }
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
  const player = { ...clubAthlete(club, id), specialty }
  player.equipped = {
    basketball: unlocked(player, 'basketball', player.equipped.basketball) ? player.equipped.basketball : null,
    soccer: unlocked(player, 'soccer', player.equipped.soccer) ? player.equipped.soccer : null,
  }
  return { ...club, roster: club.roster.map(entry => entry.id === id ? player : entry) }
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

export function unlockRequirement(technique: Technique): string {
  const specialty = TECHNIQUES[technique].specialty
  return specialty ? `${specialty} · 6 XP in this sport` : '5 total XP across sports'
}

export function unlocked(player: ClubAthlete, sport: Sport, technique: Technique | null): boolean {
  if (technique === null) return true
  const ability = TECHNIQUES[technique]
  if (!ability) return false
  return ability.specialty ? player.specialty === ability.specialty && player.xp[sport] >= 6
    : player.xp.basketball + player.xp.soccer >= 5
}

export function equip(club: Club, id: string, sport: Sport, technique: Technique | null): Club {
  openWeek(club)
  const player = clubAthlete(club, id)
  if (!unlocked(player, sport, technique)) throw new Error('This ability is still locked.')
  const updated = { ...player, equipped: { ...player.equipped, [sport]: technique } }
  return { ...club, roster: club.roster.map(entry => entry.id === id ? updated : entry) }
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
    technique: player.equipped[sport] ?? undefined,
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

function isMode(input: unknown): input is SeasonMode {
  return input === 'both' || input === 'basketball' || input === 'soccer'
}

function validResults(results: unknown, mode: SeasonMode, complete = false): boolean {
  const total = schedule(mode).length
  return Array.isArray(results) && results.length <= total && (!complete || results.length === total)
    && results.every(score => Array.isArray(score) && score.length === 2 && score.every(value => integer(value, 0, 54)))
}

export function readClub(raw: string): Club {
  if (raw.length > 128_000) throw new Error('This file is too large to be a club save.')
  const data: unknown = JSON.parse(raw)
  if (!record(data) || (data.version !== 1 && data.version !== 2) || !isMode(data.mode)) {
    throw new Error('This is an unsupported club save.')
  }
  const migrated = data.version === 1 && Array.isArray(data.roster) ? {
    ...data, version: 2, season: 1, history: [], recruitedSeason: data.roster.length > profiles.length ? 1 : 0,
    roster: data.roster.map(player => ({ ...player, equipped: { basketball: null, soccer: null } })),
  } : data
  const club = migrated as unknown as Club
  if (club.version !== 2 || !Array.isArray(club.history) || club.season !== club.history.length + 1
    || !integer(club.recruitedSeason, 0, club.season) || club.history.some(entry =>
      !record(entry) || !isMode(entry.mode) || !validResults(entry.results, entry.mode, true))) {
    throw new Error('The past seasons in this save are invalid.')
  }
  if (!Array.isArray(club.roster) || club.roster.length < profiles.length || club.roster.length > profiles.length + PROSPECTS.length
    || club.roster.some(player => !record(player) || typeof player.id !== 'string'
      || typeof player.specialty !== 'string' || !Object.hasOwn(SPECIALTIES, player.specialty) || !integer(player.fatigue, 0, 65)
      || !record(player.xp) || !integer(player.xp.basketball, 0, Number.MAX_SAFE_INTEGER)
      || !integer(player.xp.soccer, 0, Number.MAX_SAFE_INTEGER) || !record(player.equipped)
      || (['basketball', 'soccer'] as const).some(sport => {
        const selected = player.equipped[sport]
        return selected !== null && (typeof selected !== 'string' || !Object.hasOwn(TECHNIQUES, selected)
          || !unlocked(player, sport, selected))
      }))) {
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
  if (!validResults(club.results, club.mode) || !integer(club.trainedWeek, 0, nextFixture(club)?.week ?? 4)) {
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
