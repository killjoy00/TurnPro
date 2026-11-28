import assert from 'node:assert/strict'
import test from 'node:test'
import * as basketball from '../src/basketball.ts'
import * as soccer from '../src/soccer.ts'
import { clubAthlete, createClub, readClub, settleFixture } from '../src/club.ts'
import { beginClubFixture, openClubFixture, upgradeClubFixture } from '../src/club-fixture.ts'
import { planTurn as basketballAI, planTurnV1 as basketballV1 } from '../src/opponent.ts'
import { planTurn as soccerAI, planTurnV1 as soccerV1 } from '../src/soccer-opponent.ts'

const sports = [
  {
    engine: basketball, name: 'basketball', setup: () => basketball.createMatch(0), plan: basketballAI, earlier: basketballV1,
    relay: '0-2', cutter: '0-1',
    relayPositions: { '0-0': [20, 41], '0-1': [10, 22], '0-2': [36, 25], '0-3': [40, 15], '1-2': [34.4, 15.9], '1-3': [35, 2] },
    reserve: '1-4', reserveTarget: '0-1',
    reservePositions: { '0-0': [22, 28], '0-1': [9, 20], '0-2': [45, 22], '0-3': [36, 6], '1-2': [39.4, 28.9], '1-3': [36, 11.3] },
    counter: '1-4',
    counterPositions: { '0-0': [23, 25], '0-1': [10, 18], '0-2': [46, 33], '0-3': [30, 12], '1-2': [30.4, 11.9], '1-3': [32, 3.3] },
  },
  {
    engine: soccer, name: 'soccer', setup: soccer.createCrossingPractice, plan: soccerAI, earlier: soccerV1,
    relay: '0-6', cutter: '0-9',
    relayPositions: { '0-8': [75, 4], '0-6': [57.5, 28], '0-9': [81, 44], '1-9': [58, 40], '1-5': [69, 26] },
    reserve: '1-5', reserveTarget: '0-6',
    reservePositions: { '0-8': [78, 19], '0-6': [51.5, 39], '0-9': [88, 32], '1-9': [65, 33], '1-5': [64, 28] },
    counter: '1-5',
    counterPositions: { '0-8': [72, 19], '0-6': [50.5, 44], '0-9': [78, 35], '1-9': [61, 30], '1-5': [70, 24] },
  },
]

function place(engine, match, positions) {
  for (const [id, [x, y]] of Object.entries(positions)) engine.athleteById(match, id).position = { x, y }
}

function jumped(resolution) {
  return resolution.events.some(({ text }) => text.includes('jumps the passing lane.'))
}

for (const data of sports) {
  const { engine, name, setup, plan, earlier } = data

  test(`${name} AI can choose and complete a three-athlete relay and finish`, () => {
    const match = setup()
    place(engine, match, data.relayPositions)
    const relay = engine.athleteById(match, data.relay)
    relay.signature = 'relay'
    relay.passing = 12
    engine.athleteById(match, data.cutter).signature = 'cut-and-finish'
    const orders = plan(match, 0)
    assert.deepEqual(orders.map(order => order.kind), ['pass', 'relay', 'cut-and-finish'])
    assert.deepEqual(plan({ ...match, randomState: match.randomState + 1 }, 0), orders)
    const { events } = engine.resolveTurn(match, [orders, []])
    assert.ok(events.some(event => /cuts.*shoots/.test(event.text)))
    const reply = plan(match, 1)
    assert.notDeepEqual(reply, earlier(match, 1))
    assert.doesNotThrow(() => engine.resolveTurn(match, [orders, reply]))
  })

  test(`${name} AI leaves a lane reader free and chooses a safe delivery against one`, () => {
    const match = setup()
    place(engine, match, data.reservePositions)
    engine.athleteById(match, data.reserve).signature = 'jump-lane'
    const pass = { athlete: match.holder, kind: 'pass', target: data.reserveTarget }
    const defense = plan(match, 1)
    assert.ok(earlier(match, 1).some(order => order.athlete === data.reserve))
    assert.ok(!defense.some(order => order.athlete === data.reserve))
    assert.ok(jumped(engine.resolveTurn(match, [[pass], defense])))

    const venue = setup()
    place(engine, venue, data.counterPositions)
    engine.athleteById(venue, data.counter).signature = 'jump-lane'
    const reaction = plan(venue, 1)
    const originalAttack = earlier(venue, 0)
    const awareAttack = plan(venue, 0)
    assert.notDeepEqual(awareAttack[0], originalAttack[0])
    assert.ok(jumped(engine.resolveTurn(venue, [originalAttack, reaction])))
    assert.ok(!jumped(engine.resolveTurn(venue, [awareAttack, reaction])))
  })

  test(`${name} saved fixtures retain their policy and new rivals scout and use signatures`, () => {
    const club = createClub(name)
    const vale = clubAthlete(club, 'vale')
    vale.xp[name] = 6
    vale.mastery.Finisher = 3
    vale.learned[name] = ['cut-and-finish']
    vale.signature[name] = 'cut-and-finish'
    const active = beginClubFixture(club)
    const old = structuredClone(active)
    old.pending.start.opponentPolicy = 1
    assert.equal(active.pending.start.opponentPolicy, 2)
    const earlierSave = openClubFixture(readClub(JSON.stringify(old)))
    assert.deepEqual(earlierSave.opponent(earlierSave.match, 0), earlier(earlierSave.match, 0, earlierSave.defense))
    const modern = openClubFixture(readClub(JSON.stringify(active)))
    assert.deepEqual(modern.opponent(modern.match, 0), plan(modern.match, 0, modern.defense))
    delete old.pending.start
    assert.equal(upgradeClubFixture(old).pending.start.opponentPolicy, 1)

    const next = beginClubFixture(settleFixture(active, [0, 0], modern.match.athletes))
    const breaker = next.pending.start.match.athletes.find(athlete => athlete.team === 1 && athlete.signature)
    assert.equal(breaker.signature, 'cut-and-finish')
    const away = openClubFixture(readClub(JSON.stringify(next)))
    const rovers = beginClubFixture(settleFixture(next, [0, 0], away.match.athletes))
    assert.equal(rovers.pending.start.match.athletes.find(athlete => athlete.team === 1 && athlete.signature)?.signature,
      'jump-lane')
  })
}
