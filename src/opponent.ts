import {
  athleteById, COURT, LANDMARKS, legalCommands, passCompletion, possessionTeam, projectAssignment, shotEstimate, TURN_LIMIT,
  type Athlete, type Command, type Match, type Team,
} from './basketball.ts'
import { distance, distanceToSegment, type Point } from './math.ts'
import { laneReaders, threatensLane } from './opponent-lanes.ts'

function choose<T>(candidates: readonly T[], value: (candidate: T) => number): T | undefined {
  let best: T | undefined
  let bestValue = -Infinity
  for (const candidate of candidates) {
    const score = value(candidate)
    if (score > bestValue) {
      best = candidate
      bestValue = score
    }
  }
  return best
}

export type DefenseStyle = 'balanced' | 'pressure' | 'switch' | 'help' | 'stay'
export const DEFENSE_NAMES: Record<DefenseStyle, string> = {
  balanced: 'Balanced', pressure: 'Deny passes', switch: 'Switch screens', help: 'Help in the paint', stay: 'Stay with shooters',
}

export function planTurnV1(match: Match, team: Team, style: DefenseStyle = 'balanced'): Command[] {
  const athletes = match.athletes.filter(athlete => athlete.team === team)
  const holder = athleteById(match, match.holder)
  const commands: Command[] = []
  const available = (athlete: Athlete) => legalCommands(match, athlete.id)
  const unassigned = (athlete: Athlete) => !commands.some(command => command.athlete === athlete.id)
  const add = (command: Command | undefined) => {
    if (command) commands.push(command)
  }

  if (possessionTeam(match) === team) {
    const current = shotEstimate(match, holder)
    const expected = current.chance * current.points
    const pass = choose(available(holder).filter(command => command.kind === 'pass'), command => {
      const shot = shotEstimate(match, athleteById(match, command.target))
      return shot.chance * shot.points
    })
    const receiver = pass && athleteById(match, pass.target)
    const receivingShot = receiver && shotEstimate(match, receiver)
    const shoot = available(holder).find(command => command.kind === 'shoot')
    const drive = available(holder).find(command => command.kind === 'drive')
    const finish = available(holder).find(command => command.kind === 'finish')
    const kickout = choose(available(holder).filter(command => command.kind === 'kickout'), command => {
      const shot = shotEstimate(match, athleteById(match, command.target))
      return shot.chance * shot.points
    })
    const outlet = kickout && shotEstimate(match, athleteById(match, kickout.target))
    if (kickout && outlet && current.pressure >= 25 && outlet.points * outlet.chance > expected + 20) {
      add(kickout)
      add(available(athleteById(match, kickout.target)).find(command => command.kind === 'catch-shoot'))
    } else if (shoot && (expected >= 125 || current.range <= 11 || holder.stamina < 55 || match.turn === TURN_LIMIT)) {
      add(shoot)
    } else if (pass && receivingShot && receivingShot.chance * receivingShot.points >= expected + 27) {
      add(pass)
    } else {
      add((finish && current.range <= 23 ? finish : drive) ?? shoot ?? pass)
    }

    const screener = choose(athletes.filter(athlete => unassigned(athlete) && available(athlete).some(command => command.kind === 'screen')),
      athlete => 2 * athlete.strength - distance(athlete.position, holder.position))
    if (screener && commands[0]?.kind !== 'pass') {
      add(available(screener).find(command => command.kind === 'screen'))
    }

    const runner = choose(athletes.filter(athlete => athlete.id !== holder.id && unassigned(athlete)),
    athlete => athlete.shooting + (receiver?.id === athlete.id ? 4 : 0))
    if (runner && commands.length < 3) {
      const cuts = available(runner).filter(command => command.kind === 'cut')
      add(choose(cuts, command => {
        const target = LANDMARKS[command.target]
        const separation = Math.min(...match.athletes.filter(athlete => athlete.id !== runner.id)
          .map(athlete => distance(athlete.position, target)))
        return separation - distance(runner.position, target) * 0.35
      }))
    }
  } else {
    const defender = choose(athletes.filter(athlete => available(athlete).some(command => command.kind === 'mark')),
      athlete => athlete.speed - distance(athlete.position, holder.position))
    if (defender) {
      const mark = available(defender).find(command => command.kind === 'mark' && command.target === holder.id)
      add(mark)
    }
    const help = choose(athletes.filter(athlete => athlete !== defender
      && available(athlete).some(command => command.kind === 'protect')),
    athlete => athlete.strength - distance(athlete.position, COURT.hoop) * 0.3)
    if (help) {
      const nearbyThreat = choose(match.athletes.filter(athlete => athlete.team === holder.team && athlete.id !== holder.id),
        athlete => shotEstimate(match, athlete).chance - distance(athlete.position, help.position))
      const deny = available(help).find(command => command.kind === 'deny' && command.target === nearbyThreat?.id)
      const protect = available(help).find(command => command.kind === 'protect')
      const response = available(help).find(command => command.kind === style)
      add(style === 'pressure' ? deny ?? protect : response ?? protect)
    }
  }

  return commands
}

function basketPass(passer: Athlete, destination: Point, defense: readonly Athlete[]): number {
  return passCompletion(passer, distance(passer.position, destination), defense.filter(player =>
    distanceToSegment(player.position, passer.position, destination) <= 3)) / 100
}

function attackWithSignatures(match: Match, holder: Athlete, squad: Athlete[], defense: Athlete[], baseline: Command[]): Command[] {
  const available = legalCommands(match, holder.id)
  const passes = available.filter(command => command.kind === 'pass')
  const projected = defense.map(player => ({ ...player, position: projectAssignment(match, player) }))
  const readers = laneReaders(projected, player => player.position)
  const safeDelivery = (passer: Athlete, to: Point) => threatensLane(readers, passer.position, to) ? 0
    : basketPass(passer, to, projected)
  const shooting = shotEstimate(match, holder)
  let bestValue = baseline[0]?.kind === 'shoot' ? shooting.chance * shooting.points + 5 : 45
  let best: Command[] | undefined
  const projections = { ...match, athletes: [...squad, ...projected] }

  for (const runner of squad.filter(player => player.id !== holder.id && player.signature === 'cut-and-finish')) {
    const feed = passes.find(command => command.target === runner.id)
    for (const cut of legalCommands(match, runner.id).filter(command => command.kind === 'cut-and-finish')) {
      const position = projectAssignment(match, runner, cut)
      const shot = shotEstimate(projections, { ...runner, position })
      if (shot.range > 34) continue
      const value = shot.chance * shot.points
      const direct = feed && safeDelivery(holder, position)
      if (feed && direct && direct >= 0.60 && value * direct > bestValue) {
        best = [feed, cut]
        bestValue = value * direct
      }

      for (const first of passes) {
        const relay = athleteById(match, first.target)
        const second = legalCommands(match, relay.id).find(order => order.kind === 'relay' && order.target === runner.id)
        if (!second) continue
        const start = safeDelivery(holder, relay.position)
        const finish = safeDelivery(relay, position)
        const combined = value * start * finish - 5
        if (start >= 0.68 && finish >= 0.68 && combined > bestValue) {
          best = [first, second, cut]
          bestValue = combined
        }
      }
    }
  }
  if (best) return best

  const initial = baseline[0]
  if ((initial?.kind === 'pass' || initial?.kind === 'kickout')
    && threatensLane(readers, holder.position, athleteById(match, initial.target).position)) {
    const pass = choose(passes.filter(pass => safeDelivery(holder, athleteById(match, pass.target).position) >= 0.60),
      pass => {
        const target = athleteById(match, pass.target)
        const shot = shotEstimate(projections, target)
        return shot.chance * shot.points * safeDelivery(holder, target.position)
      })
    const otherPlay = available.find(command => command.kind === 'shoot' && shooting.chance >= 45)
      ?? pass ?? available.find(command => command.kind === 'drive' || command.kind === 'shoot')
    if (otherPlay) return [otherPlay]
  }
  return baseline
}

export function planTurn(match: Match, team: Team, style: DefenseStyle = 'balanced'): Command[] {
  const baseline = planTurnV1(match, team, style)
  if (match.turn > TURN_LIMIT || !match.athletes.some(player => player.signature === 'cut-and-finish' || player.signature === 'jump-lane')) return baseline
  const holder = athleteById(match, match.holder)
  const squad = match.athletes.filter(player => player.team === team)
  const opposition = match.athletes.filter(player => player.team !== team)
  if (holder.team === team) return attackWithSignatures(match, holder, squad, opposition, baseline)

  const passes = legalCommands(match, holder.id).filter(command => command.kind === 'pass')
  const readers = laneReaders(squad, player => projectAssignment(match, player))
  const reserved = readers.find(player => passes.some(pass =>
    threatensLane([player], holder.position, athleteById(match, pass.target).position)))
  const plan = baseline.filter(order => order.athlete !== reserved?.id)
  if (!opposition.some(player => player.signature === 'cut-and-finish')) return plan
  const attack = attackWithSignatures(match, holder, opposition, squad, planTurnV1(match, holder.team))
  const cut = attack.find(order => order.kind === 'cut-and-finish')
  if (!cut || plan.length >= 3) return plan
  const runner = athleteById(match, cut.athlete)
  const destination = projectAssignment(match, runner, cut)
  const relay = attack.find(order => order.kind === 'relay')
  const passer = relay ? athleteById(match, relay.athlete) : holder
  const candidates = squad.filter(player => player.id !== reserved?.id
    && !plan.some(order => order.athlete === player.id))
    .flatMap(player => legalCommands(match, player.id).filter(order => order.kind === 'deny' && order.target === runner.id))
  const response = choose(candidates, order => {
    const defender = athleteById(match, order.athlete)
    const at = projectAssignment(match, defender, order)
    const lane = distanceToSegment(at, passer.position, destination)
    const contest = distance(at, destination)
    return (lane <= 3 ? 12 : 0) - lane - contest * 0.4
  })
  if (response) plan.push(response)
  return plan
}
