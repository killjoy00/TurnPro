import { focusAchievement, type FocusAchievement } from './match-focus.ts'
import { contactBonus, fatiguePenalty, movementMultiplier, recoveryBonus } from './athletics.ts'
import { clamp, distance, distanceToSegment, seededRandom, stepToward, type Point } from './math.ts'
import {
  COMMAND_LIMIT, finalScore, findAthlete, otherTeam, revealPlans, teamNames, validatePlans,
  type Appearance, type AthleteBuild, type AthleteSnapshot, type EventKind, type MatchSnapshot, type Plans, type Team, type TurnEvent,
} from './match.ts'

export const RINK = { width: 100, height: 48 }
export const PERIOD_TURNS = 6
export const TURN_LIMIT = PERIOD_TURNS * 3
export const RULES_VERSION = 1
const MID = RINK.height / 2
const LANES = ['Left wing', 'Middle', 'Right wing'] as const
const LINE = [
  ['C', 47, 24], ['LW', 47, 10], ['RW', 47, 38], ['LD', 33, 15], ['RD', 33, 33],
] as const

const NAMES = [
  [
    ['Reed', 'Vale', 'Okafor', 'Blake', 'Diaz'],
    ['Rowan', 'Santos', 'Ito', 'Chen', 'Mora'],
  ],
  [
    ['Quinn', 'Park', 'Grant', 'Silva', 'Wells'],
    ['James', 'Vega', 'Ford', 'Roy', 'Lane'],
  ],
] as const

type Line = 0 | 1

interface Skater extends AthleteSnapshot {
  slot: number
  speed: number
  passing: number
  finishing: number
  keeping?: number
}

export interface Match extends MatchSnapshot {
  rulesVersion: number
  randomState: number
  openingTeam: Team
  athletes: Skater[]
  lines: [Line, Line]
  bench: [[number[], number[]], [number[], number[]]]
  club?: { lineup: readonly AthleteBuild[]; orders: number[]; played: boolean[] }
}

export type Command =
  | { athlete: string; kind: 'carry' | 'shoot' | 'screen' | 'one-timer' | 'forecheck' | 'guard' | 'change' | 'show-outlet' }
  | { athlete: string; kind: 'pass'; target: string }
  | { athlete: string; kind: 'wall-outlet'; target: string }
  | { athlete: string; kind: 'skate'; target: number }
  | { athlete: string; kind: 'walk-point'; target: 0 | 1 }

export const ACTIONS = {
  carry: { label: 'Skate with the puck', stamina: 15 },
  shoot: { label: 'Wrist shot', stamina: 11 },
  'walk-point': { label: 'Walk the point', stamina: 17 },
  screen: { label: 'Screen the goalie', stamina: 10 },
  'one-timer': { label: 'Ready one-timer', stamina: 12 },
  forecheck: { label: 'Forecheck', stamina: 13 },
  guard: { label: 'Guard the slot', stamina: 7 },
  change: { label: 'Call line change', stamina: 0 },
  pass: { label: 'Pass to', stamina: 7 },
  'wall-outlet': { label: 'Bank outlet to', stamina: 10 },
  'show-outlet': { label: 'Show at the boards', stamina: 8 },
  skate: { label: 'Skate to', stamina: 10 },
} satisfies Record<Command['kind'], { label: string; stamina: number }>

export function period(match: Match): number {
  return Math.min(3, Math.floor((match.turn - 1) / PERIOD_TURNS) + 1)
}

export function direction(match: Match, team: Team): 1 | -1 {
  return team === (period(match) - 1) % 2 ? 1 : -1
}

function orient(match: Match, team: Team, { x, y }: Point): Point {
  return direction(match, team) === 1 ? { x, y } : { x: RINK.width - x, y: RINK.height - y }
}

function attackGoal(match: Match, team: Team): Point {
  return orient(match, team, { x: 95, y: MID })
}

function depth(match: Match, team: Team, point: Point): number {
  return orient(match, team, point).x
}

export function athleteById(match: Match, id: string): Skater {
  return findAthlete(match.athletes, id)
}

function bySlot(match: Match, team: Team, slot: number): Skater {
  return athleteById(match, `${team}-${slot}`)
}

function makeSkater(match: Match, team: Team, slot: number, position: Point): Skater {
  const line = match.lines[team]
  return {
    id: `${team}-${slot}`, team, slot, position, role: LINE[slot][0],
    name: NAMES[team][line][slot], number: String(10 + line * 20 + slot),
    speed: slot < 3 ? 9 - line : 7 + line,
    passing: slot === 0 ? 9 - line : 7, finishing: slot < 3 ? 8 - line : 6,
    ...(team === 0 ? match.club?.lineup[line * 5 + slot] : undefined),
    stamina: match.bench[team][line][slot],
  }
}

function faceoff(match: Match, team: Team) {
  for (const athlete of match.athletes) {
    const position = athlete.slot === 5 ? { x: 7, y: MID }
      : { x: LINE[athlete.slot][1], y: LINE[athlete.slot][2] }
    athlete.position = orient(match, athlete.team, position)
  }
  const centre = bySlot(match, team, 0)
  centre.position = { x: RINK.width / 2, y: MID }
  match.holder = centre.id
}

export function createMatch(seed: number, openingTeam: Team = 0, lineup?: readonly AthleteBuild[]): Match {
  const line = () => Array<number>(5).fill(100)
  const match: Match = {
    rulesVersion: RULES_VERSION, seed: seed >>> 0, randomState: seed >>> 0, openingTeam,
    turn: 1, holder: '', score: [0, 0], teams: ['Comets', 'Frost'],
    lines: [0, 0], bench: [[line(), line()], [line(), line()]], athletes: [],
  }
  if (lineup) {
    match.club = { lineup, orders: Array<number>(11).fill(0), played: Array<boolean>(11).fill(false) }
    match.bench[0] = [lineup.slice(0, 5).map(player => player.stamina), lineup.slice(5, 10).map(player => player.stamina)]
  }
  for (const team of [0, 1] as const) {
    for (let slot = 0; slot < 5; slot++) match.athletes.push(makeSkater(match, team, slot, { x: 0, y: 0 }))
    match.athletes.push({
      id: `${team}-5`, team, slot: 5, role: 'GK', name: team === 0 ? 'Shaw' : 'Hart',
      number: '01', position: { x: 0, y: MID }, stamina: 100, speed: 5, passing: 6, finishing: 0,
      ...(team === 0 ? lineup?.[10] : undefined),
    })
  }
  faceoff(match, openingTeam)
  return match
}

export function clubAppearances(match: Match): Appearance[] {
  const club = match.club
  if (!club) return []
  return club.played.flatMap((played, index) => {
    if (!played) return []
    const slot = index === 10 ? 5 : index % 5
    const line = index < 5 ? 0 : 1
    const stamina = slot === 5 || line === match.lines[0] ? bySlot(match, 0, slot).stamina : match.bench[0][line][slot]
    return [{ slot: index, stamina, orders: club.orders[index] }]
  })
}

export function createRushPractice(): Match {
  const match = createMatch(2)
  bySlot(match, 0, 0).position = { x: 75, y: 16 }
  bySlot(match, 0, 1).position = { x: 82, y: 12 }
  bySlot(match, 0, 2).position = { x: 84, y: 25 }
  bySlot(match, 1, 3).position = { x: 83, y: 22 }
  bySlot(match, 1, 4).position = { x: 80, y: 32 }
  return match
}

export function createBreakoutPractice(): Match {
  const match = createMatch(0)
  match.holder = '0-3'
  bySlot(match, 0, 3).position = { x: 22, y: 12 }
  bySlot(match, 0, 1).position = { x: 39, y: 12 }
  bySlot(match, 1, 0).position = { x: 28, y: 11 }
  bySlot(match, 1, 2).position = { x: 33, y: 15 }
  return match
}

export function finished(match: Match): boolean {
  return match.turn > TURN_LIMIT
}

function opponents(match: Match, team: Team): Skater[] {
  return match.athletes.filter(player => player.team !== team)
}

function nearby(match: Match, player: Skater, radius: number): Skater[] {
  return opponents(match, player.team).filter(other => distance(player.position, other.position) <= radius)
    .sort((a, b) => distance(a.position, player.position) - distance(b.position, player.position))
}

export function legalCommands(match: Match, id: string): Command[] {
  if (finished(match)) return []
  const player = athleteById(match, id)
  const holder = athleteById(match, match.holder)
  const options: Command[] = []
  if (holder.id === id) {
    if (player.slot < 5) {
      if (depth(match, player.team, player.position) < 91) options.push({ athlete: id, kind: 'carry' })
      if (distance(player.position, attackGoal(match, player.team)) <= 35) options.push({ athlete: id, kind: 'shoot' })
      const zone = depth(match, player.team, player.position)
      if (player.signature === 'walk-point' && zone >= 60 && zone <= 80) {
        for (const target of [0, 1] as const) {
          const arrival = pointShotPosition(match, player, target)
          if (distance(player.position, arrival) >= 3 && distance(arrival, attackGoal(match, player.team)) <= 35) {
            options.push({ athlete: id, kind: 'walk-point', target })
          }
        }
      }
    }
    for (const teammate of match.athletes) {
      if (teammate.id === id || teammate.team !== player.team || teammate.slot >= 5) continue
      if (distance(teammate.position, player.position) <= 37) options.push({ athlete: id, kind: 'pass', target: teammate.id })
      const side = player.position.y - MID
      const wing = teammate.position.y - MID
      if (depth(match, player.team, player.position) <= 34 && teammate.slot < 3 && Math.abs(wing) >= 9
        && side * wing > 0 && depth(match, player.team, teammate.position) <= 57) {
        options.push({ athlete: id, kind: 'wall-outlet', target: teammate.id })
      }
    }
  } else if (player.slot === 5) {
    options.push({ athlete: id, kind: 'change' })
  } else if (player.team === holder.team) {
    if (player.slot < 3 && depth(match, player.team, holder.position) <= 34
      && distance(player.position, outletTarget(match, player)) >= 4) options.push({ athlete: id, kind: 'show-outlet' })
    for (let lane = 0; lane < LANES.length; lane++) options.push({ athlete: id, kind: 'skate', target: lane })
    if (depth(match, player.team, player.position) >= 64) options.push({ athlete: id, kind: 'screen' })
    if (distance(player.position, attackGoal(match, player.team)) <= 35) options.push({ athlete: id, kind: 'one-timer' })
  } else {
    if (distance(player.position, holder.position) <= 34) options.push({ athlete: id, kind: 'forecheck' })
    options.push({ athlete: id, kind: 'guard' })
  }
  return options.filter(order => ACTIONS[order.kind].stamina <= player.stamina)
}

export function commandLabel(match: Match, order: Command): string {
  if (order.kind === 'pass' || order.kind === 'wall-outlet') return `${ACTIONS[order.kind].label} ${athleteById(match, order.target).name}`
  if (order.kind === 'walk-point') return `Walk the point ${order.target === 0 ? 'left' : 'right'} and shoot`
  if (order.kind === 'skate') return `Skate to ${LANES[order.target].toLowerCase()}`
  if (order.kind === 'change') return `Call line change to line ${2 - match.lines[athleteById(match, order.athlete).team]}`
  return ACTIONS[order.kind].label
}

export function reserveStamina(match: Match, team: Team): number {
  const line = match.bench[team][otherTeam(match.lines[team])]
  return Math.round(line.reduce((sum, stamina) => sum + stamina, 0) / line.length)
}

function outletTarget(match: Match, athlete: Skater): Point {
  const spot = orient(match, athlete.team, athlete.position)
  return orient(match, athlete.team, { x: Math.min(57, spot.x + 8), y: spot.y < MID ? 4 : RINK.height - 4 })
}

function pointShotPosition(match: Match, athlete: Skater, lane: 0 | 1): Point {
  const x = Math.min(81, depth(match, athlete.team, athlete.position) + 4)
  const target = orient(match, athlete.team, { x, y: MID + (lane === 0 ? -12 : 12) })
  return stepToward(athlete.position, target, movementRange(athlete, true))
}

export function commandTarget(match: Match, order: Command): Point | undefined {
  const athlete = athleteById(match, order.athlete)
  const holder = athleteById(match, match.holder)
  switch (order.kind) {
    case 'pass': return athleteById(match, order.target).position
    case 'wall-outlet': return bankPoint(athlete.position, athleteById(match, order.target).position)
    case 'show-outlet': return outletTarget(match, athlete)
    case 'walk-point': return pointShotPosition(match, athlete, order.target)
    case 'skate': return orient(match, athlete.team, { x: Math.min(93, depth(match, athlete.team, athlete.position) + 19),
      y: [7, MID, 41][order.target] })
    case 'forecheck': return stepToward(holder.position, athlete.position, 2)
    case 'guard': return stepToward(attackGoal(match, otherTeam(athlete.team)), holder.position, 11)
    case 'carry': return orient(match, athlete.team, { x: 93, y: (orient(match, athlete.team, athlete.position).y + MID) / 2 })
    case 'screen': return orient(match, athlete.team, { x: 87, y: MID })
    case 'shoot': return attackGoal(match, athlete.team)
    default: return undefined
  }
}

function assignment(match: Match, athlete: Skater, holder: Skater): Point {
  if (athlete.slot === 5) {
    const own = attackGoal(match, otherTeam(athlete.team))
    return { x: own.x + 2 * direction(match, athlete.team), y: MID + clamp((holder.position.y - MID) * 0.2, -4, 4) }
  }
  const [, x, y] = LINE[athlete.slot]
  const base = orient(match, athlete.team, {
    x: x + (athlete.team === holder.team ? 12 : 0), y,
  })
  return { x: clamp(base.x + (holder.position.x - 50) * 0.48, 4, 96), y: base.y }
}

export function shotEstimate(match: Match, player: Skater, screened = false, oneTimer = false) {
  const goal = attackGoal(match, player.team)
  const range = distance(player.position, goal)
  const pressure = nearby(match, player, 5).filter(defender => defender.slot !== 5).length
  const keeper = bySlot(match, otherTeam(player.team), 5)
  const onTarget = clamp(92 - range * 1.4 - pressure * 9 + (player.finishing - 6) * 4
    - fatiguePenalty(player, 70, 0.25) + (pressure === 0 && player.technique === 'clean-look' ? 8 : 0), 15, 94)
  const save = clamp(58 + range * 0.37 - Math.abs(keeper.position.y - MID) - (screened ? 23 : 0)
    - (oneTimer ? 15 : 0) + ((keeper.keeping ?? 8) - 8) * 3 + (keeper.technique === 'read-play' ? 8 : 0), 25, 90)
  return { range, pressure, onTarget, save, goal: Math.round(onTarget * (100 - save) / 100) }
}

function movementRange(player: Skater, ordered = false) {
  return (8 + player.speed) * (0.67 + player.stamina * 0.0033) * movementMultiplier(player, ordered)
}

export function baseAssignment(match: Match, id: string) {
  const player = athleteById(match, id)
  const holder = athleteById(match, match.holder)
  if (player.id === holder.id) return { label: 'Hold the puck' }
  return {
    label: player.slot === 5 ? 'Track the puck in goal' : player.team === holder.team ? 'Support the puck carrier' : 'Keep defensive shape',
    target: stepToward(player.position, assignment(match, player, holder), movementRange(player) * 0.4),
  }
}

function screensGoal(match: Match, shooter: Skater, position: Point) {
  return distance(position, attackGoal(match, shooter.team)) <= 11 && distance(position, shooter.position) > 2
}

export function previewShot(match: Match, command: Command, plan: readonly Command[]) {
  const player = athleteById(match, command.athlete)
  const shooter = command.kind === 'walk-point' ? { ...player, position: pointShotPosition(match, player, command.target) } : player
  const oneTimer = command.kind === 'one-timer'
  const receivingPass = plan.some(order => order.athlete === match.holder && order.kind === 'pass' && order.target === shooter.id)
  const screened = plan.some(order => {
    if (order.kind !== 'screen') return false
    const player = athleteById(match, order.athlete)
    const target = commandTarget(match, order)!
    return player.team === shooter.team && screensGoal(match, shooter, stepToward(player.position, target, movementRange(player, true)))
  })
  return { ...shotEstimate(match, shooter, screened, oneTimer), screened, receivingPass }
}

function bankPoint(from: Point, to: Point): Point {
  return { x: (from.x + to.x) / 2, y: to.y < MID ? 1 : RINK.height - 1 }
}

function passLane(match: Match, player: Skater, receiver: Skater, bank?: Point): Skater[] {
  return opponents(match, player.team).filter(defender => defender.slot < 5
    && (bank ? Math.min(distanceToSegment(defender.position, player.position, bank),
      distanceToSegment(defender.position, bank, receiver.position))
      : distanceToSegment(defender.position, player.position, receiver.position)) <= 2.3)
    .sort((a, b) => distance(a.position, player.position) - distance(b.position, player.position))
}

export function passChance(match: Match, player: Skater, receiver: Skater, banked = false): number {
  const bank = banked ? bankPoint(player.position, receiver.position) : undefined
  const blockers = passLane(match, player, receiver, bank)
  const range = bank ? distance(player.position, bank) + distance(bank, receiver.position)
    : distance(player.position, receiver.position)
  const read = ((player.awareness ?? 7) - 7) * 2 + (blockers.length && player.technique === 'thread-pass' ? 8 : 0)
  return clamp(106 - range * 0.7 - (banked ? 5 : 0)
    - blockers.reduce((cost, defender) => cost + 15 + (defender.defense ?? 0) + (defender.technique === 'read-play' ? 4 : 0), 0)
    + (player.passing - 7) * 2 + read, 22, 98)
}

export function previewOutlet(match: Match, order: Extract<Command, { kind: 'wall-outlet' }>, plan: readonly Command[]): number {
  const player = athleteById(match, order.athlete)
  const receiver = athleteById(match, order.target)
  const support = plan.find(command => command.athlete === receiver.id && command.kind === 'show-outlet')
  const position = support ? stepToward(receiver.position, outletTarget(match, receiver), movementRange(receiver, true))
    : receiver.position
  return passChance(match, player, { ...receiver, position }, true)
}

export function resolveTurn(match: Match, plans: Plans<Command>) {
  if (match.rulesVersion !== RULES_VERSION) throw new Error('Unsupported hockey rules version.')
  if (finished(match)) throw new Error('This match is over.')
  validatePlans(match, plans, COMMAND_LIMIT, legalCommands)
  const next = structuredClone(match)
  const random = seededRandom(match.randomState)
  const roll = () => random.next() * 100
  const events: TurnEvent[] = revealPlans(match, plans, commandLabel)
  const emit = (kind: EventKind, text: string, achievement?: FocusAchievement) =>
    events.push({ kind, text, ...(achievement ? { achievement } : {}) })
  const orders = new Map(plans.flat().map(order => [order.athlete, order]))
  const original = athleteById(match, match.holder)

  for (const player of next.athletes) {
    const before = athleteById(match, player.id)
    const order = orders.get(before.id)
    const target = order && commandTarget(match, order)
    const passing = order?.kind === 'pass' || order?.kind === 'wall-outlet'
    const resting = order?.kind === 'shoot' || passing || order?.kind === 'one-timer' || before.id === original.id
    const pace = movementRange(before, Boolean(order))
    player.position = target && !passing && order?.kind !== 'shoot'
      ? stepToward(before.position, target, pace)
      : resting ? before.position : stepToward(before.position, assignment(match, before, original), pace * 0.4)
    if (order?.kind === 'walk-point') emit('movement', `${player.name} walks the point for a new shooting lane.`)
    if (order?.kind === 'show-outlet') emit('movement', `${player.name} offers an outlet along the boards.`)
    if (order?.kind === 'forecheck' || order?.kind === 'skate' || order?.kind === 'carry') {
      const distanceMoved = Math.round(distance(before.position, player.position) * 0.61)
      emit('movement', `${player.name} ${order.kind === 'forecheck' ? 'closes' : 'skates'} ${distanceMoved} m.`)
    }
  }

  function shoot(shooter: Skater, oneTimer: boolean) {
    const goal = attackGoal(next, shooter.team)
    const screen = next.athletes.find(player => player.team === shooter.team && orders.get(player.id)?.kind === 'screen'
      && screensGoal(next, shooter, player.position))
    const shot = shotEstimate(next, shooter, Boolean(screen), oneTimer)
    const keeper = bySlot(next, otherTeam(shooter.team), 5)
    const detail = `${shot.goal}% goal chance${screen ? ` · ${screen.name} screens ${keeper.name}` : ''}`
    if (roll() < shot.onTarget) {
      if (roll() >= shot.save) {
        next.score[shooter.team] += 1
        emit('score', `${shooter.name} scores${oneTimer ? ' on the one-timer' : ''} (${detail}).`,
          oneTimer && screen ? focusAchievement('screened-goal', shooter) : undefined)
        faceoff(next, keeper.team)
        emit('restart', `Centre-ice faceoff. ${teamNames(next)[keeper.team]} take the puck.`)
        return
      }
      if (roll() < 65) {
        next.holder = keeper.id
        emit('save', `${keeper.name} holds ${shooter.name}’s ${oneTimer ? 'one-timer' : 'shot'} (${detail}).`)
        return
      }
      emit('save', `${keeper.name} stops the shot and leaves a rebound (${detail}).`)
    } else {
      emit('ball', `${shooter.name}’s ${oneTimer ? 'one-timer' : 'shot'} goes wide (${detail}).`)
    }
    const rebound = { x: goal.x - 8 * direction(next, shooter.team), y: MID + (roll() - 50) * 0.29 }
    const first = next.athletes.filter(player => player.slot < 5).sort((a, b) =>
      distance(a.position, rebound) - distance(b.position, rebound))[0]
    next.holder = first.id
    events.push({ kind: 'rebound', offensive: first.team === shooter.team, text: `${first.name} gets to the loose puck first.` })
  }

  const carrier = athleteById(next, original.id)
  const order = orders.get(carrier.id)
  if (order?.kind === 'shoot' || order?.kind === 'walk-point') {
    shoot(carrier, false)
  } else if (order?.kind === 'pass' || order?.kind === 'wall-outlet') {
    const receiver = athleteById(next, order.target)
    const banked = order.kind === 'wall-outlet'
    const chance = passChance(next, carrier, receiver, banked)
    if (roll() < chance) {
      next.holder = receiver.id
      emit('ball', banked
        ? `${carrier.name} banks the puck along the boards to ${receiver.name} (${Math.round(chance)}% completion).`
        : `${carrier.name} finds ${receiver.name} (${Math.round(chance)}% completion).`,
      banked && orders.get(receiver.id)?.kind === 'show-outlet' ? focusAchievement('bank-breakout', carrier) : undefined)
      if (orders.get(receiver.id)?.kind === 'one-timer') shoot(receiver, true)
    } else {
      const bank = banked ? bankPoint(carrier.position, receiver.position) : undefined
      const interceptor = passLane(next, carrier, receiver, bank)[0] ?? nearby(next, receiver, Infinity)[0]
      next.holder = interceptor.id
      emit('turnover', `${interceptor.name} takes the puck from ${carrier.name}’s ${banked ? 'bank outlet' : 'pass'} (${Math.round(chance)}% completion).`)
    }
  } else {
    const pressure = nearby(next, carrier, 4).find(player => orders.get(player.id)?.kind === 'forecheck')
    const contact = pressure ? contactBonus(pressure) - contactBonus(carrier) : 0
    if (pressure && roll() < 37 + fatiguePenalty(carrier, 100, 0.25) + (pressure.defense ?? 0) * 3 + contact * 4) {
      next.holder = pressure.id
      emit('turnover', `${pressure.name} wins the puck on the forecheck.`)
    } else {
      emit('ball', `${carrier.name} ${pressure ? `holds the puck under pressure from ${pressure.name}` : 'keeps the puck'}.`)
    }
  }

  for (const athlete of next.athletes) {
    const order = orders.get(athlete.id)
    const recovery = (athlete.technique === 'second-wind' ? 7 : 4) + recoveryBonus(athlete)
    athlete.stamina = clamp(athlete.stamina + (order ? -ACTIONS[order.kind].stamina : recovery), 0, 100)
    if (next.club && athlete.team === 0) {
      const slot = athlete.slot === 5 ? 10 : next.lines[0] * 5 + athlete.slot
      next.club.played[slot] = true
      if (order) next.club.orders[slot] += 1
    }
  }
  for (const team of [0, 1] as const) {
    const active = next.lines[team]
    const reserve = otherTeam(active)
    next.bench[team][reserve] = next.bench[team][reserve].map(value => Math.min(value + 13, 100))
    if (orders.get(`${team}-5`)?.kind !== 'change') continue
    if (athleteById(next, next.holder).team === team) {
      emit('movement', `${teamNames(next)[team]} keep their line on while they have the puck.`)
      continue
    }
    next.lines[team] = reserve
    next.athletes = next.athletes.map(athlete => {
      if (athlete.team !== team || athlete.slot === 5) return athlete
      next.bench[team][active][athlete.slot] = athlete.stamina
      return makeSkater(next, team, athlete.slot, athlete.position)
    })
    emit('movement', `${teamNames(next)[team]} send out line ${reserve + 1}.`)
  }
  next.turn += 1
  next.randomState = random.state
  if (finished(next)) {
    emit('finish', finalScore(next))
  } else if ((next.turn - 1) % PERIOD_TURNS === 0) {
    const taking = period(next) === 2 ? otherTeam(next.openingTeam) : next.openingTeam
    faceoff(next, taking)
    emit('restart', `Period ${period(next)}. Teams switch ends. ${teamNames(next)[taking]} take the faceoff.`)
  }
  return { match: next, events }
}
