import { clamp, seededRandom, type Point } from './math.ts'
import {
  COMMAND_LIMIT, finalScore, findAthlete, otherTeam, revealPlans, teamNames, validatePlans,
  type Appearance, type AthleteBuild, type AthleteSnapshot, type EventKind, type MatchSnapshot, type Plans, type Team, type TurnEvent,
} from './match.ts'

export const FIELD = { width: 120, height: 54, goal: 10 }
export const QUARTER_SNAPS = 6
export const TURN_LIMIT = QUARTER_SNAPS * 4
export const RULES_VERSION = 1
const RECEIVERS = [7, 8, 9, 10]
const OFFENSE = [
  ['QB', '8', 'Reed', 'Quinn', -5, 27], ['RB', '22', 'Imani', 'Park', -8, 31],
  ['LT', '71', 'Blake', 'Sato', -1, 17], ['LG', '63', 'Diaz', 'Wells', -1, 22],
  ['C', '54', 'Chen', 'James', -1, 27], ['RG', '66', 'Rowan', 'Ford', -1, 32],
  ['RT', '75', 'Mora', 'Roy', -1, 37], ['WR', '11', 'Vale', 'Vega', -1, 8],
  ['WR', '81', 'Okafor', 'Grant', -1, 47], ['WR', '15', 'Ito', 'Silva', -2.5, 12],
  ['TE', '87', 'Adeyemi', 'Lane', -2.5, 41],
] as const
const DEFENSE_LINEUP = [2, 3, 5, 6, 4, 1, 10, 7, 8, 0, 9] as const
const DEFENSE = [
  ['DE', '94', 'Brooks', 'Pike', 3, 16], ['DT', '98', 'Ellis', 'Jensen', 3, 24],
  ['DT', '95', 'Holt', 'Mills', 3, 31], ['DE', '91', 'Patel', 'Solis', 3, 39],
  ['LB', '53', 'Reyes', 'Perry', 8, 18], ['LB', '55', 'Morgan', 'Price', 7, 27],
  ['LB', '59', 'Foster', 'Stone', 8, 37], ['CB', '25', 'Bell', 'Lewis', 6, 7],
  ['CB', '29', 'Ng', 'Reid', 6, 48], ['S', '31', 'Taylor', 'Dunn', 15, 16],
  ['S', '36', 'Parker', 'Marin', 15, 38],
] as const

type Unit = 'o' | 'd'
interface Player extends AthleteSnapshot {
  slot: number
  passing?: number
  finishing?: number
}

export interface Match extends MatchSnapshot {
  rulesVersion: number
  randomState: number
  openingTeam: Team
  offense: Team
  yard: number
  sticks: number
  down: number
  athletes: Player[]
  energy: [{ o: number[]; d: number[] }, { o: number[]; d: number[] }]
  club?: { lineup: readonly AthleteBuild[]; orders: number[] }
}

export type Play =
  | { athlete: string; kind: 'inside' | 'sweep-left' | 'sweep-right' | 'punt' | 'field-goal' }
  | { athlete: string; kind: 'quick-pass' | 'deep-pass'; target: string }
export type Support = {
  athlete: string
  kind: 'slant' | 'go' | 'run-block' | 'protect' | 'blitz' | 'fill' | 'cover-short' | 'cover-deep' | 'rush-kick'
}
export type Command = Play | Support

export const ACTIONS = {
  inside: { label: 'Inside handoff', stamina: 3 },
  'sweep-left': { label: 'Sweep left', stamina: 4 },
  'sweep-right': { label: 'Sweep right', stamina: 4 },
  'quick-pass': { label: 'Quick pass to', stamina: 6 },
  'deep-pass': { label: 'Deep pass to', stamina: 9 },
  punt: { label: 'Punt', stamina: 1 },
  'field-goal': { label: 'Attempt field goal', stamina: 1 },
  slant: { label: 'Cut on a slant', stamina: 8 },
  go: { label: 'Run a go route', stamina: 12 },
  'run-block': { label: 'Lead the run block', stamina: 8 },
  protect: { label: 'Pass protect', stamina: 8 },
  blitz: { label: 'Blitz the quarterback', stamina: 12 },
  fill: { label: 'Fill the run gap', stamina: 8 },
  'cover-short': { label: 'Jump short routes', stamina: 8 },
  'cover-deep': { label: 'Drop deep', stamina: 7 },
  'rush-kick': { label: 'Rush the kick', stamina: 9 },
} satisfies Record<Command['kind'], { label: string; stamina: number }>

export function finished(match: Match): boolean {
  return match.turn > TURN_LIMIT
}

export function quarter(match: Match): number {
  return Math.min(4, 1 + Math.floor((match.turn - 1) / QUARTER_SNAPS))
}

export function direction(match: Match, team: Team): 1 | -1 {
  return team === (quarter(match) <= 2 ? 0 : 1) ? 1 : -1
}

function orient(match: Match, depth: number, lane: number): Point {
  const x = FIELD.goal + depth
  return direction(match, match.offense) === 1 ? { x, y: lane } : { x: FIELD.width - x, y: FIELD.height - lane }
}

export function fieldLines(match: Match) {
  return { scrimmage: orient(match, match.yard, 27).x, firstDown: orient(match, match.sticks, 27).x }
}

export function spotLabel(yard: number): string {
  return yard === 50 ? 'Midfield' : yard < 50 ? `Own ${yard}` : `Opp ${100 - yard}`
}

export function downLabel(match: Match): string {
  return `${['1st', '2nd', '3rd', '4th'][match.down - 1]} & ${match.sticks === 100 ? 'goal' : match.sticks - match.yard}`
}

function align(match: Match) {
  match.athletes = ([0, 1] as const).flatMap(team => {
    const unit = team === match.offense ? 'o' : 'd'
    return (unit === 'o' ? OFFENSE : DEFENSE).map(([role, number, home, away, offset, lane], slot) => ({
      id: `${team}-${unit}-${slot}`, team, number, role, slot, name: team === 0 ? home : away,
      position: orient(match, clamp(match.yard + offset, -8, 108), lane),
      ...(team === 0 ? match.club?.lineup[unit === 'o' ? slot : DEFENSE_LINEUP[slot]] : undefined),
      stamina: team === 0 && match.club ? match.energy[0].o[unit === 'o' ? slot : DEFENSE_LINEUP[slot]]
        : match.energy[team][unit][slot],
    }))
  })
  match.holder = `${match.offense}-o-0`
}

function startDrive(match: Match, team: Team, yard: number) {
  match.offense = team
  match.yard = clamp(yard, 1, 99)
  match.down = 1
  match.sticks = Math.min(100, match.yard + 10)
}

export function createMatch(seed: number, openingTeam: Team = 0, lineup?: readonly AthleteBuild[]): Match {
  const unit = () => Array<number>(11).fill(100)
  const match: Match = {
    rulesVersion: RULES_VERSION, randomState: seed >>> 0, seed: seed >>> 0, turn: 1,
    score: [0, 0], teams: ['Comets', 'Sentinels'], openingTeam, holder: '', athletes: [],
    offense: openingTeam, yard: 25, sticks: 35, down: 1,
    energy: [{ o: unit(), d: unit() }, { o: unit(), d: unit() }],
  }
  if (lineup) {
    match.club = { lineup, orders: Array<number>(11).fill(0) }
    match.energy[0].o = lineup.map(player => player.stamina)
  }
  align(match)
  return match
}

export function clubAppearances(match: Match): Appearance[] {
  return match.club?.orders.map((orders, slot) => ({ slot, stamina: match.energy[0].o[slot], orders })) ?? []
}

export function createThirdDownPractice(): Match {
  const match = createMatch(27)
  match.yard = 62
  match.sticks = 67
  match.down = 3
  align(match)
  return match
}

export function legalCommands(match: Match, id: string): Command[] {
  if (finished(match)) return []
  const player = findAthlete(match.athletes, id)
  let options: Command[]
  if (player.team === match.offense) {
    if (player.slot === 0) {
      options = []
      if (match.down === 4) {
        if (match.yard >= 58) options.push({ athlete: id, kind: 'field-goal' })
        options.push({ athlete: id, kind: 'punt' })
      }
      options.push({ athlete: id, kind: 'inside' }, { athlete: id, kind: 'sweep-left' }, { athlete: id, kind: 'sweep-right' })
      for (const slot of RECEIVERS) {
        const target = `${player.team}-o-${slot}`
        options.push({ athlete: id, kind: 'quick-pass', target }, { athlete: id, kind: 'deep-pass', target })
      }
    } else if (player.slot <= 6) {
      options = [{ athlete: id, kind: 'run-block' }, { athlete: id, kind: 'protect' }]
    } else {
      options = [{ athlete: id, kind: 'slant' }, { athlete: id, kind: 'go' }]
    }
  } else if (player.slot < 7) {
    options = [{ athlete: id, kind: 'blitz' }, { athlete: id, kind: 'fill' }]
    if (match.down === 4) options.push({ athlete: id, kind: 'rush-kick' })
  } else {
    options = [{ athlete: id, kind: 'cover-short' }, { athlete: id, kind: 'cover-deep' }]
  }
  return options.filter(order => ACTIONS[order.kind].stamina <= player.stamina)
}

export function commandLabel(match: Match, order: Command): string {
  return 'target' in order ? `${ACTIONS[order.kind].label} ${findAthlete(match.athletes, order.target).name}`
    : ACTIONS[order.kind].label
}

export function calledPlay(match: Match, plan: readonly Command[]): Play {
  const order = plan.find(command => command.athlete === match.holder)
  // Only the quarterback can call an offensive play. The base call is an inside handoff.
  return order as Play | undefined ?? { athlete: match.holder, kind: 'inside' }
}

function laneFor(kind: Play['kind']): number {
  if (kind === 'sweep-left') return 10
  if (kind === 'sweep-right') return 44
  return 27
}

function routeReach(kind: Play['kind'], route: Command['kind'] | undefined): number {
  if (kind === 'deep-pass') return route === 'go' ? 29 : route === 'slant' ? 19 : 22
  return route === 'slant' ? 11 : route === 'go' ? 6 : 8
}

export function commandTarget(match: Match, order: Command, plan: readonly Command[]): Point | undefined {
  if ('target' in order) {
    const receiver = findAthlete(match.athletes, order.target)
    const route = plan.find(command => command.athlete === receiver.id)?.kind
    const lane = OFFENSE[receiver.slot][5]
    return orient(match, Math.min(104, match.yard + routeReach(order.kind, route)), route === 'slant' ? (lane + 27) / 2 : lane)
  }
  const player = findAthlete(match.athletes, order.athlete)
  switch (order.kind) {
    case 'inside': case 'sweep-left': case 'sweep-right':
      return orient(match, Math.min(103, match.yard + 8), laneFor(order.kind))
    case 'slant': case 'go':
      return orient(match, Math.min(104, match.yard + (order.kind === 'go' ? 29 : 11)),
        order.kind === 'slant' ? (OFFENSE[player.slot][5] + 27) / 2 : OFFENSE[player.slot][5])
    case 'blitz': return findAthlete(match.athletes, match.holder).position
    case 'fill': return orient(match, match.yard + 2, DEFENSE[player.slot][5])
    case 'cover-short': case 'cover-deep':
      return orient(match, Math.min(106, match.yard + (order.kind === 'cover-deep' ? 25 : 8)), DEFENSE[player.slot][5])
    case 'field-goal': return orient(match, 109, 27)
    case 'punt': return orient(match, Math.min(101, match.yard + 43), 27)
    default: return undefined
  }
}

export function playEstimate(match: Match, play: Play, offense: readonly Command[], defense: readonly Command[] = []) {
  const count = (orders: readonly Command[], kind: Command['kind']) => orders.filter(order => order.kind === kind).length
  const rush = count(defense, 'blitz')
  const blocks = count(offense, 'protect')
  if ('target' in play) {
    const receiver = findAthlete(match.athletes, play.target)
    const passer = findAthlete(match.athletes, match.holder)
    const route = offense.find(order => order.athlete === play.target)?.kind
    const deep = play.kind === 'deep-pass'
    const lane = OFFENSE[receiver.slot][5]
    const coverage = defense.filter(order => order.kind === (deep ? 'cover-deep' : 'cover-short')).reduce((sum, order) => {
      const defender = findAthlete(match.athletes, order.athlete)
      const technique = defender.technique === 'read-play' ? 0.4 : 0
      return sum + (Math.abs(DEFENSE[defender.slot][5] - lane) <= 17 ? 1 : 0.5) + (defender.defense ?? 0) * 0.1 + technique
    }, 0)
    const pressure = Math.max(0, rush + (deep ? 1 : 0) - blocks)
    const fit = deep ? route === 'go' : route === 'slant'
    const fatigue = Math.max(0, 70 - Math.min(receiver.stamina, passer.stamina)) * 0.32
    const talent = ((passer.passing ?? 7) - 7) * 2 + ((passer.awareness ?? 7) - 7) * 1.7 + ((receiver.finishing ?? 7) - 7) * 1.5
    const matchup = (coverage > 0 && passer.technique === 'thread-pass' ? 7 : 0)
      + (coverage === 0 && receiver.technique === 'clean-look' ? 7 : 0)
    return {
      chance: Math.round(clamp((deep ? 56 : 74) + (fit ? 13 : 0) - pressure * 9 - coverage * 12 - fatigue + talent + matchup, 20, 94)),
      yards: routeReach(play.kind, route), sack: clamp((deep ? 7 : 3) + pressure * 7 - blocks * 2, 2, 35),
      pick: clamp((deep ? 15 : 7) + coverage * 14 + pressure * 5, 4, 52),
    }
  }
  if (play.kind === 'field-goal') {
    return { chance: Math.round(clamp(96 - ((117 - match.yard) - 30) * 2.15 - count(defense, 'rush-kick') * 9, 16, 96)),
      yards: 0, sack: 0, pick: 0 }
  }
  const runner = findAthlete(match.athletes, `${match.offense}-o-1`)
  const lane = laneFor(play.kind)
  const gap = defense.filter(order => order.kind === 'fill').reduce((sum, order) => {
    const defender = findAthlete(match.athletes, order.athlete)
    return sum + (Math.abs(DEFENSE[defender.slot][5] - lane) <= 10 ? 2.8 + (defender.defense ?? 0) * 0.3
      + (defender.technique === 'read-play' ? 0.8 : 0) : 0.6)
  }, 0)
  const lead = offense.filter(order => order.kind === 'run-block').reduce((sum, order) => {
    const blocker = findAthlete(match.athletes, order.athlete)
    return sum + (Math.abs(OFFENSE[blocker.slot][5] - lane) <= 11 ? 1.8 : 0.9)
  }, 0)
  const fatigue = Math.max(0, 65 - runner.stamina) * 0.085
  const running = ((runner.finishing ?? 7) - 7) * 0.55
  return { chance: 100, yards: Math.round(clamp(4 + running + lead - gap - fatigue + (play.kind === 'inside' ? -rush * 0.8 : rush * 0.55), -5, 12)),
    sack: 0, pick: 0 }
}

export function resolveTurn(match: Match, plans: Plans<Command>) {
  if (match.rulesVersion !== RULES_VERSION) throw new Error('Unsupported football rules version.')
  if (finished(match)) throw new Error('This game is over.')
  validatePlans(match, plans, COMMAND_LIMIT, legalCommands)
  const next = structuredClone(match)
  const attack = match.offense
  const defending = otherTeam(attack)
  const names = teamNames(match)
  const play = calledPlay(match, plans[attack])
  const estimate = playEstimate(match, play, plans[attack], plans[defending])
  const random = seededRandom(match.randomState)
  const roll = () => random.next() * 100
  const events: TurnEvent[] = revealPlans(match, plans, commandLabel)
  const emit = (kind: EventKind, text: string) => events.push({ kind, text })
  if (!plans[attack].some(order => order.athlete === match.holder)) {
    emit('plan', `${names[attack]} snap their base inside handoff.`)
  }
  const quarterback = findAthlete(match.athletes, match.holder)
  const orders = new Map(plans.flat().map(order => [order.athlete, order]))
  for (const player of match.athletes) {
    const order = orders.get(player.id)
    const unit = player.team === attack ? 'o' : 'd'
    const carryCost = unit === 'o' && player.slot === 1 && ['inside', 'sweep-left', 'sweep-right'].includes(play.kind) ? 8 : 0
    const recovery = player.technique === 'second-wind' ? 7 : 4
    const cost = (order ? ACTIONS[order.kind].stamina : -recovery) + carryCost
    const stamina = clamp(player.stamina - cost, 0, 100)
    if (player.team === 0 && next.club) {
      const slot = unit === 'o' ? player.slot : DEFENSE_LINEUP[player.slot]
      next.energy[0].o[slot] = stamina
      if (order) next.club.orders[slot] += 1
    } else {
      next.energy[player.team][unit][player.slot] = stamina
    }
  }
  for (const team of [0, 1] as const) {
    if (team === 0 && next.club) continue
    const idle = team === attack ? 'd' : 'o'
    next.energy[team][idle] = next.energy[team][idle].map(stamina => Math.min(100, stamina + 9))
  }

  function giveBall(yard: number) {
    startDrive(next, defending, yard)
    emit('possession', `${names[defending]} take over · ${spotLabel(next.yard)}.`)
  }
  function advance(yards: number) {
    const spot = match.yard + yards
    if (spot >= 100) {
      next.score[attack] += 7
      emit('score', `Touchdown, ${names[attack]}! Seven points including the extra point.`)
      giveBall(25)
    } else if (spot <= 0) {
      next.score[defending] += 2
      emit('score', `Safety. ${names[defending]} score two and get the ball.`)
      giveBall(35)
    } else if (spot >= match.sticks) {
      startDrive(next, attack, spot)
      emit('restart', `First down, ${names[attack]} · ${spotLabel(spot)}.`)
    } else if (match.down === 4) {
      emit('turnover', `${names[attack]} turn it over on downs.`)
      giveBall(100 - spot)
    } else {
      next.down += 1
      next.yard = spot
      emit('restart', `${downLabel(next)} · ${spotLabel(spot)}.`)
    }
  }

  if (play.kind === 'punt') {
    const rush = plans[defending].filter(order => order.kind === 'rush-kick').length
    const net = 34 + Math.floor(roll() * 0.16) - rush * 5
    const touchback = match.yard + net >= 100
    emit('ball', touchback ? 'Punt reaches the end zone for a touchback.' : `Punt nets ${net} yards.`)
    giveBall(touchback ? 20 : 100 - match.yard - net)
  } else if (play.kind === 'field-goal') {
    const distance = 117 - match.yard
    if (roll() < estimate.chance) {
      next.score[attack] += 3
      emit('score', `${names[attack]} make a ${distance}-yard field goal (${estimate.chance}% make chance).`)
      giveBall(25)
    } else {
      emit('turnover', `${names[attack]} miss a ${distance}-yard field goal (${estimate.chance}% make chance).`)
      giveBall(Math.max(20, 107 - match.yard))
    }
  } else if ('target' in play) {
    const receiver = findAthlete(match.athletes, play.target)
    if (roll() < estimate.sack) {
      const yards = 4 + Math.floor(roll() * 0.05)
      emit('ball', `${quarterback.name} is sacked for a loss of ${yards} yards.`)
      advance(-yards)
    } else if (roll() < estimate.chance) {
      const yards = Math.min(100 - match.yard, Math.max(1, estimate.yards + Math.floor(roll() * 0.07) - 3))
      emit('ball', `${quarterback.name} finds ${receiver.name} for ${yards} yards (${estimate.chance}% catch chance).`)
      advance(yards)
    } else if (roll() < estimate.pick) {
      const spot = Math.min(100, match.yard + estimate.yards)
      emit('turnover', `${names[defending]} intercept the pass intended for ${receiver.name}.`)
      giveBall(spot === 100 ? 20 : 100 - spot + Math.floor(roll() * 0.12))
    } else {
      emit('ball', `${quarterback.name} throws incomplete to ${receiver.name} (${estimate.chance}% catch chance).`)
      advance(0)
    }
  } else {
    const runner = findAthlete(match.athletes, `${attack}-o-1`)
    const yards = estimate.yards + Math.floor(roll() * 0.07) - 3
    const gain = yards < 0 ? `loses ${-yards}` : `gains ${Math.min(100 - match.yard, yards)}`
    emit('ball', `${runner.name} ${gain} yards on the ${play.kind === 'inside' ? 'inside handoff' : play.kind.replace('-', ' ')}.`)
    advance(yards)
  }
  next.turn += 1
  next.randomState = random.state
  if (finished(next)) {
    emit('finish', finalScore(next))
  } else if (next.turn === TURN_LIMIT / 2 + 1) {
    const receiver = otherTeam(match.openingTeam)
    startDrive(next, receiver, 25)
    emit('restart', `Halftime. Teams switch ends. ${names[receiver]} open the second half at their own 25.`)
  } else if ((next.turn - 1) % QUARTER_SNAPS === 0) {
    emit('restart', `Quarter ${quarter(next)}. The drive continues.`)
  }
  align(next)
  return { match: next, events }
}
