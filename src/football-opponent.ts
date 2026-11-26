import { COMMAND_LIMIT, otherTeam, type Team } from './match.ts'
import { clamp } from './math.ts'
import { finished, legalCommands, playEstimate, PREVIOUS_RULES_VERSION, TURN_LIMIT, type Command, type Match, type Play } from './football.ts'

export const FOOTBALL_STYLES = { balanced: 'Situational defense', pressure: 'Blitz-heavy', shell: 'Deep coverage' } as const
export type FootballStyle = keyof typeof FOOTBALL_STYLES

function defensiveCalls(match: Match, style: FootballStyle, needed: number): Command['kind'][] {
  if (match.down === 4 && match.yard >= 58 && needed >= 4) return ['rush-kick', 'fill', 'cover-short']
  if (match.formation === 'power') return ['fill', 'fill', style === 'pressure' ? 'blitz' : 'cover-short']
  if (match.formation === 'spread') return [style === 'pressure' ? 'blitz' : 'cover-deep', 'cover-deep', 'cover-short']
  if (style === 'pressure') return ['blitz', 'blitz', 'cover-short']
  if (style === 'shell') return ['cover-deep', 'cover-deep', 'fill']
  return needed >= 8 ? ['blitz', 'cover-deep', 'cover-short'] : ['fill', 'fill', 'cover-short']
}

export function planTurn(match: Match, team: Team, style: FootballStyle = 'balanced'): Command[] {
  if (finished(match)) return []
  const squad = match.athletes.filter(player => player.team === team).sort((a, b) => b.stamina - a.stamina)
  const options = squad.flatMap(player => legalCommands(match, player.id))
  const needed = match.sticks - match.yard

  if (match.offense !== team) {
    const plan: Command[] = []
    for (const kind of defensiveCalls(match, style, needed)) {
      const option = options.find(order => order.kind === kind && !plan.some(previous => previous.athlete === order.athlete))
      if (option) plan.push(option)
    }
    return plan
  }

  // Keep the established opponent choices for saved fixtures that predate stored opponent orders.
  const calls = options.filter((order): order is Play => order.athlete === match.holder && order.kind !== 'play-action')
  const fieldGoal = calls.find(play => play.kind === 'field-goal')
  const punt = calls.find(play => play.kind === 'punt')
  const deficit = match.score[otherTeam(team)] - match.score[team]
  const late = match.turn >= TURN_LIMIT - 3
  const urgent = late && deficit > 0
  if (match.rulesVersion !== PREVIOUS_RULES_VERSION && fieldGoal && late && deficit >= 1 && deficit <= 3) {
    return [fieldGoal]
  }
  if (fieldGoal && !urgent && (needed > 3 || match.turn >= TURN_LIMIT - 1)) return [fieldGoal]
  if (punt && !fieldGoal && !urgent && (needed > 2 || match.yard < 50)) return [punt]

  const candidates = calls.filter(play => play.kind !== 'punt' && play.kind !== 'field-goal').map(play => {
    const passing = 'target' in play
    const route = passing ? options.find(order => order.athlete === play.target
      && order.kind === (play.kind === 'deep-pass' ? 'go' : 'slant')) : undefined
    const support = options.filter(order => order.kind === (passing ? 'protect' : 'run-block'))
    const plan = [play, ...(route ? [route] : []), ...support].slice(0, COMMAND_LIMIT)
    const estimate = playEstimate(match, play, plan)
    const catchChance = estimate.chance / 100 * (1 - estimate.sack / 100)
    const needsChunk = urgent || needed >= 12 || (match.down === 2 && match.yard >= 50 && needed >= 6)
    const yards = Math.min(estimate.yards, 100 - match.yard, Math.max(7, needed + (needsChunk ? 14 : 3)))
    const conversion = clamp((estimate.yards - needed + 4) / 7, 0, 1)
    const setupRun = !passing && match.down === 1 ? 0.7 : 0
    const deepRisk = play.kind === 'deep-pass' && !needsChunk ? 1.9 : 0
    const score = yards * catchChance * 0.46 + conversion * catchChance * (match.down >= 3 ? 13 : 4)
      + setupRun - deepRisk - (passing ? (1 - catchChance) * (3 + estimate.pick * 0.14) : 0)
    return { plan, score }
  })
  return candidates.sort((a, b) => b.score - a.score)[0]?.plan ?? []
}
