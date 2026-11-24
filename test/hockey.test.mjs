import assert from 'node:assert/strict'
import test from 'node:test'
import { athleteById, createMatch, createRushPractice, finished, legalCommands, period, resolveTurn, TURN_LIMIT } from '../src/hockey.ts'
import { planTurn } from '../src/hockey-opponent.ts'

function order(match, id, kind, target) {
  const command = legalCommands(match, id).find(entry => entry.kind === kind && entry.target === target)
  assert.ok(command, `Expected legal ${kind} for ${id}`)
  return command
}

test('hockey puts five skaters and one goalie per club on ice', () => {
  const match = createMatch(32)
  assert.ok([0, 1].every(team => match.athletes.filter(player => player.team === team).length === 6))
  assert.ok([0, 1].every(team => match.athletes.some(player => player.team === team && player.role === 'GK')))
  const skate = order(match, '0-1', 'skate', 1)
  assert.throws(() => resolveTurn(match, [[skate, skate], []]), /one command/)
  assert.throws(() => resolveTurn(match, [[skate, order(match, '0-2', 'skate', 1),
    order(match, '0-3', 'skate', 0), order(match, '0-4', 'skate', 2)], []]), /up to three/)
})

test('a screened one-timer resolves after the pass', () => {
  const match = createRushPractice()
  const plan = [order(match, '0-0', 'pass', '0-1'), order(match, '0-1', 'one-timer'), order(match, '0-2', 'screen')]
  const result = resolveTurn(match, [plan, planTurn(match, 1)])
  const pass = result.events.findIndex(event => /Reed finds Vale/.test(event.text))
  const shot = result.events.findIndex(event => /one-timer.*Okafor screens Hart/.test(event.text))
  assert.ok(pass > 1 && shot > pass)
  assert.equal(athleteById(result.match, '0-1').stamina, 88)
})

test('fresh line replaces the skaters, keeps the goalie and recovers the reserve', () => {
  const match = createMatch(31, 1)
  athleteById(match, '0-0').stamina = 49
  const first = resolveTurn(match, [[order(match, '0-5', 'change')], []]).match
  assert.equal(first.lines[0], 1)
  assert.equal(athleteById(first, '0-0').name, 'Rowan')
  assert.equal(athleteById(first, '0-5').name, 'Shaw')
  assert.equal(first.bench[0][0][0], 53)
  const second = resolveTurn(first, [[order(first, '0-5', 'change')], []]).match
  assert.equal(second.lines[0], 0)
  assert.equal(athleteById(second, '0-0').stamina, 66)
  const onPuck = createMatch(31)
  const held = resolveTurn(onPuck, [[order(onPuck, '0-5', 'change')], []])
  assert.equal(held.match.lines[0], 0)
  assert.ok(held.events.some(event => /keep their line on/.test(event.text)))
})

test('AI matches replay through every period and resolve shots, rebounds, and line changes', () => {
  const kinds = new Set()
  let changed = false
  for (let seed = 0; seed < 48; seed++) {
    let match = createMatch(seed, seed % 2)
    for (let turn = 1; turn <= TURN_LIMIT; turn++) {
      const plans = [planTurn(match, 0), planTurn(match, 1)]
      const result = resolveTurn(match, plans)
      assert.deepEqual(resolveTurn(JSON.parse(JSON.stringify(match)), plans), result)
      const breaks = turn === 6 || turn === 12
      if (breaks) {
        assert.notEqual(period(match), period(result.match))
        assert.ok(result.events.some(event => event.text.includes('switch ends')))
      }
      for (const event of result.events) kinds.add(event.kind)
      changed ||= result.match.lines.some(line => line === 1)
      match = result.match
    }
    assert.ok(finished(match))
    assert.throws(() => resolveTurn(match, [[], []]), /over/)
  }
  assert.ok(changed)
  for (const kind of ['score', 'save', 'rebound', 'turnover', 'finish']) assert.ok(kinds.has(kind), kind)
})
