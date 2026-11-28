import { clamp, distance } from './math.ts'
import { findAthlete, type Team } from './match.ts'
import { laneReaders, threatensLane } from './opponent-lanes.ts'
import {
  attackGoal, baseAssignment, commandTarget, direction, isPass, legalCommands, passEstimate,
  previewPass, runDestination, shotEstimate, startsOffside, HALF_TURNS, PITCH, SHOT_RANGE,
  PREVIOUS_RULES_VERSION,
  type Command, type Footballer, type Match, TURN_LIMIT,
} from './soccer.ts'

export function planTurnV1(match: Match, team: Team): Command[] {
  if (match.turn > TURN_LIMIT) return []
  const holder = findAthlete(match.athletes, match.holder)
  const squad = match.athletes.filter(player => player.team === team)
  const options = squad.flatMap(player => legalCommands(match, player.id))
  const plan: Command[] = []
  if (holder.team === team) {
    const legacy = match.rulesVersion === PREVIOUS_RULES_VERSION
    const attack = direction(match, team)
    const passes = options.filter(command => command.kind === 'pass' || command.kind === 'through' || command.kind === 'cross')
    const runs = options.filter(command => command.kind === 'run')
    const preferredRun = (athlete: string) => {
      const player = findAthlete(squad, athlete)
      const channel = player.slot === 8 ? 0 : player.slot === 10 ? 2 : 1
      return runs.find(command => command.athlete === athlete && command.target === channel)
    }
    const rankedPasses = passes.filter(command => !startsOffside(match, holder, findAthlete(squad, command.target))).map(command => {
      const player = findAthlete(squad, command.target)
      const setup = command.kind === 'pass' ? undefined : preferredRun(player.id)
      const receive = setup ? runDestination(match, player, setup.target) : player.position
      const lead = command.kind === 'through' ? attack * 4 : 0
      const projected = legacy ? null : previewPass(match, command, setup ? [setup] : [])
      const arrival = projected?.destination ?? { x: clamp(receive.x + lead, 2.5, PITCH.width - 2.5), y: receive.y }
      const estimate = projected ?? passEstimate(match, holder, arrival, command.kind)
      const progress = attack * (arrival.x - holder.position.x)
      const goal = shotEstimate(match, { ...player, position: arrival }).goal
      const value = estimate.chance * 0.84 + progress * 0.9 + goal * 0.5
        + (command.kind === 'cross' ? 7 : command.kind === 'through' ? -5 : 0)
      return { command, setup, value, progress, chance: estimate.chance }
    }).sort((a, b) => b.value - a.value)
    const forward = rankedPasses.find(({ command, chance, progress }) =>
      chance >= (command.kind === 'through' ? (legacy ? 70 : 64) : 60) && progress >= 5)
    const safe = rankedPasses.find(pass => pass.command.kind === 'pass' && pass.chance >= 60)
    const shot = options.find(command => command.kind === 'shoot')
    const carry = options.find(command => command.kind === 'carry')
    const look = shotEstimate(match, holder)
    const pass = forward ?? (look.pressure > 0 ? safe : undefined)
    const ball = shot && (look.goal >= (legacy ? 21 : 16) || match.turn % HALF_TURNS === 0)
      ? shot : pass?.command ?? carry ?? shot ?? safe?.command ?? rankedPasses[0]?.command
    if (ball) plan.push(ball)
    if (ball === pass?.command && pass?.setup) plan.push(pass.setup)

    const goal = attackGoal(match, team)
    const support = runs.map(command => {
      const player = findAthlete(squad, command.athlete)
      const to = commandTarget(match, command)!
      const wing = player.slot === 8 ? 0 : player.slot === 10 ? 2 : 1
      const receiver = ball && 'target' in ball && ball.target === player.id
      const value = (player.slot >= 7 ? 12 : 0) + (command.target === wing ? 14 : 0)
        + (receiver && ball.kind !== 'pass' ? 15 : 0) - distance(to, goal) * 0.12
      return { command, value }
    }).sort((a, b) => b.value - a.value)
    for (const { command } of support) {
      if (plan.length === match.commandLimit) break
      if (!plan.some(placed => placed.athlete === command.athlete)) plan.push(command)
    }
  } else {
    const pressers = options.filter(command => command.kind === 'press')
      .sort((a, b) => distance(findAthlete(squad, a.athlete).position, holder.position)
        - distance(findAthlete(squad, b.athlete).position, holder.position))
    const shape = match.shapes[team]
    const close = pressers[0] && distance(findAthlete(squad, pressers[0].athlete).position, holder.position) <= 13
    const count = shape === 'press' ? (close ? 3 : 2) : shape === 'compact' ? 0 : close ? 2 : 1
    plan.push(...pressers.slice(0, count))
    const cover = options.filter(command => command.kind === 'hold' && !plan.some(placed => placed.athlete === command.athlete))
      .sort((a, b) => {
        const left = findAthlete(squad, a.athlete)
        const right = findAthlete(squad, b.athlete)
        return (shape === 'compact' ? (left.slot <= 5 ? 0 : 30) - (right.slot <= 5 ? 0 : 30) : 0)
          + Math.abs(left.position.y - holder.position.y) - Math.abs(right.position.y - holder.position.y)
      })
    plan.push(...cover.slice(0, match.commandLimit - plan.length))
  }
  return plan
}

function attackWithSignatures(match: Match, holder: Footballer, squad: Footballer[], defense: Footballer[], baseline: Command[]): Command[] {
  const available = legalCommands(match, holder.id)
  const passes = available.filter(isPass)
  const projected = defense.map(player => ({ ...player, position: baseAssignment(match, player.id).target }))
  const readers = laneReaders(projected, player => player.position)
  const approaches = { ...match, athletes: [...squad, ...projected] }
  const delivery = (pass: ReturnType<typeof previewPass>, kind: (typeof passes)[number]['kind']) =>
    pass.offside || ((kind === 'pass' || kind === 'through') && threatensLane(readers, holder.position, pass.destination))
      ? 0 : pass.chance / 100
  const shot = shotEstimate(match, holder)
  let bestValue = baseline[0]?.kind === 'shoot' ? shot.goal + 2 : 8
  let best: Command[] | undefined

  for (const runner of squad.filter(player => player.id !== holder.id && player.signature === 'cut-and-finish')) {
    for (const cut of legalCommands(match, runner.id).filter(command => command.kind === 'cut-and-finish')) {
      for (const pass of passes.filter(command => command.target === runner.id)) {
        if (match.commandLimit < 2) break
        const reception = previewPass(match, pass, [cut])
        const look = shotEstimate(approaches, { ...runner, position: reception.destination })
        const chance = delivery(reception, pass.kind)
        if (look.range <= SHOT_RANGE && chance >= 0.62 && look.goal * chance > bestValue) {
          bestValue = look.goal * chance
          best = [pass, cut]
        }
      }
      if (match.commandLimit < 3) continue
      for (const first of passes.filter(command => command.kind === 'pass')) {
        const relay = findAthlete(squad, first.target)
        const second = legalCommands(match, relay.id).find(order => order.kind === 'relay' && order.target === runner.id)
        if (!second) continue
        const reception = previewPass(match, first, [second])
        const start = delivery(reception, first.kind)
        const source = { ...relay, position: reception.destination }
        const end = runDestination(match, runner, cut.target)
        if (start < 0.66 || distance(source.position, end) > 37 || threatensLane(readers, source.position, end)) continue
        const relayField = { ...approaches, athletes: approaches.athletes.map(player => player.id === runner.id
          ? { ...runner, position: end } : player) }
        if (startsOffside(relayField, source, { ...runner, position: end })) continue
        const finish = passEstimate(relayField, source, end, 'pass').chance / 100
        const look = shotEstimate(relayField, { ...runner, position: end })
        const value = look.goal * start * finish - 1
        if (look.range <= SHOT_RANGE && finish >= 0.66 && value > bestValue) {
          bestValue = value
          best = [first, second, cut]
        }
      }
    }
  }
  if (best) return best

  const initial = baseline[0]
  if (initial && (initial.kind === 'pass' || initial.kind === 'through')) {
    const reception = previewPass(match, initial, baseline)
    if (threatensLane(readers, holder.position, reception.destination)) {
      const alternatives = passes.map(pass => {
        const preview = previewPass(match, pass, [])
        const chance = delivery(preview, pass.kind)
        const progress = direction(match, holder.team) * (preview.destination.x - holder.position.x)
        return { pass, chance, value: chance * 60 + progress * 0.9 }
      }).filter(candidate => candidate.chance >= 0.62).sort((a, b) => b.value - a.value)
      const otherPlay = available.find(command => command.kind === 'shoot' && shot.goal >= 16)
        ?? alternatives[0]?.pass ?? available.find(command => command.kind === 'carry' || command.kind === 'shoot')
      if (otherPlay) return [otherPlay]
    }
  }
  return baseline
}

export function planTurn(match: Match, team: Team): Command[] {
  const baseline = planTurnV1(match, team)
  if (match.turn > TURN_LIMIT || match.rulesVersion === PREVIOUS_RULES_VERSION
    || !match.athletes.some(player => player.signature === 'cut-and-finish' || player.signature === 'jump-lane')) return baseline
  const holder = findAthlete(match.athletes, match.holder)
  const squad = match.athletes.filter(player => player.team === team)
  const opposition = match.athletes.filter(player => player.team !== team)
  if (holder.team === team) return attackWithSignatures(match, holder, squad, opposition, baseline)

  const lanes = legalCommands(match, holder.id).filter(command => command.kind === 'pass' || command.kind === 'through')
    .map(pass => previewPass(match, pass, []).destination)
  const readers = laneReaders(squad.filter(player => player.slot !== 0), player => baseAssignment(match, player.id).target)
  const reserved = readers.find(player => lanes.some(to => threatensLane([player], holder.position, to)))
  const plan = baseline.filter(order => order.athlete !== reserved?.id)
  const goal = attackGoal(match, holder.team)
  const cutter = opposition.filter(player => player.signature === 'cut-and-finish'
    && legalCommands(match, player.id).some(command => command.kind === 'cut-and-finish'))
    .sort((a, b) => distance(a.position, goal) - distance(b.position, goal))[0]
  if (cutter) {
    const eligible = squad.filter(player => player.id !== reserved?.id
      && direction(match, holder.team) * (player.position.x - cutter.position.x) >= -2
      && legalCommands(match, player.id).some(order => order.kind === 'hold'))
      .sort((a, b) => distance(a.position, cutter.position) - distance(b.position, cutter.position))
    const marker = eligible[0]
    if (marker) {
      const index = plan.findIndex(order => order.athlete === marker.id)
      const hold = { athlete: marker.id, kind: 'hold' } as const
      if (index >= 0) plan[index] = hold
      else if (plan.length < match.commandLimit) plan.push(hold)
      else plan[plan.length - 1] = hold
    }
  }
  return plan
}
