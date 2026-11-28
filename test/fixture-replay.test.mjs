import assert from 'node:assert/strict'
import test from 'node:test'
import * as basketball from '../src/basketball.ts'
import * as soccer from '../src/soccer.ts'
import * as hockey from '../src/hockey.ts'
import * as football from '../src/football.ts'
import { clubAthlete, createClub, physicalProfile, profile, readClub } from '../src/club.ts'
import { beginClubFixture, openClubFixture, saveClubTurn, upgradeClubFixture } from '../src/club-fixture.ts'
import { RIVALS, SPORTS } from '../src/league.ts'

const engines = { basketball, soccer, hockey, football }
const otherStyles = { basketball: 'stay', soccer: 'compact', hockey: 'slot', football: 'shell' }
const load = club => readClub(JSON.stringify(club))

for (const sport of SPORTS) {
  test(`${sport} reopens committed turns after the default athlete profile and opponent policy change`, () => {
    const club = beginClubFixture(createClub(sport))
    const { match, opponent } = openClubFixture(club)
    const formation = sport === 'football' ? 'spread' : undefined
    const setup = formation ? football.setFormation(match, formation) : match
    const stockReply = opponent(setup, 1)
    const orders = engines[sport].legalCommands(setup, setup.holder).slice(0, 1)
    const resolved = engines[sport].resolveTurn(setup, [orders, []])
    assert.ok(stockReply.length > 0)
    assert.notDeepEqual(engines[sport].resolveTurn(setup, [orders, stockReply]).events, resolved.events)
    const saved = saveClubTurn(club, orders, resolved.match, formation, [])
    const pristine = structuredClone(saved.pending.start)

    const rival = RIVALS[0]
    const previousStyle = rival[sport]
    const athlete = profile('reed')
    const previousProfile = { ...athlete }
    try {
      rival[sport] = otherStyles[sport]
      Object.assign(athlete, { name: 'Reed New', awareness: 4, basketball: 0, soccer: 0, naturalTrait: 'strength' })
      const fresh = openClubFixture(beginClubFixture(createClub(sport)))
      assert.ok(fresh.match.athletes.some(player => player.name === 'Reed New'))
      if (sport === 'basketball') assert.equal(fresh.defense, otherStyles[sport])
      else if (sport === 'soccer') assert.equal(fresh.match.shapes[1], otherStyles[sport])
      else assert.equal(fresh.style, otherStyles[sport])

      const restored = load(saved)
      const resumed = openClubFixture(restored)
      assert.deepEqual(restored.pending.start, pristine)
      assert.deepEqual(resumed.match, resolved.match)
      assert.deepEqual(resumed.history[0].events, resolved.events)
      assert.deepEqual(restored.pending.opponentPlans, [[]])
      assert.deepEqual(resumed.opponent(setup, 1), stockReply)
      resumed.match.athletes[0].position.x += 1
      assert.deepEqual(openClubFixture(restored).match, resolved.match)
    } finally {
      rival[sport] = previousStyle
      Object.assign(athlete, previousProfile)
    }
  })

  test(`${sport} backfills missing legacy opponent orders and preserves an explicitly empty reply`, () => {
    const club = beginClubFixture(createClub(sport))
    const { start, ...pending } = club.pending
    const legacy = load({ ...club, pending: {
      ...pending, turns: [[], []], opponentPlans: [null, []],
      athletics: start.starters.map(id => physicalProfile(clubAthlete(club, id))),
    } })
    const before = openClubFixture(legacy)
    const upgraded = upgradeClubFixture(legacy)
    assert.deepEqual(upgraded.pending.start, { ...start, opponentPolicy: 1 })
    assert.deepEqual(upgraded.pending.opponentPlans, [openClubFixture(club).opponent(start.match, 1), []])
    assert.equal(upgradeClubFixture(upgraded), upgraded)
    const after = openClubFixture(load(upgraded))
    assert.deepEqual(after.match, before.match)
    assert.deepEqual(after.history, before.history)
  })
}

test('fixture imports reject invalid versions, opening states, and incomplete recordings', () => {
  const club = beginClubFixture(createClub('hockey'))
  const { match, opponent } = openClubFixture(club)
  const reply = opponent(match, 1)
  const saved = saveClubTurn(club, [], hockey.resolveTurn(match, [[], reply]).match, undefined, reply)
  for (const corrupt of [
    pending => { pending.start.version++ },
    pending => { pending.start.opponentPolicy++ },
    pending => { pending.start.match.seed++ },
    pending => { pending.start.match.club.lineup[6].name = '<img src=x>' },
    pending => { pending.opponentPlans[0] = null },
  ]) {
    const bad = structuredClone(saved)
    corrupt(bad.pending)
    assert.throws(() => load(bad), /current fixture/)
  }
})
