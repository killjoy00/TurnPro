import { laneReaction, LANE_REACTION_COST } from './athlete-abilities.ts'
import { contactBonus, fatiguePenalty, movementMultiplier, recoveryBonus } from './athletics.ts'
import { clamp, distance, distanceToSegment, seededRandom, stepToward, type Point } from './math.ts'

import {
  COMMAND_LIMIT, finalScore, findAthlete, otherTeam, revealPlans, teamNames, validatePlans,
  type AthleteSnapshot, type EventKind, type MatchSnapshot, type Plans, type PlayCue, type ResolvedMove, type Team,
} from './match.ts'

export { COMMAND_LIMIT, otherTeam, TEAMS } from './match.ts'
export type { Team, TurnEvent } from './match.ts'

export const COURT = { width: 50, length: 47, hoop: { x: 25, y: 5 }, arc: 23.75 }
export const RULES_VERSION = 2
export const TURN_LIMIT = 12
export const LANDMARKS = [
  { name: 'Left wing', x: 7, y: 17 },
  { name: 'Top of the arc', x: 25, y: 32 },
  { name: 'Right wing', x: 43, y: 17 },
] as const

export interface Athlete extends AthleteSnapshot {
  home: Point
  speed: number
  strength: number
  passing: number
  shooting: number
}

export interface Match extends MatchSnapshot {
  rulesVersion: number
  randomState: number
  athletes: Athlete[]
}

export type Command =
  | { athlete: string; kind: 'drive' | 'finish' | 'shoot' | 'catch-shoot' | 'screen' | 'roll-screen' | 'protect' | 'switch' | 'help' | 'stay' }
  | { athlete: string; kind: 'pass'; target: string }
  | { athlete: string; kind: 'relay'; target: string }
  | { athlete: string; kind: 'kickout'; target: string }
  | { athlete: string; kind: 'mark' | 'deny'; target: string }
  | { athlete: string; kind: 'cut'; target: number }
  | { athlete: string; kind: 'cut-and-finish'; target: number }

export const ACTIONS = {
  pass: { label: 'Pass', stamina: 6 },
  relay: { label: 'Relay', stamina: 12 },
  shoot: { label: 'Shoot', stamina: 10 },
  'catch-shoot': { label: 'Catch and shoot', stamina: 10 },
  drive: { label: 'Drive', stamina: 14 },
  finish: { label: 'Drive and finish', stamina: 19 },
  kickout: { label: 'Drive and kick out to', stamina: 17 },
  cut: { label: 'Cut', stamina: 10 },
  'cut-and-finish': { label: 'Cut and finish', stamina: 18 },
  screen: { label: 'Set screen', stamina: 8 },
  'roll-screen': { label: 'Screen and roll', stamina: 17 },
  mark: { label: 'Mark', stamina: 8 },
  deny: { label: 'Deny pass', stamina: 8 },
  protect: { label: 'Protect paint', stamina: 6 },
  switch: { label: 'Switch on screen', stamina: 8 },
  help: { label: 'Help on drive', stamina: 8 },
  stay: { label: 'Stay with matchup', stamina: 6 },
} satisfies Record<Command['kind'], { label: string; stamina: number }>

const HOMES = [
  { x: 25, y: 33 },
  { x: 11, y: 24 },
  { x: 40, y: 23 },
  { x: 34, y: 13 },
  { x: 20, y: 24 },
]

const ROSTERS = [
  [
    ['04', 'Reed', 'PG', 9, 5, 9, 7],
    ['11', 'Vale', 'SG', 8, 5, 6, 9],
    ['23', 'Blake', 'SF', 7, 7, 7, 7],
    ['31', 'Diaz', 'PF', 6, 8, 5, 6],
    ['50', 'Okafor', 'C', 5, 10, 5, 6],
  ],
  [
    ['03', 'Quinn', 'PG', 9, 5, 8, 7],
    ['14', 'Park', 'SG', 8, 5, 7, 9],
    ['22', 'Silva', 'SF', 8, 7, 6, 7],
    ['32', 'Wells', 'PF', 6, 8, 6, 6],
    ['45', 'Grant', 'C', 5, 10, 5, 6],
  ],
] as const

export function athleteById(match: Match, id: string): Athlete {
  return findAthlete(match.athletes, id)
}

function setupPossession(match: Match, team: Team) {
  for (const athlete of match.athletes) {
    athlete.position = athlete.team === team
      ? { ...athlete.home }
      : stepToward(athlete.home, COURT.hoop, 4)
  }
  match.holder = `${team}-0`
}

export function createMatch(seed: number, openingTeam: Team = 0): Match {
  const athletes = ROSTERS.flatMap((roster, index) => roster.map((player, slot) => {
    const [number, name, role, speed, strength, passing, shooting] = player
    const home = { ...HOMES[slot] }
    return {
      id: `${index}-${slot}`, team: index as Team, number, name, role,
      home, position: { ...home }, stamina: 100, speed, strength, passing, shooting,
    }
  }))
  const match: Match = {
    rulesVersion: RULES_VERSION, turn: 1, seed: seed >>> 0, randomState: seed >>> 0,
    holder: '', score: [0, 0], athletes,
  }
  setupPossession(match, openingTeam)
  return match
}

export function createPickAndRollPractice(): Match {
  const match = createMatch(0)
  athleteById(match, '0-0').position = { x: 25, y: 24 }
  athleteById(match, '0-4').position = { x: 20, y: 20 }
  athleteById(match, '1-0').position = { x: 26, y: 21 }
  athleteById(match, '1-4').position = { x: 17, y: 17 }
  return match
}

export function finished(match: Match): boolean {
  return match.turn > TURN_LIMIT
}

export function possessionTeam(match: Match): Team {
  return athleteById(match, match.holder).team
}

export function legalCommands(match: Match, id: string): Command[] {
  if (finished(match)) return []
  const athlete = athleteById(match, id)
  const holder = athleteById(match, match.holder)
  const teammates = match.athletes.filter(player => player.team === athlete.team && player.id !== id)
  const opponents = match.athletes.filter(player => player.team !== athlete.team)
  const commands: Command[] = []
  if (athlete.id === holder.id) {
    const range = distance(athlete.position, COURT.hoop)
    if (range > 6) commands.push({ athlete: id, kind: 'drive' })
    if (range > 6 && range <= 27) commands.push({ athlete: id, kind: 'finish' })
    if (range <= 34) commands.push({ athlete: id, kind: 'shoot' })
    for (const teammate of teammates) {
      commands.push({ athlete: id, kind: 'pass', target: teammate.id })
      if (range > 6 && Math.abs(teammate.position.x - COURT.hoop.x) >= 11) {
        commands.push({ athlete: id, kind: 'kickout', target: teammate.id })
      }
    }
  } else if (athlete.team === holder.team) {
    if (athlete.signature === 'relay') {
      for (const teammate of teammates) {
        if (teammate.id !== holder.id) commands.push({ athlete: id, kind: 'relay', target: teammate.id })
      }
    }
    if (distance(athlete.position, COURT.hoop) <= 34) commands.push({ athlete: id, kind: 'catch-shoot' })
    if (distance(athlete.position, holder.position) <= 15) {
      commands.push({ athlete: id, kind: 'screen' }, { athlete: id, kind: 'roll-screen' })
    }
    LANDMARKS.forEach((point, target) => {
      if (distance(athlete.position, point) <= 3) return
      commands.push({ athlete: id, kind: 'cut', target })
      if (athlete.signature === 'cut-and-finish' && distance(point, COURT.hoop) <= 34) {
        commands.push({ athlete: id, kind: 'cut-and-finish', target })
      }
    })
  } else {
    commands.push({ athlete: id, kind: 'protect' }, { athlete: id, kind: 'stay' })
    if (distance(athlete.position, holder.position) <= 19) commands.push({ athlete: id, kind: 'switch' })
    if (distance(athlete.position, COURT.hoop) <= 25) commands.push({ athlete: id, kind: 'help' })
    for (const opponent of opponents) {
      commands.push({ athlete: id, kind: 'mark', target: opponent.id })
      if (opponent.id !== holder.id) commands.push({ athlete: id, kind: 'deny', target: opponent.id })
    }
  }
  return commands.filter(command => ACTIONS[command.kind].stamina <= athlete.stamina)
}

export function commandLabel(match: Match, command: Command): string {
  const label = ACTIONS[command.kind].label
  if (command.kind === 'kickout') return `${label} ${athleteById(match, command.target).name}`
  if (command.kind === 'cut' || command.kind === 'cut-and-finish') return `${label} to ${LANDMARKS[command.target].name}`
  if ('target' in command) return `${label}: ${athleteById(match, command.target).name}`
  return label
}

function defendersNear(match: Match, athlete: Athlete, radius: number): Athlete[] {
  return match.athletes.filter(candidate =>
    candidate.team !== athlete.team && distance(candidate.position, athlete.position) <= radius)
}

export function shotEstimate(match: Match, athlete: Athlete, screened: ReadonlySet<string> = new Set()) {
  const range = distance(athlete.position, COURT.hoop)
  const points = range >= COURT.arc ? 3 : 2
  const defenders = defendersNear(match, athlete, 7)
  const pressure = defenders.reduce((total, defender) => {
    if (screened.has(defender.id)) return total
    return total + (distance(defender.position, athlete.position) <= 3.5 ? 17 : 8) + (defender.defense ?? 0)
      + (defender.technique === 'read-play' ? 4 : 0) + contactBonus(defender) * 2
  }, 0)
  const fatigue = fatiguePenalty(athlete, 65, 0.35)
  const cleanLook = athlete.technique === 'clean-look' && pressure === 0 ? 8 : 0
  const chance = clamp(87 - range * 1.55 + (athlete.shooting - 6) * 4 - pressure - fatigue + cleanLook, 7, 94)
  return { points, chance: Math.round(chance), pressure, range }
}

function moveAthlete(athlete: Athlete, target: Point, reach: number, athletes: readonly Athlete[]) {
  const bounded = {
    x: clamp(target.x, 2, COURT.width - 2),
    y: clamp(target.y, 2, COURT.length - 2),
  }
  const end = stepToward(athlete.position, bounded, reach)
  const travel = distance(athlete.position, end)
  const steps = Math.ceil(travel)
  const start = athlete.position
  for (let step = 1; step <= steps; step += 1) {
    const point = stepToward(start, end, (step / steps) * travel)
    if (athletes.some(other => other.id !== athlete.id && distance(other.position, point) < 2.1)) break
    athlete.position = point
  }
  return distance(start, athlete.position)
}

function reach(athlete: Athlete, ordered = false): number {
  return (5 + athlete.speed * 0.65) * (0.65 + athlete.stamina * 0.0035) * movementMultiplier(athlete, ordered)
}

function matchedAthlete(match: Match, defender: Athlete): Athlete {
  return athleteById(match, `${otherTeam(defender.team)}-${defender.id.split('-')[1]}`)
}

function driveTarget(match: Match, athlete: Athlete): Point {
  const start = athlete.position
  const towardHoop = stepToward(COURT.hoop, start, 3)
  const sidestep = stepToward(start, towardHoop, 9)
  const candidates = [
    towardHoop,
    { x: clamp(sidestep.x + 8, 2, COURT.width - 2), y: sidestep.y },
    { x: clamp(sidestep.x - 8, 2, COURT.width - 2), y: sidestep.y },
  ]
  return candidates.map(point => {
    const end = stepToward(start, point, reach(athlete, true))
    const obstruction = match.athletes.some(other => other.id !== athlete.id
      && distanceToSegment(other.position, start, end) < 2.3)
    const progress = distance(start, COURT.hoop) - distance(end, COURT.hoop)
    return { point, value: progress - (obstruction ? 15 : 0) }
  }).sort((a, b) => b.value - a.value)[0].point
}

function assignment(match: Match, athlete: Athlete, command: Command | undefined): Point {
  const holder = athleteById(match, match.holder)
  switch (command?.kind) {
    case 'drive':
    case 'finish':
    case 'kickout': return driveTarget(match, athlete)
    case 'stay': return stepToward(matchedAthlete(match, athlete).position, COURT.hoop, 2.3)
    case 'switch': return stepToward(matchedAthlete(match, athlete).position, COURT.hoop, 4)
    case 'help': return stepToward(COURT.hoop, holder.position, 10)
    case 'cut':
    case 'cut-and-finish': return LANDMARKS[command.target]
    case 'protect': return { x: 25, y: 11 }
    case 'mark': return stepToward(athleteById(match, command.target).position, COURT.hoop, 2.4)
    case 'deny': return stepToward(athleteById(match, command.target).position, holder.position, 4)
    case 'pass':
    case 'relay':
    case 'shoot':
    case 'catch-shoot':
    case 'screen':
    case 'roll-screen': return athlete.position
  }

  if (athlete.team !== holder.team) {
    return stepToward(matchedAthlete(match, athlete).position, COURT.hoop, 4)
  }
  if (athlete.id === holder.id || distance(athlete.position, holder.position) >= 8) {
    return athlete.position
  }
  return athlete.home
}

export function rollTarget(player: Athlete): Point {
  return { x: COURT.hoop.x + (player.position.x < COURT.hoop.x ? -3.5 : 3.5), y: 9 }
}

function drives(command: Command | undefined): boolean {
  return command?.kind === 'drive' || command?.kind === 'finish' || command?.kind === 'kickout'
}

export function baseAssignment(match: Match, id: string) {
  const player = athleteById(match, id)
  const holder = athleteById(match, match.holder)
  if (player.id === holder.id) return { label: 'Hold the ball' }
  const destination = assignment(match, player, undefined)
  const projected = { ...player }
  moveAthlete(projected, destination, reach(player) * 0.65, match.athletes)
  return {
    label: player.team === holder.team ? 'Keep floor spacing' : `Mark ${matchedAthlete(match, player).name}`,
    target: projected.position,
  }
}

export function resolveTurn(match: Match, plans: Plans<Command>) {
  if (match.rulesVersion !== RULES_VERSION) throw new Error('Unsupported rules version.')
  if (finished(match)) throw new Error('This match is over.')
  validatePlans(match, plans, COMMAND_LIMIT, legalCommands)

  const next = structuredClone(match)
  const random = seededRandom(match.randomState)
  const events = revealPlans(match, plans, commandLabel)
  const emit = (kind: EventKind, text: string, cue?: PlayCue) => events.push({ kind, text, cue })
  const offense = possessionTeam(match)
  const defense = otherTeam(offense)
  const holder = athleteById(next, match.holder)
  const commands = new Map(plans.flat().map(command => [command.athlete, command]))
  const screened = new Set<string>()
  const rolls = new Map<string, Point>()

  const ordered = [...next.athletes].sort((a, b) =>
    reach(b) - reach(a) || Number(b.team === (match.turn % 2)) - Number(a.team === (match.turn % 2))
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

  for (const screener of ordered) {
    const action = commands.get(screener.id)?.kind
    if (action !== 'screen' && action !== 'roll-screen') continue
    const defender = defendersNear(next, holder, 8)
      .sort((a, b) => distance(a.position, holder.position) - distance(b.position, holder.position))
      .find(athlete => !screened.has(athlete.id))
    if (!defender) {
      emit('movement', `${screener.name} has no nearby defender to screen.`)
      continue
    }
    const target = stepToward(defender.position, screener.position, 2.3)
    const from = screener.position
    if (moveAthlete(screener, target, reach(screener, true) * 0.8, next.athletes) > 0) {
      emit('movement', `${screener.name} moves to set a screen.`, {
        type: 'move', moves: [{ athlete: screener.id, from, to: screener.position }],
      })
    }
    if (distance(screener.position, defender.position) <= 4) {
      screened.add(defender.id)
      if (action === 'roll-screen') rolls.set(screener.id, rollTarget(screener))
      emit('movement', `${screener.name} screens ${defender.name}, holding the defender in place and taking away their contest.`,
        { type: 'contact', athlete: screener.id, opponent: defender.id })
    } else {
      emit('movement', `${screener.name} cannot get into screening position.`)
    }
  }

  // A switch trades assignments with the first screened defender. The screen still consumes their action.
  const switches = new Map<string, Point>()
  const switcher = ordered.find(athlete => commands.get(athlete.id)?.kind === 'switch' && !screened.has(athlete.id))
  const screenedDefender = ordered.find(athlete => screened.has(athlete.id))
  if (switcher && screenedDefender) {
    const matchup = matchedAthlete(next, switcher)
    switches.set(switcher.id, stepToward(holder.position, COURT.hoop, 2.7))
    switches.set(screenedDefender.id, stepToward(rolls.get(matchup.id) ?? matchup.position, COURT.hoop, 2.5))
    screened.delete(screenedDefender.id)
    emit('movement', `${switcher.name} switches onto ${holder.name}. ${screenedDefender.name} picks up ${matchup.name}.`)
  }

  // Freeze movement intentions after screens. Movement priority decides only path conflicts.
  const ballCommand = commands.get(holder.id)
  const driving = drives(ballCommand)
  const destinations = new Map(ordered.map(athlete => {
    const chosen = commands.get(athlete.id)
    const order = chosen?.kind === 'help' && !driving ? { ...chosen, kind: 'stay' as const } : chosen
    return [athlete.id, switches.get(athlete.id) ?? rolls.get(athlete.id) ?? assignment(next, athlete, order)]
  }))
  const movementStart = events.length
  const moves: ResolvedMove[] = []
  for (const athlete of ordered) {
    const command = commands.get(athlete.id)
    const adjustment = screened.has(athlete.id) ? 0 : switches.has(athlete.id) ? 0.7 : command ? 1 : 0.65
    const from = athlete.position
    const traveled = moveAthlete(athlete, destinations.get(athlete.id)!, reach(athlete, Boolean(command)) * adjustment, next.athletes)
    if (traveled > 0) moves.push({ athlete: athlete.id, from, to: athlete.position })
    if (rolls.has(athlete.id)) {
      emit('movement', traveled >= 2
        ? `${athlete.name} rolls toward the rim.` : `${athlete.name} cannot roll through the traffic.`)
    }
    const cuts = command?.kind === 'cut' || command?.kind === 'cut-and-finish'
    if (cuts || drives(command)) {
      emit('movement', traveled >= 2
        ? `${athlete.name} ${cuts ? 'cuts' : 'drives'} ${Math.round(traveled)} ft.`
        : `${athlete.name}'s path is crowded.`)
    }
    if (command?.kind === 'help' && driving && traveled >= 2) {
      emit('movement', `${athlete.name} leaves ${matchedAthlete(next, athlete).name} to help in the paint.`)
    }
  }

  if (moves.length) events.splice(movementStart, 0, {
    kind: 'movement', text: 'Athletes run their orders and base assignments.', cue: { type: 'move', moves },
  })

  function changePossession(reason: string) {
    const before = next.athletes.map(athlete => athlete.position)
    setupPossession(next, defense)
    const moves = next.athletes.map(({ id, position }, index) => ({ athlete: id, from: before[index], to: position }))
    emit('possession', `${reason} ${teamNames(next)[defense]} set up on offense.`, {
      type: 'reset', moves, holder: next.holder,
    })
  }

  let reacted: string | undefined
  function passBall(passer: Athlete, target: string, kickout: boolean, allowRelay = true) {
    const receiver = athleteById(next, target)
    const reaction = reacted === undefined ? laneReaction(next.athletes.filter(athlete => athlete.team === defense
      && !commands.has(athlete.id) && !screened.has(athlete.id)), passer.position, receiver.position, reach) : undefined
    if (reaction) {
      const { athlete, point } = reaction
      const from = athlete.position
      if (moveAthlete(athlete, point, reach(athlete), next.athletes) > 0) {
        reacted = athlete.id
        emit('movement', `${athlete.name} jumps the passing lane.`,
          { type: 'move', moves: [{ athlete: athlete.id, from, to: athlete.position }] })
      }
    }
    const lane = next.athletes.filter(athlete => athlete.team === defense && !screened.has(athlete.id)
      && distanceToSegment(athlete.position, passer.position, receiver.position) <= 3)
    const range = distance(passer.position, receiver.position)
    const chance = clamp(100 - range * 0.65 + (passer.passing - 6) * 3
      - lane.reduce((cost, defender) => cost + 17 + (defender.defense ?? 0) + (defender.technique === 'read-play' ? 4 : 0), 0)
      + ((passer.awareness ?? 6) - 6) * 1.5
      + (lane.length > 0 && passer.technique === 'thread-pass' ? 12 : 0) - fatiguePenalty(passer, 60, 0.3), 15, 98)
    const passDetail = `${Math.round(chance)}% completion, ${lane.length} ${lane.length === 1 ? 'defender' : 'defenders'} in the lane`
    if (random.next() * 100 < chance) {
      next.holder = receiver.id
      const pressure = shotEstimate(next, receiver, screened).pressure
      const read = kickout ? (pressure > 0 ? ' with the shooter covered' : ' for an open look') : ''
      emit('ball', `${passer.name} ${kickout ? 'kicks out to' : 'finds'} ${receiver.name}${read} (${passDetail}).`,
        { type: 'ball', action: 'pass', from: passer.position, to: receiver.position, holder: receiver.id })
      const nextOrder = commands.get(receiver.id)
      if (allowRelay && nextOrder?.kind === 'relay') {
        emit('ball', `${receiver.name} relays the ball to ${athleteById(next, nextOrder.target).name}.`)
        passBall(receiver, nextOrder.target, false, false)
        return
      }
      const order = nextOrder?.kind
      if (rolls.has(receiver.id) && distance(receiver.position, COURT.hoop) <= 15) {
        emit('ball', `${receiver.name} catches on the roll and shoots.`)
        takeShot(receiver)
      } else if (order === 'cut-and-finish' && distance(receiver.position, COURT.hoop) > 34) {
        emit('ball', `${receiver.name} catches outside shooting range and holds the ball.`)
      } else if (order === 'catch-shoot' || order === 'cut-and-finish') {
        emit('ball', order === 'cut-and-finish'
          ? `${receiver.name} cuts, catches and shoots.` : `${receiver.name} catches and shoots.`)
        takeShot(receiver)
      }
    } else {
      const interceptor = lane[0]
      const message = interceptor
        ? `${interceptor.name} intercepts the pass (${passDetail}).`
        : `${passer.name}'s pass gets away (${passDetail}).`
      emit('turnover', message, {
        type: 'ball', action: interceptor ? 'interception' : 'pass', from: passer.position,
        to: interceptor?.position ?? receiver.position, holder: interceptor?.id,
      })
      changePossession('After the turnover,')
    }
  }

  function takeShot(shooter: Athlete) {
    const shot = shotEstimate(next, shooter, screened)
    const detail = `${shot.chance}% chance, ${Math.round(shot.range)} ft, ${shot.pressure ? 'contested' : 'open'}`
    const flight: PlayCue = { type: 'ball', action: 'shot', from: shooter.position, to: COURT.hoop }
    if (random.next() * 100 < shot.chance) {
      next.score[offense] += shot.points
      emit('score', `${shooter.name} scores ${shot.points} (${detail}).`, flight)
      changePossession('After the basket,')
      return
    }
    emit('ball', `${shooter.name} misses a ${shot.points}-point attempt (${detail}).`, flight)
    const position = stepToward(COURT.hoop, shooter.position, 2 + random.next() * 6)
    const distances = next.athletes.map(athlete => distance(athlete.position, position))
    const nearest = Math.min(...distances)
    const candidates = next.athletes
      .map((athlete, index) => ({ athlete, distance: distances[index] }))
      .filter(candidate => candidate.distance <= nearest + 9)
      .map(({ athlete, distance: range }) => ({ athlete, weight: (nearest + 10 - range)
        * (0.65 + athlete.stamina * 0.0035) * (0.6 + (athlete.strength + contactBonus(athlete)) * 0.06) }))
    let selection = random.next() * candidates.reduce((sum, candidate) => sum + candidate.weight, 0)
    for (const { athlete, weight } of candidates) {
      selection -= weight
      if (selection >= 0) continue
      const offensive = athlete.team === offense
      events.push({
        kind: 'rebound', offensive,
        cue: { type: 'ball', action: 'rebound', from: COURT.hoop, to: athlete.position, holder: athlete.id },
        text: `${athlete.name} takes the ${offensive ? 'offensive' : 'defensive'} rebound.`,
      })
      if (offensive) next.holder = athlete.id
      else changePossession('Possession changes.')
      break
    }
  }

  const pressure = driving ? defendersNear(next, holder, 4).filter(athlete => !screened.has(athlete.id)) : []
  const strength = pressure.reduce((total, defender) => total + contactBonus(defender), 0) - contactBonus(holder)
  const stripChance = clamp(8 + pressure.length * 10 + fatiguePenalty(holder, 100, 0.15) + strength * 2, 8, 55)
  const stopped = pressure.length > 0 && random.next() * 100 < stripChance
  if (stopped) {
    const defender = pressure[0]
    emit('turnover', `${defender.name} strips ${holder.name} on the drive (${Math.round(stripChance)}% turnover risk).`,
      { type: 'ball', action: 'strip', from: holder.position, to: defender.position, holder: defender.id })
    changePossession('After the strip,')
  } else {
    if (pressure.length > 0) emit('ball', `${holder.name} keeps control under pressure (${Math.round(stripChance)}% turnover risk).`)
    if (ballCommand?.kind === 'pass' || ballCommand?.kind === 'kickout') {
      passBall(holder, ballCommand.target, ballCommand.kind === 'kickout')
    } else if (ballCommand?.kind === 'shoot' || (ballCommand?.kind === 'finish' && distance(holder.position, COURT.hoop) <= 17)) {
      takeShot(holder)
    } else if (ballCommand?.kind === 'finish') {
      emit('ball', `${holder.name} cannot reach finishing range and keeps possession.`)
    } else if (!driving) {
      emit('ball', `${holder.name} keeps the ball while teammates reposition.`)
    }
  }

  for (const athlete of next.athletes) {
    const command = commands.get(athlete.id)
    const recovery = (athlete.technique === 'second-wind' ? 10 : 6) + recoveryBonus(athlete)
    athlete.stamina = clamp(athlete.stamina + (command ? -ACTIONS[command.kind].stamina : athlete.id === reacted ? -LANE_REACTION_COST : recovery), 0, 100)
  }
  next.randomState = random.state
  next.turn += 1
  if (finished(next)) {
    emit('finish', finalScore(next))
  }
  return { match: next, events }
}
