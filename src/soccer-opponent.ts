import { clamp, distance } from './math.ts'
import { findAthlete, type Team } from './match.ts'
import {
  attackGoal, commandTarget, direction, legalCommands, passEstimate, runDestination, shotEstimate, startsOffside, HALF_TURNS, PITCH,
  type Command, type Match, TURN_LIMIT,
} from './soccer.ts'

export function planTurn(match: Match, team: Team): Command[] {
  if (match.turn > TURN_LIMIT) return []
  const holder = findAthlete(match.athletes, match.holder)
  const squad = match.athletes.filter(player => player.team === team)
  const options = squad.flatMap(player => legalCommands(match, player.id))
  const plan: Command[] = []
  if (holder.team === team) {
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
      const arrival = { x: clamp(receive.x + lead, 2.5, PITCH.width - 2.5), y: receive.y }
      const estimate = passEstimate(match, holder, arrival, command.kind)
      const progress = attack * (arrival.x - holder.position.x)
      const goal = shotEstimate(match, { ...player, position: arrival }).goal
      const value = estimate.chance * 0.84 + progress * 0.9 + goal * 0.5
        + (command.kind === 'cross' ? 7 : command.kind === 'through' ? -5 : 0)
      return { command, setup, value, progress, chance: estimate.chance }
    }).sort((a, b) => b.value - a.value)
    const forward = rankedPasses.find(({ command, chance, progress }) =>
      chance >= (command.kind === 'through' ? 70 : 60) && progress >= 5)
    const safe = rankedPasses.find(pass => pass.command.kind === 'pass' && pass.chance >= 60)
    const shot = options.find(command => command.kind === 'shoot')
    const carry = options.find(command => command.kind === 'carry')
    const look = shotEstimate(match, holder)
    const pass = forward ?? (look.pressure > 0 ? safe : undefined)
    const ball = shot && (look.goal >= 21 || match.turn % HALF_TURNS === 0)
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
    const count = pressers[0] && distance(findAthlete(squad, pressers[0].athlete).position, holder.position) <= 13 ? 2 : 1
    plan.push(...pressers.slice(0, count))
    const cover = options.filter(command => command.kind === 'hold' && !plan.some(placed => placed.athlete === command.athlete))
      .sort((a, b) => Math.abs(findAthlete(squad, a.athlete).position.y - holder.position.y)
        - Math.abs(findAthlete(squad, b.athlete).position.y - holder.position.y))
    plan.push(...cover.slice(0, match.commandLimit - plan.length))
  }
  return plan
}
