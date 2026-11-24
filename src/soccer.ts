import { clamp, distance, distanceToSegment, seededRandom, stepToward, type Point } from './math.ts'
import {
  COMMAND_LIMIT, finalScore, findAthlete, otherTeam, revealPlans, teamNames, validatePlans,
  type AthleteSnapshot, type EventKind, type MatchSnapshot, type Plans, type Team, type TurnEvent,
} from './match.ts'

export const PITCH = { width: 105, length: 68 }
export const HALF_TURNS = 9
export const TURN_LIMIT = HALF_TURNS * 2
export const RULES_VERSION = 2
const MIDFIELD = { x: PITCH.width / 2, y: PITCH.length / 2 }
const SHOT_RANGE = 32

const FORMATION = [
  ['GK', 6, 34], ['LB', 25, 10], ['CB', 22, 25], ['CB', 22, 43], ['RB', 25, 58],
  ['DM', 38, 34], ['CM', 48, 24], ['AM', 55, 44], ['LW', 63, 9], ['ST', 65, 34], ['RW', 63, 59],
] as const
const NAMES = [
  ['Shaw', 'Mora', 'Blake', 'Okafor', 'Diaz', 'Chen', 'Reed', 'Santos', 'Vale', 'Adeyemi', 'Ito'],
  ['Hart', 'Silva', 'Wells', 'Grant', 'Fraser', 'Khan', 'Quinn', 'Bell', 'Park', 'Duarte', 'Bauer'],
] as const
const LANES = ['left channel', 'middle', 'right channel'] as const

interface Footballer extends AthleteSnapshot {
  slot: number
  pace: number
  passing: number
  finishing: number
  keeping: number
}

export type Budget = 3 | 4
export type DefenseShape = 'balanced' | 'press' | 'compact'
export const SHAPE_NAMES: Record<DefenseShape, string> = { balanced: 'Balanced', press: 'High press', compact: 'Compact defense' }
export interface Match extends MatchSnapshot {
  rulesVersion: number
  athletes: Footballer[]
  openingTeam: Team
  commandLimit: Budget
  shapes: [DefenseShape, DefenseShape]
  randomState: number
}

export type Command =
  | { athlete: string; kind: 'carry' | 'shoot' | 'press' | 'hold' }
  | { athlete: string; kind: 'pass'; target: string }
  | { athlete: string; kind: 'through'; target: string }
  | { athlete: string; kind: 'cross'; target: string }
  | { athlete: string; kind: 'run'; target: number }

export const ACTIONS = {
  carry: { label: 'Carry forward', stamina: 12 },
  shoot: { label: 'Shoot', stamina: 10 },
  pass: { label: 'Pass', stamina: 5 },
  through: { label: 'Through ball', stamina: 9 },
  cross: { label: 'Cross', stamina: 9 },
  run: { label: 'Run', stamina: 9 },
  press: { label: 'Press ball carrier', stamina: 9 },
  hold: { label: 'Hold defensive line', stamina: 5 },
} satisfies Record<Command['kind'], { label: string; stamina: number }>

export function direction(match: Match, team: Team): 1 | -1 {
  return team === Number(match.turn > HALF_TURNS) ? 1 : -1
}

function oriented(match: Match, team: Team, point: Point): Point {
  return direction(match, team) === 1 ? point : { x: PITCH.width - point.x, y: PITCH.length - point.y }
}

export function attackGoal(match: Match, team: Team): Point {
  return oriented(match, team, { x: PITCH.width, y: MIDFIELD.y })
}

function depth(match: Match, team: Team, point: Point): number {
  return oriented(match, team, point).x
}

export function athleteById(match: Match, id: string): Footballer {
  return findAthlete(match.athletes, id)
}

function formationPoint(match: Match, player: Footballer): Point {
  const [, x, y] = FORMATION[player.slot]
  return oriented(match, player.team, { x, y })
}

function kickoff(match: Match, team: Team) {
  for (const player of match.athletes) {
    const [, x, y] = FORMATION[player.slot]
    player.position = oriented(match, player.team, { x: Math.min(x, 49), y })
    if (player.team !== team && distance(player.position, MIDFIELD) < 10) {
      player.position.x -= direction(match, player.team) * 8
    }
  }
  const kicker = athleteById(match, `${team}-6`)
  kicker.position = { ...MIDFIELD }
  match.holder = kicker.id
}

export function createMatch(seed: number, openingTeam: Team = 0, commandLimit: Budget = COMMAND_LIMIT, opponent: DefenseShape = 'balanced'): Match {
  if (commandLimit !== 3 && commandLimit !== 4) throw new Error('Soccer supports three or four commands.')
  const athletes = NAMES.flatMap((names, side) => names.map((name, slot) => ({
    id: `${side}-${slot}`, team: side as Team, slot, name,
    number: String(slot + 1).padStart(2, '0'), role: FORMATION[slot][0], stamina: 100,
    pace: slot >= 8 ? 9 : slot >= 5 ? 8 : 6,
    passing: slot >= 5 && slot <= 7 ? 9 : 7,
    finishing: slot === 9 ? 9 : slot >= 7 ? 7 : 4,
    keeping: slot === 0 ? 8 : 0,
    position: { x: 0, y: 0 },
  })))
  const match: Match = {
    rulesVersion: RULES_VERSION, turn: 1, seed: seed >>> 0, randomState: seed >>> 0,
    score: [0, 0], holder: '', athletes, openingTeam, commandLimit, shapes: ['balanced', opponent],
  }
  kickoff(match, openingTeam)
  return match
}

export function createCrossingPractice(commandLimit: Budget = COMMAND_LIMIT): Match {
  const match = createMatch(2, 0, commandLimit, 'compact')
  match.holder = '0-8'
  athleteById(match, '0-8').position = { x: 78, y: 9 }
  athleteById(match, '0-9').position = { x: 81, y: 34 }
  athleteById(match, '1-2').position = { x: 90, y: 22 }
  athleteById(match, '1-3').position = { x: 89, y: 46 }
  return match
}

export function createPressPractice(commandLimit: Budget = COMMAND_LIMIT): Match {
  const match = createMatch(12, 0, commandLimit, 'press')
  athleteById(match, '0-6').position = { x: 59, y: 34 }
  athleteById(match, '0-9').position = { x: 67, y: 34 }
  athleteById(match, '1-2').position = { x: 82, y: 25 }
  athleteById(match, '1-3').position = { x: 82, y: 43 }
  athleteById(match, '1-6').position = { x: 64, y: 27 }
  return match
}

export function finished(match: Match): boolean {
  return match.turn > TURN_LIMIT
}

function opponents(match: Match, player: Footballer): Footballer[] {
  return match.athletes.filter(candidate => candidate.team !== player.team)
}

function nearBall(match: Match, holder: Footballer, radius: number): Footballer[] {
  return opponents(match, holder).filter(player => distance(player.position, holder.position) <= radius)
    .sort((a, b) => distance(a.position, holder.position) - distance(b.position, holder.position))
}

function runTarget(match: Match, player: Footballer, lane: number): Point {
  const x = depth(match, player.team, player.position)
  return oriented(match, player.team, { x: Math.min(99, x + 16), y: [8, 34, 60][lane] })
}

export function legalCommands(match: Match, id: string): Command[] {
  if (finished(match)) return []
  const player = athleteById(match, id)
  const holder = athleteById(match, match.holder)
  const commands: Command[] = []
  if (player.id === holder.id) {
    const goal = attackGoal(match, player.team)
    if (player.slot !== 0) {
      if (depth(match, player.team, player.position) < 100) commands.push({ athlete: id, kind: 'carry' })
      if (distance(player.position, goal) <= SHOT_RANGE) commands.push({ athlete: id, kind: 'shoot' })
    }
    const wing = Math.abs(player.position.y - MIDFIELD.y) >= 18 && depth(match, player.team, player.position) >= 68
    for (const target of match.athletes) {
      if (target.team !== player.team || target.id === id) continue
      const gap = distance(player.position, target.position)
      const advance = direction(match, player.team) * (target.position.x - player.position.x)
      if (gap <= 37) commands.push({ athlete: id, kind: 'pass', target: target.id })
      if (player.slot !== 0 && target.slot >= 5 && gap <= 36 && advance >= -4 && advance <= 18) {
        commands.push({ athlete: id, kind: 'through', target: target.id })
      }
      if (wing && target.slot >= 7 && gap <= 48 && Math.abs(target.position.y - MIDFIELD.y) <= 19
        && depth(match, player.team, target.position) >= 67) {
        commands.push({ athlete: id, kind: 'cross', target: target.id })
      }
    }
  } else if (player.slot !== 0 && player.team === holder.team) {
    LANES.forEach((_, lane) => {
      if (distance(player.position, runTarget(match, player, lane)) >= 5) {
        commands.push({ athlete: id, kind: 'run', target: lane })
      }
    })
  } else if (player.slot !== 0) {
    if (distance(player.position, holder.position) <= 30) commands.push({ athlete: id, kind: 'press' })
    commands.push({ athlete: id, kind: 'hold' })
  }
  return commands.filter(command => ACTIONS[command.kind].stamina <= player.stamina)
}

export function commandLabel(match: Match, command: Command): string {
  const label = ACTIONS[command.kind].label
  if (command.kind === 'run') return `Run into the ${LANES[command.target]}`
  if ('target' in command) return `${label} to ${athleteById(match, command.target).name}`
  return label
}

export function commandTarget(match: Match, command: Command): Point | undefined {
  const player = athleteById(match, command.athlete)
  const holder = athleteById(match, match.holder)
  if (command.kind === 'run') return runTarget(match, player, command.target)
  if (command.kind === 'press') return holder.position
  if (command.kind === 'shoot') return attackGoal(match, player.team)
  if ('target' in command) return athleteById(match, command.target).position
  return undefined
}

function formationAssignment(match: Match, player: Footballer, holder: Footballer, holdLine: boolean): Point {
  const home = formationPoint(match, player)
  const ownGoal = attackGoal(match, otherTeam(player.team))
  if (player.slot === 0) {
    const advance = clamp((PITCH.width - distance(holder.position, ownGoal)) * 0.07, 2.5, 7)
    return {
      x: ownGoal.x + advance * direction(match, player.team),
      y: MIDFIELD.y + clamp((holder.position.y - MIDFIELD.y) * 0.19, -6, 6),
    }
  }
  const dx = clamp((holder.position.x - MIDFIELD.x) * 0.36, -17, 17)
  const dy = clamp((holder.position.y - MIDFIELD.y) * 0.26, -7, 7)
  const shape = player.team === holder.team ? 'balanced' : match.shapes[player.team]
  const shift = shape === 'press' ? 7 : shape === 'compact' ? -9 : 0
  const width = shape === 'compact' ? 0.7 : 1
  return {
    x: home.x + dx + direction(match, player.team) * shift,
    y: MIDFIELD.y + (home.y - MIDFIELD.y) * width + (holdLine ? 0 : dy),
  }
}

function moveRange(player: Footballer): number {
  return (7 + player.pace * 0.65) * (0.65 + player.stamina * 0.0035)
}

export function runDestination(match: Match, player: Footballer, lane: number): Point {
  return stepToward(player.position, runTarget(match, player, lane), moveRange(player))
}

function movement(match: Match, player: Footballer, holder: Footballer, command?: Command): Point {
  const speed = moveRange(player)
  let target: Point
  let travel: number
  switch (command?.kind) {
    case 'carry':
      target = attackGoal(match, player.team)
      travel = speed * 0.83
      break
    case 'run':
      return runDestination(match, player, command.target)
    case 'press':
      target = stepToward(holder.position, player.position, 1)
      travel = speed
      break
    default:
      if (holder.id === player.id) return player.position
      target = formationAssignment(match, player, holder, command?.kind === 'hold')
      travel = command?.kind === 'hold' ? speed * 0.7 : speed * 0.43
  }
  return stepToward(player.position, {
    x: clamp(target.x, 2.5, PITCH.width - 2.5), y: clamp(target.y, 3, PITCH.length - 3),
  }, travel)
}

export function shotEstimate(match: Match, player: Footballer) {
  const goal = attackGoal(match, player.team)
  const range = distance(player.position, goal)
  const pressure = nearBall(match, player, 5).length
  const wide = Math.abs(player.position.y - MIDFIELD.y)
  const keeper = athleteById(match, `${otherTeam(player.team)}-0`)
  const cleanLook = player.technique === 'clean-look' && pressure === 0 ? 8 : 0
  const onTarget = clamp(91 + cleanLook - 1.18 * range - 0.54 * wide + (player.finishing - 6) * 4
    - pressure * 8 - Math.max(0, 65 - player.stamina) * 0.35, 10, 95)
  const save = clamp(31 + range * 0.65 + wide * 0.5 + (keeper.keeping - 6) * 4
    - Math.abs(keeper.position.y - MIDFIELD.y) * 2 + (keeper.technique === 'read-play' ? 5 : 0), 19, 86)
  return { range, pressure, onTarget, save, goal: Math.round(onTarget * (100 - save) / 100) }
}

export function startsOffside(match: Match, from: Footballer, receiver: Footballer): boolean {
  const line = opponents(match, from).map(player => depth(match, from.team, player.position)).sort((a, b) => b - a)[1]
  const catchPosition = depth(match, from.team, receiver.position)
  return catchPosition > Math.max(line, depth(match, from.team, from.position), MIDFIELD.x) + 0.5
}

export function passEstimate(match: Match, from: Footballer, target: Point, kind: 'pass' | 'through' | 'cross') {
  const range = distance(from.position, target)
  const lane = opponents(match, from).filter(player => distanceToSegment(player.position, from.position, target) <= 2.7)
    .sort((a, b) => distanceToSegment(a.position, from.position, target) - distanceToSegment(b.position, from.position, target))
  const defenders = kind === 'cross' ? lane.filter(player => distance(player.position, target) <= 7) : lane
  const base = kind === 'cross' ? 90 : kind === 'through' ? 94 : 105
  const chance = clamp(base - range * 0.55 - defenders.reduce((cost, defender) => cost + 13 + (defender.defense ?? 0) + (defender.technique === 'read-play' ? 3 : 0), 0)
    + (from.passing - 7) * 3 + ((from.awareness ?? 6) - 6) * 1.5
    + (defenders.length > 0 && from.technique === 'thread-pass' ? 12 : 0)
    - Math.max(0, 65 - from.stamina) * 0.35, 14, 98)
  return { chance, defenders, range }
}

type Pass = Extract<Command, { target: string }>

function passArrival(match: Match, from: Footballer, position: Point, kind: Pass['kind']): Point {
  const lead = kind === 'through' ? direction(match, from.team) * 4 : 0
  return { x: clamp(position.x + lead, 2.5, PITCH.width - 2.5), y: position.y }
}

export function previewPass(match: Match, command: Pass, plan: readonly Command[]) {
  const from = athleteById(match, command.athlete)
  const receiver = athleteById(match, command.target)
  const ownOrder = plan.find(order => order.athlete === receiver.id)
  const destination = passArrival(match, from, movement(match, receiver, from, ownOrder), command.kind)
  const projected = {
    ...match,
    athletes: match.athletes.map(player => player.team === from.team
      ? player : { ...player, position: movement(match, player, from) }),
  }
  return { ...passEstimate(projected, from, destination, command.kind), destination,
    offside: startsOffside(match, from, receiver) }
}

function resolvePass(
  match: Match, initial: Match, holder: Footballer, command: Extract<Command, { target: string }>,
  roll: () => number, emit: (kind: EventKind, text: string) => void,
) {
  const target = athleteById(match, command.target)
  if (startsOffside(initial, athleteById(initial, holder.id), athleteById(initial, target.id))) {
    const defender = nearBall(match, target, Infinity)[0]
    match.holder = defender.id
    emit('turnover', `${target.name} started beyond the defensive line. ${defender.name} takes the offside restart.`)
    return
  }
  const reception = passArrival(match, holder, target.position, command.kind)
  const { chance, defenders, range } = passEstimate(match, holder, reception, command.kind)
  const coverage = defenders.length ? `${defenders.map(player => player.name).join(' and ')} in the lane` : 'clear lane'
  const detail = `${Math.round(range)} m, ${coverage}, ${Math.round(chance)}% completion`
  if (roll() < chance) {
    target.position = reception
    match.holder = target.id
    emit('ball', `${holder.name} finds ${target.name} with a ${ACTIONS[command.kind].label.toLowerCase()} (${detail}).`)
    return
  }
  const defender = defenders[0] ?? nearBall(match, target, Infinity)[0]
  match.holder = defender.id
  emit('turnover', defenders.length
    ? `${defender.name} intercepts ${holder.name}'s ${ACTIONS[command.kind].label.toLowerCase()} (${detail}).`
    : `${holder.name}'s pass runs loose. ${defender.name} collects it (${detail}).`)
}

export function resolveTurn(match: Match, plans: Plans<Command>) {
  if (match.rulesVersion !== RULES_VERSION) throw new Error('Unsupported rules version.')
  if (finished(match)) throw new Error('This match is over.')
  validatePlans(match, plans, match.commandLimit, legalCommands)

  const next = structuredClone(match)
  const random = seededRandom(match.randomState)
  const roll = () => random.next() * 100
  const events: TurnEvent[] = revealPlans(match, plans, commandLabel)
  const emit = (kind: EventKind, text: string) => events.push({ kind, text })
  const commands = new Map(plans.flat().map(command => [command.athlete, command]))
  const originalHolder = athleteById(match, match.holder)
  const holder = athleteById(next, match.holder)

  for (const player of next.athletes) {
    const initial = athleteById(match, player.id)
    const command = commands.get(player.id)
    player.position = movement(match, initial, originalHolder, command)
    if (command?.kind === 'carry' || command?.kind === 'run' || command?.kind === 'press') {
      const meters = Math.round(distance(initial.position, player.position))
      emit('movement', `${player.name} ${command.kind === 'carry' ? 'carries' : command.kind === 'press' ? 'closes down' : 'runs'} ${meters} m.`)
    }
  }

  const ballCommand = commands.get(holder.id)
  if (ballCommand?.kind === 'shoot') {
    const shot = shotEstimate(next, holder)
    const defense = otherTeam(holder.team)
    const keeper = athleteById(next, `${defense}-0`)
    const detail = `${Math.round(shot.range)} m, ${shot.pressure} closing, ${shot.goal}% goal chance`
    if (roll() >= shot.onTarget) {
      keeper.position = oriented(next, defense, { x: 5.5, y: MIDFIELD.y })
      next.holder = keeper.id
      emit('restart', `${holder.name} shoots wide (${detail}). Goal kick for ${teamNames(next)[defense]}.`)
    } else if (roll() < shot.save) {
      next.holder = keeper.id
      emit('save', `${keeper.name} saves ${holder.name}'s shot and holds it (${detail}).`)
    } else {
      next.score[holder.team] += 1
      emit('score', `${holder.name} scores for ${teamNames(next)[holder.team]} (${detail}).`)
      kickoff(next, defense)
      emit('restart', `${teamNames(next)[defense]} restart at midfield.`)
    }
  } else if (ballCommand && 'target' in ballCommand && ballCommand.kind !== 'run') {
    resolvePass(next, match, holder, ballCommand, roll, emit)
  } else {
    const challenger = nearBall(next, holder, 3.4).find(player => commands.get(player.id)?.kind === 'press')
    if (challenger) {
      const chance = clamp(32 + (challenger.pace - holder.pace) * 4 + (100 - holder.stamina) * 0.22 + (challenger.defense ?? 0) * 3, 15, 75)
      if (roll() < chance) {
        next.holder = challenger.id
        emit('turnover', `${challenger.name} wins the ball from ${holder.name} (${Math.round(chance)}% tackle chance).`)
      } else {
        emit('ball', `${holder.name} shields the ball from ${challenger.name}.`)
      }
    } else {
      emit('ball', `${holder.name} keeps the ball while both teams adjust their shape.`)
    }
  }

  for (const player of next.athletes) {
    const command = commands.get(player.id)
    player.stamina = clamp(player.stamina + (command ? -ACTIONS[command.kind].stamina : player.technique === 'second-wind' ? 9 : 5), 0, 100)
  }
  next.randomState = random.state
  next.turn += 1
  if (next.turn === HALF_TURNS + 1) {
    const startingTeam = otherTeam(match.openingTeam)
    kickoff(next, startingTeam)
    emit('restart', `Half-time. Teams switch ends. ${teamNames(next)[startingTeam]} start the second half.`)
  }
  if (finished(next)) emit('finish', finalScore(next))
  return { match: next, events }
}
