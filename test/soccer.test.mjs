import assert from 'node:assert/strict'
import test from 'node:test'
import {
  athleteById, createCrossingPractice, createMatch, direction, finished, HALF_TURNS, legalCommands, resolveTurn, TURN_LIMIT,
} from '../src/soccer.ts'
import { planTurn } from '../src/soccer-opponent.ts'

function order(match, athlete, kind, target) {
  const command = legalCommands(match, athlete).find(option => option.kind === kind && option.target === target)
  assert.ok(command, `Expected a legal ${kind} for ${athlete}`)
  return command
}

function place(match, id, x, y) {
  athleteById(match, id).position = { x, y }
}

test('soccer fields full teams and applies the selected budget to both sides', () => {
  const match = createMatch(2026)
  assert.equal(match.athletes.filter(player => player.team === 0).length, 11)
  assert.equal(match.athletes.filter(player => player.team === 1).length, 11)
  assert.equal(match.athletes.filter(player => player.role === 'GK').length, 2)
  const plans = [
    [order(match, '0-6', 'carry'), ...[7, 8, 9].map(slot => order(match, `0-${slot}`, 'run', 0))],
    [1, 2, 3, 4].map(slot => order(match, `1-${slot}`, 'hold')),
  ]
  assert.throws(() => resolveTurn(match, [plans[0], []]), /up to three/)
  assert.throws(() => resolveTurn(match, [[], plans[1]]), /up to three/)
  assert.throws(() => resolveTurn(match, [[plans[0][0], plans[0][0]], []]), /one command/)
  assert.throws(() => resolveTurn(match, [[plans[1][0]], []]), /unavailable/)
  const four = createMatch(2026, 0, 4)
  const result = resolveTurn(four, plans)
  assert.deepEqual(result.events.slice(0, 2).map(event => event.kind), ['plan', 'plan'])
  assert.ok(athleteById(result.match, '0-6').position.x > 60)
  assert.equal(athleteById(result.match, '0-6').stamina, 88)
  assert.equal(athleteById(four, '0-6').stamina, 100)
})

test('a winger can cross to a striker attacking the middle', () => {
  const match = createCrossingPractice()
  const cross = order(match, '0-8', 'cross', '0-9')
  const run = order(match, '0-9', 'run', 1)
  const { match: next, events } = resolveTurn(match, [[cross, run], []])
  assert.match(events[2].text, /Adeyemi runs/)
  assert.match(events[3].text, /Vale finds Adeyemi with a cross/)
  assert.equal(next.holder, '0-9')
  assert.ok(athleteById(next, '0-9').position.x > 90)
  assert.ok(legalCommands(next, next.holder).some(option => option.kind === 'shoot'))
})

test('offside and pressing can change possession without a midfield reset', () => {
  const match = createMatch(2)
  match.holder = '0-7'
  place(match, '0-7', 74, 35)
  place(match, '0-9', 99, 34)
  place(match, '1-2', 88, 22)
  place(match, '1-3', 89, 46)
  const pass = order(match, '0-7', 'pass', '0-9')
  const offside = resolveTurn(match, [[pass], []])
  assert.ok(offside.events.some(event => event.kind === 'turnover' && event.text.includes('offside')))
  assert.equal(athleteById(offside.match, offside.match.holder).team, 1)
  assert.deepEqual(athleteById(offside.match, '0-7').position, { x: 74, y: 35 })

  let tackle
  for (let seed = 0; seed < 32; seed += 1) {
    const start = createMatch(seed)
    place(start, '0-6', 61, 34)
    place(start, '1-6', 64, 34)
    tackle = resolveTurn(start, [[], [order(start, '1-6', 'press')]])
    if (tackle.match.holder === '1-6') break
  }
  assert.equal(tackle.match.holder, '1-6')
  assert.ok(tackle.events.some(event => event.kind === 'turnover' && event.text.includes('tackle')))
  assert.notDeepEqual(athleteById(tackle.match, '1-6').position, { x: 52.5, y: 34 })
})

test('an uncommanded keeper can save or take a goal kick and goals restart at midfield', () => {
  const outcomes = new Set()
  for (let seed = 0; seed < 64; seed += 1) {
    const match = createMatch(seed)
    match.holder = '0-9'
    place(match, '0-9', 93, 34)
    const { match: next, events } = resolveTurn(match, [[order(match, '0-9', 'shoot')], []])
    const mainEvent = events.find(event => ['score', 'save', 'restart'].includes(event.kind))
    assert.ok(mainEvent)
    outcomes.add(mainEvent.kind)
    if (mainEvent.kind === 'score') {
      assert.deepEqual(next.score, [1, 0])
      assert.equal(next.holder, '1-6')
      assert.deepEqual(athleteById(next, next.holder).position, { x: 52.5, y: 34 })
    } else {
      assert.equal(next.holder, '1-0')
      assert.deepEqual(next.score, [0, 0])
    }
  }
  assert.deepEqual([...outcomes].sort(), ['restart', 'save', 'score'])
})

test('both budgets replay complete fixtures with a second-half change of ends', () => {
  for (const budget of [3, 4]) {
    for (let seed = 0; seed < 16; seed += 1) {
      const opener = seed % 2
      let match = createMatch(seed, opener, budget)
      for (let turn = 1; turn <= TURN_LIMIT; turn += 1) {
        const plans = [planTurn(match, 0), planTurn(match, 1)]
        const resolution = resolveTurn(match, plans)
        assert.deepEqual(resolution, resolveTurn(JSON.parse(JSON.stringify(match)), structuredClone(plans)))
        match = resolution.match
        assert.ok(match.athletes.every(player => player.stamina >= 0 && player.stamina <= 100))
        if (turn === HALF_TURNS) {
          assert.ok(resolution.events.some(event => event.text.startsWith('Half-time')))
          assert.equal(direction(match, 0), -1)
          assert.equal(match.holder, `${1 - opener}-6`)
        }
        assert.equal(resolution.events.some(event => event.kind === 'finish'), turn === TURN_LIMIT)
      }
      assert.ok(finished(match))
      assert.throws(() => resolveTurn(match, [[], []]), /match is over/)
    }
  }
})
