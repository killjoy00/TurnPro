import { clamp } from './math.ts'
import { SIGNATURES, SIGNATURE_XP, supportsSignatures, type Signature } from './athlete-abilities.ts'
import type { Appearance, AthleteBuild, PlanCommand, Technique } from './match.ts'
import { PREVIOUS_RULES_VERSION as ORIGINAL_SOCCER_RULES } from './soccer.ts'
import { isFormation, type Formation } from './football.ts'
import {
  emptyProgression, MAX_MASTERY, MAX_TECHNICAL_RANK, SIGNATURE_MASTERY, SPECIALTY_NAMES, TECHNICAL_PREREQUISITE,
  TECHNICAL_SKILLS, type Mastery, type Specialty, type TechnicalSkill, type TechnicalTraining,
} from './progression.ts'
import { ATHLETIC_TRAITS, isAthleticTrait, MAX_TRAIT, UNTRAINED, type Athletics, type AthleticTrait } from './athletics.ts'
import {
  schedule, seasonSchedule, seasonSports, simulateRivals, SPORTS, TURN_LIMITS,
  type Fixture, type LeagueProgress, type Score, type SeasonMode, type SeasonRecord, type Sport,
} from './league.ts'

export { schedule } from './league.ts'
export type { SeasonMode, Sport } from './league.ts'
export type { Specialty } from './progression.ts'
export const SPECIALTIES: Record<Specialty, string> = {
  Playmaker: '+2 passing, −1 finishing',
  Defender: '+2 defensive pressure, −1 finishing',
  Finisher: '+2 finishing, −1 passing',
}

export const TECHNIQUES: Record<Technique, { label: string; detail: string; specialty?: Specialty; trait?: AthleticTrait }> = {
  'thread-pass': { label: 'Thread the pass', detail: 'Improves guarded passes.', specialty: 'Playmaker' },
  'read-play': { label: 'Read the play', detail: 'Improves contests, interceptions and saves.', specialty: 'Defender' },
  'clean-look': { label: 'Clean look', detail: 'Improves uncontested shots.', specialty: 'Finisher' },
  'second-wind': { label: 'Second wind', detail: 'Recovers more stamina on turns without an order.' },
  'quick-step': { label: 'Quick step', detail: 'Extends ordered movement and routes at 50 stamina or higher.', trait: 'speed' },
  anchor: { label: 'Anchor', detail: 'Improves contact on rebounds, tackles, forechecks, and runs.', trait: 'strength' },
}

interface Profile {
  id: string
  name: string
  awareness: number
  basketball: number
  soccer: number
  specialty: Specialty
  naturalTrait: AthleticTrait
  keeper?: boolean
}

const profiles: Profile[] = [
  { id: 'reed', name: 'Reed', awareness: 9, basketball: 3, soccer: 1, specialty: 'Playmaker', naturalTrait: 'composure' },
  { id: 'vale', name: 'Vale', awareness: 6, basketball: 2, soccer: 2, specialty: 'Finisher', naturalTrait: 'speed' },
  { id: 'blake', name: 'Blake', awareness: 7, basketball: 2, soccer: 3, specialty: 'Defender', naturalTrait: 'strength' },
  { id: 'diaz', name: 'Diaz', awareness: 6, basketball: 2, soccer: 2, specialty: 'Defender', naturalTrait: 'endurance' },
  { id: 'okafor', name: 'Okafor', awareness: 7, basketball: 3, soccer: 2, specialty: 'Defender', naturalTrait: 'strength' },
  { id: 'shaw', name: 'Shaw', awareness: 6, basketball: 1, soccer: 3, specialty: 'Defender', naturalTrait: 'composure', keeper: true },
  { id: 'mora', name: 'Mora', awareness: 5, basketball: 1, soccer: 3, specialty: 'Defender', naturalTrait: 'endurance' },
  { id: 'chen', name: 'Chen', awareness: 8, basketball: 1, soccer: 3, specialty: 'Playmaker', naturalTrait: 'composure' },
  { id: 'santos', name: 'Santos', awareness: 7, basketball: 1, soccer: 3, specialty: 'Playmaker', naturalTrait: 'endurance' },
  { id: 'adeyemi', name: 'Adeyemi', awareness: 6, basketball: 1, soccer: 3, specialty: 'Finisher', naturalTrait: 'speed' },
  { id: 'ito', name: 'Ito', awareness: 5, basketball: 1, soccer: 3, specialty: 'Finisher', naturalTrait: 'speed' },
  { id: 'rowan', name: 'Rowan', awareness: 6, basketball: 2, soccer: 2, specialty: 'Playmaker', naturalTrait: 'endurance' },
]

export const PROSPECTS: readonly Profile[] = [
  { id: 'imani', name: 'Imani', awareness: 8, basketball: 1, soccer: 3, specialty: 'Defender', naturalTrait: 'composure', keeper: true },
  { id: 'cruz', name: 'Cruz', awareness: 6, basketball: 3, soccer: 2, specialty: 'Finisher', naturalTrait: 'strength' },
  { id: 'lin', name: 'Lin', awareness: 9, basketball: 2, soccer: 2, specialty: 'Playmaker', naturalTrait: 'composure' },
  { id: 'foster', name: 'Foster', awareness: 7, basketball: 2, soccer: 3, specialty: 'Defender', naturalTrait: 'endurance', keeper: true },
  { id: 'sato', name: 'Sato', awareness: 8, basketball: 1, soccer: 3, specialty: 'Finisher', naturalTrait: 'speed' },
  { id: 'miles', name: 'Miles', awareness: 8, basketball: 3, soccer: 1, specialty: 'Playmaker', naturalTrait: 'endurance' },
]

export const ROLES: Record<Sport, readonly string[]> = {
  basketball: ['PG', 'SG', 'SF', 'PF', 'C'],
  soccer: ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'CM', 'AM', 'LW', 'ST', 'RW'],
  hockey: ['C', 'LW', 'RW', 'LD', 'RD', 'Reserve C', 'Reserve LW', 'Reserve RW', 'Reserve LD', 'Reserve RD', 'GK'],
  football: ['QB / S', 'RB / LB', 'LT / DE', 'LG / DT', 'C / LB', 'RG / DT', 'RT / DE', 'WR / CB', 'WR / CB', 'WR / S', 'TE / LB'],
}

const DEFAULT_LINEUPS: Record<Sport, string[]> = {
  basketball: ['reed', 'vale', 'blake', 'diaz', 'okafor'],
  soccer: ['shaw', 'mora', 'blake', 'okafor', 'diaz', 'chen', 'reed', 'santos', 'vale', 'adeyemi', 'ito'],
  hockey: ['reed', 'vale', 'okafor', 'blake', 'diaz', 'rowan', 'santos', 'ito', 'chen', 'mora', 'shaw'],
  football: ['reed', 'santos', 'blake', 'diaz', 'chen', 'rowan', 'mora', 'vale', 'okafor', 'ito', 'adeyemi'],
}
const INITIAL_XP: Record<Sport, number> = { basketball: 0, soccer: 0, hockey: 0, football: 0 }
const INITIAL_TECHNIQUES: Record<Sport, Technique | null> = { basketball: null, soccer: null, hockey: null, football: null }
export const MAX_FILM_BONUS = 2
export type TrainingFocus = Sport | AthleticTrait | 'film' | 'recovery'
const ROLE_THRESHOLD = 3
const MAX_ROLE_STARTS = ROLE_THRESHOLD * 2
type RoleRating = 'keeping' | 'passing' | 'defense' | 'finishing'
const ROLE_RATINGS: Record<Sport, Partial<Record<string, RoleRating>>> = {
  basketball: { PG: 'passing', PF: 'defense', C: 'defense' },
  soccer: { GK: 'keeping', LB: 'defense', CB: 'defense', RB: 'defense', DM: 'passing', CM: 'passing', AM: 'passing' },
  hockey: { GK: 'keeping', C: 'passing', LD: 'defense', RD: 'defense' },
  football: { 'QB / S': 'passing', 'LT / DE': 'defense', 'LG / DT': 'defense', 'C / LB': 'defense',
    'RG / DT': 'defense', 'RT / DE': 'defense' },
}

function emptyRoleStarts(): Record<Sport, Record<string, number>> {
  return { basketball: {}, soccer: {}, hockey: {}, football: {} }
}

export function roleName(sport: Sport, slot: number): string {
  return ROLES[sport][slot].replace(/^Reserve /, '')
}

export function roleProgress(sport: Sport, role: string, starts: number) {
  const rating = ROLE_RATINGS[sport][role] ?? 'finishing'
  const level = Math.min(2, Math.floor(starts / ROLE_THRESHOLD))
  return { rating, level, maxStarts: MAX_ROLE_STARTS, nextAt: level < 2 ? (level + 1) * ROLE_THRESHOLD : null }
}

export function keeperSlot(sport: Sport): number {
  return sport === 'soccer' ? 0 : sport === 'hockey' ? 10 : -1
}

export interface ClubAthlete {
  id: string
  specialty: Specialty
  xp: Record<Sport, number>
  fatigue: number
  film: number
  athletics: Athletics
  roleStarts: Record<Sport, Record<string, number>>
  equipped: Record<Sport, Technique | null>
  learned: Record<Sport, Signature[]>
  signature: Record<Sport, Signature | null>
  mastery: Mastery
  technical: TechnicalTraining
}

export interface Club extends SeasonRecord {
  version: 7
  season: number
  history: SeasonRecord[]
  recruitedSeason: number
  roster: ClubAthlete[]
  lineups: Record<Sport, string[]>
  trainedWeek: number
  pending: {
    rules: number
    turns: PlanCommand[][]
    formations?: (Formation | null)[]
    opponentPlans?: (PlanCommand[] | null)[]
    athletics?: Athletics[]
  } | null
}

export function profile(id: string): Profile {
  const found = [...profiles, ...PROSPECTS].find(candidate => candidate.id === id)
  if (!found) throw new Error('Unknown club athlete.')
  return found
}

function emptySignatures(): Pick<ClubAthlete, 'learned' | 'signature'> {
  return {
    learned: { basketball: [], soccer: [], hockey: [], football: [] },
    signature: { basketball: null, soccer: null, hockey: null, football: null },
  }
}

function makeAthlete(entry: Profile): ClubAthlete {
  return { id: entry.id, specialty: entry.specialty, xp: { ...INITIAL_XP }, fatigue: 0, film: 0, equipped: { ...INITIAL_TECHNIQUES },
    athletics: { ...UNTRAINED }, roleStarts: emptyRoleStarts(), ...emptySignatures(), ...emptyProgression() }
}

export function createClub(mode: SeasonMode): Club {
  return {
    version: 7, season: 1, history: [], recruitedSeason: 0, mode, league: { seedOffset: 0, otherResults: [] }, roster: profiles.map(makeAthlete),
    lineups: structuredClone(DEFAULT_LINEUPS),
    trainedWeek: 0, results: [], pending: null,
  }
}

export function nextSeason(club: Club, mode: SeasonMode): Club {
  if (nextFixture(club) || club.pending) throw new Error('Finish the current season first.')
  return {
    ...club, mode, season: club.season + 1, history: [...club.history, { mode: club.mode, results: club.results, league: club.league }],
    results: [], league: { seedOffset: (club.season * 257) >>> 0, otherResults: [] }, pending: null, trainedWeek: 0,
    roster: club.roster.map(player => ({ ...player, fatigue: Math.max(0, player.fatigue - 30) })),
  }
}

export function nextFixture(club: Club): Fixture | undefined {
  return seasonSchedule(club, club.season)[club.results.length]
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

function trainingWeek(club: Club): number {
  const week = openWeek(club)
  if (club.trainedWeek === week) throw new Error('You have used this week’s training session.')
  return week
}

function growMastery(player: ClubAthlete, points: number): Mastery {
  return { ...player.mastery, [player.specialty]: Math.min(MAX_MASTERY, player.mastery[player.specialty] + points) }
}

export function train(club: Club, id: string, focus: TrainingFocus): Club {
  const week = trainingWeek(club)
  const improved = { ...clubAthlete(club, id) }
  if (focus === 'film') {
    if (improved.film >= MAX_FILM_BONUS) throw new Error('This athlete has reached their film-study limit.')
    improved.film += 1
  } else if (focus === 'recovery') {
    if (!improved.fatigue) throw new Error('This athlete is fully rested.')
    improved.fatigue = Math.max(0, improved.fatigue - 28)
  } else if (isAthleticTrait(focus)) {
    if (improved.athletics[focus] >= MAX_TRAIT) throw new Error('This attribute is fully trained.')
    improved.athletics = { ...improved.athletics, [focus]: improved.athletics[focus] + 1 }
  } else {
    if (!seasonSports(club.mode).includes(focus)) throw new Error('Choose a sport in your season.')
    improved.xp = { ...improved.xp, [focus]: improved.xp[focus] + 3 }
    improved.mastery = growMastery(improved, 1)
  }
  return { ...club, trainedWeek: week, roster: club.roster.map(player => player.id === id ? improved : player) }
}

export function canTrainTechnical(player: ClubAthlete, sport: Sport, skill: TechnicalSkill): boolean {
  return SPORTS.includes(sport) && TECHNICAL_SKILLS.includes(skill)
    && player.xp[sport] >= TECHNICAL_PREREQUISITE && player.technical[sport][skill] < MAX_TECHNICAL_RANK
}

export function trainTechnical(club: Club, id: string, sport: Sport, skill: TechnicalSkill): Club {
  const week = trainingWeek(club)
  const player = clubAthlete(club, id)
  if (!seasonSports(club.mode).includes(sport) || !canTrainTechnical(player, sport, skill)) {
    throw new Error('This skill drill is unavailable.')
  }
  const updated = {
    ...player,
    xp: { ...player.xp, [sport]: player.xp[sport] + 1 },
    technical: { ...player.technical, [sport]: { ...player.technical[sport], [skill]: player.technical[sport][skill] + 1 } },
  }
  return { ...club, trainedWeek: week, roster: club.roster.map(entry => entry.id === id ? updated : entry) }
}

export function specialize(club: Club, id: string, specialty: Specialty): Club {
  openWeek(club)
  clubAthlete(club, id)
  if (!Object.hasOwn(SPECIALTIES, specialty)) throw new Error('Choose a valid specialty.')
  const player = { ...clubAthlete(club, id), specialty }
  player.equipped = { ...player.equipped }
  for (const sport of SPORTS) {
    if (!unlocked(player, sport, player.equipped[sport])) player.equipped[sport] = null
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
  const keeper = keeperSlot(sport)
  if (keeper >= 0 && !profile(ids[keeper]).keeper) throw new Error('The goalkeeper slot needs a trained keeper.')
  return { ...club, lineups: { ...club.lineups, [sport]: ids } }
}

export function unlockRequirement(technique: Technique): string {
  const { specialty, trait } = TECHNIQUES[technique]
  if (trait) return `${ATHLETIC_TRAITS[trait].name} 1 · 3 XP in this sport`
  return specialty ? `${specialty} · 6 XP in this sport` : '5 total XP across sports'
}

export function unlocked(player: ClubAthlete, sport: Sport, technique: Technique | null): boolean {
  if (technique === null) return true
  const ability = TECHNIQUES[technique]
  if (!ability) return false
  if (ability.trait) return physicalProfile(player)[ability.trait] >= 1 && player.xp[sport] >= 3
  return ability.specialty ? player.xp[sport] >= 6
    && (player.specialty === ability.specialty || player.mastery[ability.specialty] >= MAX_MASTERY)
    : SPORTS.reduce((total, played) => total + player.xp[played], 0) >= 5
}

export function equip(club: Club, id: string, sport: Sport, technique: Technique | null): Club {
  openWeek(club)
  const player = clubAthlete(club, id)
  if (!unlocked(player, sport, technique)) throw new Error('This ability is still locked.')
  const updated = { ...player, equipped: { ...player.equipped, [sport]: technique } }
  return { ...club, roster: club.roster.map(entry => entry.id === id ? updated : entry) }
}

export function canLearnSignature(player: ClubAthlete, sport: Sport, signature: Signature): boolean {
  return supportsSignatures(sport) && Object.hasOwn(SIGNATURES, signature)
    && player.specialty === SIGNATURES[signature].specialty && player.xp[sport] >= SIGNATURE_XP
    && player.mastery[player.specialty] >= SIGNATURE_MASTERY
    && !player.learned[sport].includes(signature)
}

export function learnSignature(club: Club, id: string, sport: Sport, signature: Signature): Club {
  const week = trainingWeek(club)
  const player = clubAthlete(club, id)
  if (!seasonSports(club.mode).includes(sport) || !canLearnSignature(player, sport, signature)) {
    throw new Error('This signature play cannot be learned yet.')
  }
  const updated = {
    ...player,
    learned: { ...player.learned, [sport]: [...player.learned[sport], signature] },
    signature: { ...player.signature, [sport]: player.signature[sport] ?? signature },
  }
  return { ...club, trainedWeek: week, roster: club.roster.map(entry => entry.id === id ? updated : entry) }
}

export function equipSignature(club: Club, id: string, sport: Sport, signature: Signature | null): Club {
  openWeek(club)
  const player = clubAthlete(club, id)
  if (!supportsSignatures(sport) || (signature !== null && !player.learned[sport].includes(signature))) {
    throw new Error('Learn this signature play before equipping it.')
  }
  const updated = { ...player, signature: { ...player.signature, [sport]: signature } }
  return { ...club, roster: club.roster.map(entry => entry.id === id ? updated : entry) }
}

export function development(player: ClubAthlete, sport: Sport): number {
  return Math.min(3, Math.floor(player.xp[sport] / 3))
}

export function baseSkill(entry: Profile, sport: Sport): number {
  return sport === 'hockey' ? (entry.keeper || entry.soccer === 3 ? 3 : 2)
    : sport === 'football' ? (entry.basketball === 3 || entry.specialty === 'Defender' ? 3 : 2) : entry[sport]
}

export function physicalProfile(player: ClubAthlete): Athletics {
  const trait = profile(player.id).naturalTrait
  return { ...player.athletics, [trait]: player.athletics[trait] + 1 }
}

export function ratings(player: ClubAthlete, sport: Sport, slot?: number, athletics = physicalProfile(player)): AthleteBuild {
  const entry = profile(player.id)
  const trained = development(player, sport)
  const skill = baseSkill(entry, sport) + trained
  const drills = player.technical[sport]
  const pass = player.specialty === 'Playmaker' ? 2 : player.specialty === 'Finisher' ? -1 : 0
  const finish = player.specialty === 'Finisher' ? 2 : -1
  const result: AthleteBuild = {
    name: entry.name, stamina: 100 - player.fatigue, awareness: entry.awareness + player.film,
    passing: clamp(4 + skill + pass, 2, 12) + drills.passing, finishing: clamp(4 + skill + finish, 2, 12) + drills.finishing,
    defense: (player.specialty === 'Defender' ? 2 : 0) + (sport === 'hockey' || sport === 'football' ? trained : 0) + drills.defense,
    keeping: entry.keeper ? 6 + skill : 0,
    technique: player.equipped[sport] ?? undefined,
  }
  if (player.signature[sport]) result.signature = player.signature[sport]
  if (Object.values(athletics).some(Boolean)) result.athletics = { ...athletics }
  if (slot !== undefined) {
    const role = roleName(sport, slot)
    const { rating, level } = roleProgress(sport, role, player.roleStarts[sport][role] ?? 0)
    result[rating] += level
  }
  return result
}

export function startFixture(club: Club, rules: number): Club {
  openWeek(club)
  return { ...club, pending: { rules, turns: [] } }
}

export function settleFixture(club: Club, score: Score, players: readonly { team: number; stamina: number }[],
  appearances?: readonly Appearance[]): Club {
  const fixture = nextFixture(club)
  const pending = club.pending
  if (!fixture || !pending) throw new Error('There is no current fixture.')
  const starters = club.lineups[fixture.sport]
  const onField = players.filter(player => player.team === 0)
  const played = appearances ?? onField.map(({ stamina }, slot) => ({
    slot, stamina, orders: pending.turns.filter(turn => turn.some(order => order.athlete === `0-${slot}`)).length,
  }))
  const roster = club.roster.map(player => {
    const appearance = played.find(({ slot }) => starters[slot] === player.id)
    if (!appearance) return { ...player, fatigue: Math.max(0, player.fatigue - 14) }
    const exertion = Math.max(0, 100 - player.fatigue - appearance.stamina)
    const role = roleName(fixture.sport, appearance.slot)
    const starts = player.roleStarts[fixture.sport]
    const experience = appearance.orders >= 3 ? 2 : 1
    return {
      ...player, fatigue: clamp(player.fatigue + 23 + Math.round(exertion / 3), 0, 65),
      xp: { ...player.xp, [fixture.sport]: player.xp[fixture.sport] + experience },
      mastery: growMastery(player, experience),
      roleStarts: { ...player.roleStarts, [fixture.sport]: { ...starts, [role]: Math.min(MAX_ROLE_STARTS, (starts[role] ?? 0) + 1) } },
    }
  })
  const league = club.league && fixture.stage === 'regular'
    ? { ...club.league, otherResults: [...club.league.otherResults, simulateRivals(fixture, { rulesVersion: pending.rules })] } : club.league
  const next = { ...club, roster, league, results: [...club.results, score], pending: null }
  if (nextFixture(next)?.week !== fixture.week) {
    const daysOff = club.mode === 'all' ? 24 : 18
    next.roster = roster.map(player => ({ ...player, fatigue: Math.max(0, player.fatigue - daysOff) }))
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
  return input === 'both' || input === 'all' || (SPORTS as readonly unknown[]).includes(input)
}

function isScore(score: unknown): score is Score {
  return Array.isArray(score) && score.length === 2 && score.every(value => integer(value, 0, 168))
}

function seasonValid(input: unknown, season: number, complete = false): input is SeasonRecord {
  if (!record(input) || !isMode(input.mode) || !Array.isArray(input.results) || !input.results.every(isScore)) return false
  const fixtures = schedule(input.mode)
  const fitsSport = (score: Score, fixture?: Fixture) => Boolean(fixture && (fixture.sport === 'football' || score.every(value => value <= 54)))
  const regular = fixtures.length
  if (input.league === null) return input.results.length === regular && input.results.every((score, index) => fitsSport(score, fixtures[index]))
  const league = input.league
  if (!record(league) || !integer(league.seedOffset, 0, 0xffffffff) || !Array.isArray(league.otherResults)
    || !league.otherResults.every((score, index) => isScore(score) && fitsSport(score, fixtures[index]))
    || league.otherResults.length !== Math.min(input.results.length, regular)
    || input.results.length > regular + seasonSports(input.mode).length) return false
  const fullSchedule = seasonSchedule(input as unknown as SeasonRecord, season)
  if (!input.results.every((score, index) => fitsSport(score, fullSchedule[index]))) return false
  const total = fullSchedule.length
  return complete ? input.results.length === total : input.results.length <= total
}

function migrateLeague(data: Record<string, unknown>): Record<string, unknown> {
  if (data.version === 3 || !isMode(data.mode) || !Array.isArray(data.results)
    || !data.results.every(isScore) || !Array.isArray(data.roster)) return data
  const regular = schedule(data.mode)
  if (data.results.length > regular.length) return data
  const previous = data.version === 1 ? { ...data, season: 1, history: [],
    recruitedSeason: data.roster.length > profiles.length ? 1 : 0,
    roster: data.roster.map(player => ({ ...player, equipped: { basketball: null, soccer: null } })),
  } : data
  if (!Array.isArray(previous.history)) return data
  const league: LeagueProgress | null = data.results.length === regular.length ? null
    : { seedOffset: 0, otherResults: regular.slice(0, data.results.length).map(fixture =>
      simulateRivals(fixture, { rulesVersion: ORIGINAL_SOCCER_RULES })) }
  return { ...previous, version: 3, league, history: previous.history.map(entry => ({ ...entry, league: null })) }
}

function migrateFourSports(data: Record<string, unknown>): Record<string, unknown> {
  if (data.version === 4) return data
  if (data.mode !== 'both' && data.mode !== 'basketball' && data.mode !== 'soccer') return data
  const previous = migrateLeague(data)
  if (previous.version !== 3 || !Array.isArray(previous.roster) || !record(previous.lineups)) return data
  return {
    ...previous, version: 4, lineups: { ...structuredClone(DEFAULT_LINEUPS), ...previous.lineups },
    roster: previous.roster.map(player => record(player) && record(player.xp) && record(player.equipped) ? {
      ...player, film: 0, xp: { hockey: 0, football: 0, ...player.xp },
      equipped: { hockey: null, football: null, ...player.equipped },
    } : player),
  }
}

function migrateAthletics(data: Record<string, unknown>): Record<string, unknown> {
  if (data.version === 5) return data
  const previous = migrateFourSports(data)
  if (previous.version !== 4 || !Array.isArray(previous.roster)) return previous
  return { ...previous, version: 5, roster: previous.roster.map(player => record(player)
    ? { ...player, athletics: { ...UNTRAINED }, roleStarts: emptyRoleStarts() } : player) }
}

function migrateSignatures(data: Record<string, unknown>): Record<string, unknown> {
  if (data.version === 6) return data
  const previous = migrateAthletics(data)
  if (previous.version !== 5 || !Array.isArray(previous.roster)) return previous
  return { ...previous, version: 6, roster: previous.roster.map(player => record(player)
    ? { ...player, ...emptySignatures() } : player) }
}

function migrateClub(data: Record<string, unknown>): unknown {
  if (data.version === 7) return data
  const previous = migrateSignatures(data)
  if (previous.version !== 6 || !Array.isArray(previous.roster)) return previous
  return { ...previous, version: 7, roster: previous.roster.map(player => {
    if (!record(player)) return player
    const progress = emptyProgression()
    const learned = player.learned
    if (record(learned)) {
      for (const [key, ability] of Object.entries(SIGNATURES)) {
        if (SPORTS.some(sport => Array.isArray(learned[sport]) && learned[sport].includes(key))) {
          progress.mastery[ability.specialty] = SIGNATURE_MASTERY
        }
      }
    }
    return { ...player, ...progress }
  }) }
}

function validPlan(input: unknown): input is PlanCommand[] {
  return Array.isArray(input) && input.length <= 3
    && input.every(order => record(order) && typeof order.athlete === 'string' && typeof order.kind === 'string'
      && (!('target' in order) || typeof order.target === 'string' || typeof order.target === 'number'))
}

export function readClub(raw: string): Club {
  if (raw.length > 128_000) throw new Error('This file is too large to be a club save.')
  const data: unknown = JSON.parse(raw)
  if (!record(data) || ![1, 2, 3, 4, 5, 6, 7].includes(data.version as number) || !isMode(data.mode)) {
    throw new Error('This is an unsupported club save.')
  }
  const club = migrateClub(data) as Club
  if (club.version !== 7 || !Array.isArray(club.history) || club.season !== club.history.length + 1
    || !integer(club.recruitedSeason, 0, club.season)
    || !club.history.every((entry, index) => seasonValid(entry, index + 1, true))) {
    throw new Error('The past seasons in this save are invalid.')
  }
  if (!Array.isArray(club.roster) || club.roster.length < profiles.length || club.roster.length > profiles.length + PROSPECTS.length
    || club.roster.some(player => !record(player) || typeof player.id !== 'string'
      || typeof player.specialty !== 'string' || !Object.hasOwn(SPECIALTIES, player.specialty) || !integer(player.fatigue, 0, 65)
      || !integer(player.film, 0, MAX_FILM_BONUS) || !record(player.xp) || !record(player.equipped)
      || !record(player.athletics) || !Object.keys(ATHLETIC_TRAITS).every(trait => integer(player.athletics[trait as AthleticTrait], 0, MAX_TRAIT))
      || !record(player.mastery) || SPECIALTY_NAMES.some(role => !integer(player.mastery[role], 0, MAX_MASTERY))
      || !record(player.technical) || !record(player.roleStarts) || !record(player.learned) || !record(player.signature)
      || SPORTS.some(sport => {
        const roles = player.roleStarts[sport]
        if (!record(roles) || Object.entries(roles).some(([role, starts]) =>
          !ROLES[sport].some((_, slot) => roleName(sport, slot) === role) || !integer(starts, 0, MAX_ROLE_STARTS))) return true
        if (!integer(player.xp[sport], 0, Number.MAX_SAFE_INTEGER)) return true
        const drills = player.technical[sport]
        if (!record(drills) || TECHNICAL_SKILLS.some(skill => !integer(drills[skill], 0, MAX_TECHNICAL_RANK))) return true
        const totalDrills = TECHNICAL_SKILLS.reduce((total, skill) => total + drills[skill], 0)
        if (totalDrills > 0 && player.xp[sport] < TECHNICAL_PREREQUISITE + totalDrills) return true
        const learned = player.learned[sport]
        const signature = player.signature[sport]
        if (!Array.isArray(learned) || learned.length > Object.keys(SIGNATURES).length || new Set(learned).size !== learned.length
          || learned.some(key => !supportsSignatures(sport) || typeof key !== 'string'
            || !Object.hasOwn(SIGNATURES, key) || player.xp[sport] < SIGNATURE_XP
            || player.mastery[SIGNATURES[key as Signature].specialty] < SIGNATURE_MASTERY)
          || (signature !== null && !learned.includes(signature))) return true
        const selected = player.equipped[sport]
        return selected !== null && (typeof selected !== 'string' || !Object.hasOwn(TECHNIQUES, selected)
          || !unlocked(player, sport, selected))
      }))) {
    throw new Error('The club roster in this save is invalid.')
  }
  const ids = club.roster.map(player => profile(player.id).id)
  if (new Set(ids).size !== ids.length || profiles.some(player => !ids.includes(player.id))
    || !record(club.lineups) || SPORTS.some(sport =>
      !Array.isArray(club.lineups[sport]) || club.lineups[sport].length !== ROLES[sport].length
        || new Set(club.lineups[sport]).size !== ROLES[sport].length
        || club.lineups[sport].some(id => !ids.includes(id))
        || (keeperSlot(sport) >= 0 && !profile(club.lineups[sport][keeperSlot(sport)]).keeper))) {
    throw new Error('The lineups in this save are invalid.')
  }
  if (!seasonValid(club, club.season) || !integer(club.trainedWeek, 0, nextFixture(club)?.week ?? seasonSchedule(club, club.season).at(-1)!.week)) {
    throw new Error('The season schedule in this save is invalid.')
  }
  if (club.pending !== null) {
    const upcoming = nextFixture(club)
    if (!record(club.pending) || !upcoming || !Array.isArray(club.pending.turns)
      || club.pending.turns.length >= TURN_LIMITS[upcoming.sport]
      || (club.pending.formations !== undefined && (upcoming.sport !== 'football' || !Array.isArray(club.pending.formations)
        || club.pending.formations.length !== club.pending.turns.length
        || club.pending.formations.some(formation => formation !== null && !isFormation(formation))))
      || (club.pending.opponentPlans !== undefined && (!Array.isArray(club.pending.opponentPlans)
        || club.pending.opponentPlans.length !== club.pending.turns.length
        || club.pending.opponentPlans.some(plan => plan !== null && !validPlan(plan))))
      || (club.pending.athletics !== undefined && (!Array.isArray(club.pending.athletics)
        || club.pending.athletics.length !== ROLES[upcoming.sport].length
        || club.pending.athletics.some(traits => !record(traits) || Object.keys(ATHLETIC_TRAITS)
          .some(trait => !integer(traits[trait as AthleticTrait], 0, MAX_TRAIT + 1)))))
      || club.pending.turns.some(plan => !validPlan(plan))) {
      throw new Error('The current fixture in this save is invalid.')
    }
  }
  return club
}
