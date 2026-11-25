import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createMatch, createThirdDownPractice, direction, downLabel, fieldLines,
  finished, legalCommands, playEstimate, resolveTurn, PREVIOUS_RULES_VERSION, TURN_LIMIT,
} from '../src/football.ts'
import { planTurn } from '../src/football-opponent.ts'

const play = (kind, target) => target ? { athlete: '0-o-0', kind, target } : { athlete: '0-o-0', kind }
const pass = play('quick-pass', '0-o-7')
const slant = { athlete: '0-o-7', kind: 'slant' }
const protect = { athlete: '0-o-2', kind: 'protect' }

test('football fields two full units with role-specific orders and one call per snap', () => {
  const game = createMatch(27)
  for (const team of [0, 1]) assert.equal(game.athletes.filter(athlete => athlete.team === team).length, 11)
  assert.equal(game.holder, '0-o-0')
  assert.equal(downLabel(game), '1st & 10')
  assert.deepEqual(fieldLines(game), { scrimmage: 35, firstDown: 45 })
  assert.ok(legalCommands(game, '0-o-0').some(order => order.kind === 'sweep-left'))
  assert.ok(!legalCommands(game, '0-o-0').some(order => order.kind === 'punt'))
  assert.ok(legalCommands(game, '1-d-0').some(order => order.kind === 'blitz'))
  assert.throws(() => resolveTurn(game, [[pass, play('inside')], []]), /one command/)
  assert.throws(() => resolveTurn(game, [[play('quick-pass', '1-d-7')], []]), /unavailable/)
})

test('a slant and protection improve a quick pass and convert the coached third down', () => {
  const game = createThirdDownPractice()
  const defense = planTurn(game, 1)
  const baseline = playEstimate(game, pass, [], defense)
  const supported = playEstimate(game, pass, [slant, protect], defense)
  assert.ok(supported.chance > baseline.chance)
  assert.ok(supported.yards > baseline.yards)
  assert.ok(supported.sack < baseline.sack)
  const result = resolveTurn(game, [[pass, slant, protect], defense])
  assert.match(result.events.find(event => event.kind === 'ball').text, /Reed finds Vale/)
  assert.equal(result.match.down, 1)
  assert.ok(result.match.yard >= game.sticks)
  assert.equal(result.match.sticks, result.match.yard + 10)
  assert.equal(result.match.athletes.find(athlete => athlete.id === slant.athlete).stamina, 92)
})

test('a blitz pressures deep passes and a filled gap slows an inside handoff', () => {
  const game = createMatch(27)
  const deep = play('deep-pass', '0-o-7')
  const blitz = { athlete: '1-d-1', kind: 'blitz' }
  const fill = { athlete: '1-d-1', kind: 'fill' }
  const inside = play('inside')
  assert.ok(playEstimate(game, deep, [], [blitz]).sack > playEstimate(game, deep, []).sack)
  assert.ok(playEstimate(game, inside, [], [fill]).yards < playEstimate(game, inside, []).yards)
  assert.ok(playEstimate(game, play('sweep-left'), [], [fill]).yards > playEstimate(game, inside, [], [fill]).yards)
})

test('fourth down supports turnovers on downs, punts, and field goals in range', () => {
  const game = { ...createMatch(27), down: 4 }
  const stopped = resolveTurn(game, [[play('inside')], []])
  assert.equal(stopped.match.offense, 1)
  assert.equal(stopped.match.down, 1)
  assert.match(stopped.events.find(event => event.kind === 'turnover').text, /on downs/)
  assert.equal(stopped.match.holder, '1-o-0')
  assert.ok(stopped.match.athletes.every(athlete => athlete.id.includes(athlete.team === 1 ? '-o-' : '-d-')))
  const punt = resolveTurn(game, [[play('punt')], []])
  assert.equal(punt.match.offense, 1)
  assert.ok(punt.match.yard < stopped.match.yard)

  const inRange = { ...game, yard: 80, sticks: 90 }
  const kick = play('field-goal')
  const rush = { athlete: '1-d-0', kind: 'rush-kick' }
  assert.ok(playEstimate(inRange, kick, [], [rush]).chance < playEstimate(inRange, kick, []).chance)
  const made = resolveTurn(inRange, [[kick], []])
  assert.deepEqual(made.match.score, [3, 0])
  assert.equal(made.match.yard, 25)
  assert.equal(made.match.offense, 1)
})

test('a late fourth down uses a field goal if three points can tie or take the lead', () => {
  const game = { ...createMatch(27), turn: TURN_LIMIT, down: 4, yard: 80, sticks: 87, score: [14, 17] }
  assert.equal(planTurn(game, 0)[0].kind, 'field-goal')
  assert.notEqual(planTurn({ ...game, rulesVersion: PREVIOUS_RULES_VERSION }, 0)[0].kind, 'field-goal')
  assert.notEqual(planTurn({ ...game, score: [14, 18] }, 0)[0].kind, 'field-goal')
})

test('full seeded football games replay identically across quarters and possession changes', () => {
  const outcomes = new Set()
  for (let seed = 1; seed <= 48; seed++) {
    const openingTeam = seed % 2
    let game = createMatch(seed, openingTeam)
    for (let snap = 1; snap <= TURN_LIMIT; snap++) {
      const plans = [planTurn(game, 0), planTurn(game, 1)]
      const result = resolveTurn(game, plans)
      if (seed <= 4) assert.deepEqual(resolveTurn(JSON.parse(JSON.stringify(game)), plans), result)
      for (const event of result.events) {
        if (event.text.startsWith('Touchdown')) outcomes.add('touchdown')
        if (event.text.startsWith('Punt')) outcomes.add('punt')
        if (event.text.includes('intercept the pass')) outcomes.add('interception')
      }
      if (snap === 12) {
        assert.equal(result.match.offense, 1 - openingTeam)
        assert.equal(result.match.yard, 25)
        assert.notEqual(direction(result.match, 0), direction(game, 0))
      }
      game = result.match
      assert.ok(game.yard >= 1 && game.yard <= 99 && game.sticks > game.yard)
      assert.ok(game.down >= 1 && game.down <= 4)
    }
    assert.ok(finished(game))
    assert.deepEqual(planTurn(game, openingTeam), [])
  }
  assert.deepEqual(outcomes, new Set(['touchdown', 'punt', 'interception']))
})
