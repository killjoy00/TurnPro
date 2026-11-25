import { distance } from './math.ts'
import { COMMAND_LIMIT, type Team } from './match.ts'
import {
  athleteById, finished, legalCommands, passChance, reserveStamina, shotEstimate, type Command, type Match,
} from './hockey.ts'

export const HOCKEY_STYLES = { balanced: 'Balanced', pressure: 'Aggressive forecheck', slot: 'Protects the slot' } as const
export type HockeyStyle = keyof typeof HOCKEY_STYLES

export function planTurn(match: Match, team: Team, style: HockeyStyle = 'balanced'): Command[] {
  if (finished(match)) return []
  const puck = athleteById(match, match.holder)
  const squad = match.athletes.filter(player => player.team === team)
  const available = squad.flatMap(player => legalCommands(match, player.id))
  const towardPuck = (a: Command, b: Command) =>
    distance(athleteById(match, a.athlete).position, puck.position) - distance(athleteById(match, b.athlete).position, puck.position)

  if (puck.team !== team) {
    const change = available.find(order => order.kind === 'change')
    const tired = squad.filter(player => player.slot < 5 && player.stamina < 67).length >= 2
    const rotation = change && tired && reserveStamina(match, team) > 75 ? [change] : []
    const pressLimit = style === 'pressure' ? 3 : style === 'slot' ? 1 : 2
    const press = available.filter(order => order.kind === 'forecheck').sort(towardPuck)
      .slice(0, Math.min(pressLimit, COMMAND_LIMIT - rotation.length))
    if (rotation.length && style === 'balanced') return [...press, ...rotation]
    const guardLimit = Math.min(COMMAND_LIMIT - press.length - rotation.length, style === 'slot' ? 2 : 1)
    const guards = available.filter(order => order.kind === 'guard' && !press.some(player => player.athlete === order.athlete))
      .sort(towardPuck).slice(0, guardLimit)
    return [...press, ...rotation, ...guards]
  }

  const pass = available.filter(order => order.kind === 'pass').map(order => {
    const receiver = athleteById(match, order.target)
    const target = shotEstimate(match, receiver)
    return { order, receiver, target, score: passChance(match, puck, receiver) + target.goal * 1.6 }
  }).sort((a, b) => b.score - a.score)[0]
  const shot = available.find(order => order.kind === 'shoot')
  const carry = available.find(order => order.kind === 'carry')
  const look = shotEstimate(match, puck)
  const timer = pass && available.find(order => order.kind === 'one-timer' && order.athlete === pass.receiver.id)
  const passIntoShot = timer && look.goal + 5 < pass.target.goal && passChance(match, puck, pass.receiver) >= 58
  const primary = passIntoShot ? pass.order : shot && (look.goal >= 24 || !carry) ? shot : carry ?? pass?.order
  const plan: Command[] = primary ? [primary] : []
  if (passIntoShot) plan.push(timer)
  const screen = available.find(order => order.kind === 'screen' && !plan.some(placed => placed.athlete === order.athlete))
  if (screen && (primary?.kind === 'shoot' || passIntoShot)) plan.push(screen)
  if (plan.length < 3) {
    const support = available.find(order => order.kind === 'skate' && !plan.some(placed => placed.athlete === order.athlete)
      && order.target === (athleteById(match, order.athlete).slot === 1 ? 0 : 2))
    if (support) plan.push(support)
  }
  return plan
}
