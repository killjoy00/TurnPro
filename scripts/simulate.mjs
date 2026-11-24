import { createMatch, finished, possessionTeam, resolveTurn } from '../src/basketball.ts'
import { planTurn } from '../src/opponent.ts'

const count = Number(process.argv[2] ?? 500)
if (!Number.isSafeInteger(count) || count < 1) throw new Error('Enter a positive match count.')

const totals = {
  matches: count, startingSideWins: 0, draws: 0, totalPoints: 0, turnovers: 0,
  offensiveRebounds: 0, wins: [0, 0], winsByStyle: { balanced: 0, pressure: 0 }, orders: {},
}
for (let seed = 0; seed < count; seed += 1) {
  let match = createMatch(seed, seed % 2)
  const starter = possessionTeam(match)
  const styles = seed % 4 < 2 ? ['balanced', 'pressure'] : ['pressure', 'balanced']
  while (!finished(match)) {
    const plans = [planTurn(match, 0, styles[0]), planTurn(match, 1, styles[1])]
    for (const { kind } of plans.flat()) totals.orders[kind] = (totals.orders[kind] ?? 0) + 1
    const result = resolveTurn(match, plans)
    if (result.events.some(event => event.kind === 'turnover')) {
      totals.turnovers += 1
    }
    if (result.events.some(event => event.kind === 'rebound' && event.offensive)) {
      totals.offensiveRebounds += 1
    }
    match = result.match
  }
  const [home, away] = match.score
  totals.totalPoints += home + away
  if (home === away) {
    totals.draws += 1
    continue
  }
  const winningSide = home > away ? 0 : 1
  totals.wins[winningSide] += 1
  totals.winsByStyle[styles[winningSide]] += 1
  if (winningSide === starter) totals.startingSideWins += 1
}
console.log(JSON.stringify(totals, null, 2))
