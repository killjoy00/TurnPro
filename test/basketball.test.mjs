import assert from 'node:assert/strict'
import test from 'node:test'
import {
  athleteById, createMatch, finished, legalCommands, possessionTeam, resolveTurn, TURN_LIMIT,
} from '../src/basketball.ts'
import { distance } from '../src/math.ts'
import { planTurn } from '../src/opponent.ts'

function command(match, athlete, kind, target) {
  const result = legalCommands(match, athlete).find(action => action.kind === kind && action.target === target)
  assert.ok(result, `Expected a legal ${kind} for ${athlete}`)
  return result
}

test('both full lineups act within the same three-command rules', () => {
  const match = createMatch(2026)
  assert.equal(match.athletes.filter(athlete => athlete.team === 0).length, 5)
  assert.equal(match.athletes.filter(athlete => athlete.team === 1).length, 5)
  const drive = command(match, '0-0', 'drive')
  assert.throws(() => resolveTurn(match, [[drive, drive], []]), /one command/)
  assert.throws(() => resolveTurn(match, [[], [drive]]), /unavailable/)
  assert.throws(() => resolveTurn(match, [[{ athlete: '0-1', kind: 'shoot' }], []]), /unavailable/)
  assert.throws(() => resolveTurn(match, [[{ athlete: '0-0', kind: 'pass', target: '1-1' }], []]), /unavailable/)
  assert.throws(() => resolveTurn(match, [[drive, ...[1, 2, 3].map(slot =>
    command(match, `0-${slot}`, 'cut', 0))], []]), /up to three/)
})

test('an off-ball screen enables a drive and both plans turn into one event log', () => {
  const match = createMatch(2026)
  const drive = command(match, '0-0', 'drive')
  const screen = command(match, '0-4', 'screen')
  const defense = [command(match, '1-0', 'mark', '0-0')]
  const { match: next, events } = resolveTurn(match, [[drive, screen], defense])
  assert.deepEqual(events.slice(0, 2).map(event => event.kind), ['plan', 'plan'])
  assert.match(events[2].text, /Okafor screens Quinn/)
  assert.match(events[3].text, /Reed drives/)
  const initialPosition = athleteById(match, '0-0').position
  const withScreen = distance(initialPosition, athleteById(next, '0-0').position)
  const withoutScreen = resolveTurn(match, [[drive], defense]).match
  assert.ok(withScreen > 5)
  assert.ok(withScreen > distance(initialPosition, athleteById(withoutScreen, '0-0').position))
  assert.equal(athleteById(next, '0-0').stamina, 86)
  assert.equal(athleteById(next, '0-4').stamina, 92)
  assert.equal(athleteById(match, '0-0').stamina, 100)
  const following = resolveTurn(next, [[], []]).match
  assert.equal(athleteById(following, '0-0').stamina, 92)
})

test('cuts change the receiving position before passes resolve', () => {
  const match = createMatch(2026)
  const pass = command(match, '0-0', 'pass', '0-1')
  const cut = command(match, '0-1', 'cut', 0)
  const { match: next, events } = resolveTurn(match, [[pass, cut], []])
  const move = events.findIndex(event => event.kind === 'movement')
  const ball = events.findIndex(event => event.kind === 'ball' || event.kind === 'turnover')
  assert.match(events[move].text, /Vale cuts/)
  assert.ok(move < ball)
  assert.ok(events.some(event => /completion/.test(event.text)))
  assert.equal(next.turn, 2)
})

test('shots score two or three, misses find a rebounder, and made baskets switch possession', () => {
  let madeTwo = false
  let madeThree = false
  let missed = false
  for (let seed = 0; seed < 32; seed += 1) {
    for (const holder of ['0-0', '0-3']) {
      const match = createMatch(seed)
      match.holder = holder
      const result = resolveTurn(match, [[command(match, holder, 'shoot')], []])
      if (result.events.some(event => event.kind === 'score')) {
        assert.equal(possessionTeam(result.match), 1)
        assert.equal(result.match.score[0], holder === '0-0' ? 3 : 2)
        madeTwo ||= holder === '0-3'
        madeThree ||= holder === '0-0'
      } else {
        assert.ok(result.events.some(event => event.kind === 'rebound'))
        assert.deepEqual(result.match.score, [0, 0])
        missed = true
      }
    }
  }
  assert.ok(madeTwo && madeThree && missed)
})

test('serialized seeded matches replay identically through the final turn', () => {
  for (let seed = 0; seed < 32; seed += 1) {
    let match = createMatch(seed, seed % 2)
    let replay = JSON.parse(JSON.stringify(match))
    for (let turn = 1; turn <= TURN_LIMIT; turn += 1) {
      const plans = [planTurn(match, 0), planTurn(match, 1, 'pressure')]
      const resolution = resolveTurn(match, plans)
      const fromSerialization = resolveTurn(replay, structuredClone(plans))
      assert.deepEqual(resolution, fromSerialization)
      assert.equal(resolution.events.some(event => event.kind === 'finish'), turn === TURN_LIMIT)
      match = resolution.match
      replay = JSON.parse(JSON.stringify(fromSerialization.match))
      assert.equal(match.athletes.length, 10)
      assert.ok(match.athletes.every(athlete => athlete.stamina >= 0 && athlete.stamina <= 100))
      assert.ok(match.athletes.some(athlete => athlete.id === match.holder))
    }
    assert.ok(finished(match))
    assert.throws(() => resolveTurn(match, [[], []]), /match is over/)
  }
})
