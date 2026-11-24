import {
  athleteById, COURT, LANDMARKS, legalCommands, possessionTeam, shotEstimate, TURN_LIMIT,
  type Athlete, type Command, type Match, type Team,
} from './basketball.ts'
import { distance } from './math.ts'

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

export function planTurn(match: Match, team: Team, style: 'balanced' | 'pressure' = 'balanced'): Command[] {
  const athletes = match.athletes.filter(athlete => athlete.team === team)
  const holder = athleteById(match, match.holder)
  const commands: Command[] = []
  const available = (athlete: Athlete) => legalCommands(match, athlete.id)
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
    if (shoot && (expected >= 125 || current.range <= 11 || holder.stamina < 55 || match.turn === TURN_LIMIT)) {
      add(shoot)
    } else if (pass && receivingShot && receivingShot.chance * receivingShot.points >= expected + 27) {
      add(pass)
    } else {
      add(drive ?? shoot ?? pass)
    }

    const screener = choose(athletes.filter(athlete => available(athlete).some(command => command.kind === 'screen')),
      athlete => 2 * athlete.strength - distance(athlete.position, holder.position))
    if (screener && commands[0]?.kind !== 'pass') {
      add(available(screener).find(command => command.kind === 'screen'))
    }

    const runner = choose(athletes.filter(athlete => athlete.id !== holder.id
      && !commands.some(command => command.athlete === athlete.id)),
    athlete => athlete.shooting + (receiver?.id === athlete.id ? 4 : 0))
    if (runner) {
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
      add(style === 'pressure' ? deny ?? protect : protect)
    }
  }

  return commands
}
