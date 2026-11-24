import { createMatch, finished, resolveTurn } from '../src/soccer.ts'
import { planTurn } from '../src/soccer-opponent.ts'

const count = Number(process.argv[2] ?? 500)
if (!Number.isSafeInteger(count) || count < 1) throw new Error('Enter a positive match count.')

for (const budget of [3, 4]) {
  const record = { budget, matches: count, goals: 0, shots: 0, saves: 0, turnovers: 0, draws: 0, scoreless: 0, orders: {} }
  for (let seed = 0; seed < count; seed += 1) {
    let match = createMatch(seed, seed % 2, budget)
    while (!finished(match)) {
      const plans = [planTurn(match, 0), planTurn(match, 1)]
      for (const { kind } of plans.flat()) record.orders[kind] = (record.orders[kind] ?? 0) + 1
      const result = resolveTurn(match, plans)
      record.shots += plans.flat().filter(command => command.kind === 'shoot').length
      record.saves += result.events.filter(event => event.kind === 'save').length
      record.turnovers += result.events.filter(event => event.kind === 'turnover').length
      match = result.match
    }
    const [home, away] = match.score
    record.goals += home + away
    if (home === away) record.draws += 1
    if (home + away === 0) record.scoreless += 1
  }
  console.log(JSON.stringify(record))
}
