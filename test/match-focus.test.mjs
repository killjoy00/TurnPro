import assert from 'node:assert/strict'
import test from 'node:test'
import * as basketball from '../src/basketball.ts'
import * as soccer from '../src/soccer.ts'
import * as hockey from '../src/hockey.ts'
import * as football from '../src/football.ts'
import { planTurn as basketballAI } from '../src/opponent.ts'
import { planTurn as soccerAI } from '../src/soccer-opponent.ts'
import { planTurn as hockeyAI } from '../src/hockey-opponent.ts'
import { planTurn as footballAI } from '../src/football-opponent.ts'
import { clubAthlete, createClub, learnSignature, readClub, specialize, trainTechnical } from '../src/club.ts'
import { beginClubFixture, openClubFixture, saveClubTurn } from '../src/club-fixture.ts'
import { creditFocus } from '../src/match-focus.ts'

test('all eight match focuses identify their athlete from a resolved outcome', () => {
  const ball = basketball.createPickAndRollPractice()
  const glass = basketball.createMatch(1, 1)
  const pitch = soccer.createSwitchPractice()
  const tackle = soccer.createPressPractice()
  tackle.randomState = 0
  tackle.holder = '1-8'
  soccer.athleteById(tackle, '1-8').position = { x: 51, y: 7 }
  soccer.athleteById(tackle, '0-8').position = { x: 51, y: 8 }
  const ice = hockey.createBreakoutPractice()
  const timer = hockey.createRushPractice()
  timer.randomState = 1
  const grid = football.createPlayActionPractice()
  const pressure = football.createMatch(0, 1)
  const cases = [
    ['roll-basket', 'Okafor', basketball.resolveTurn(ball, [[
      { athlete: '0-4', kind: 'roll-screen' }, { athlete: '0-0', kind: 'pass', target: '0-4' },
    ], basketballAI(ball, 1)])],
    ['defensive-glass', 'Okafor', basketball.resolveTurn(glass, [[
      { athlete: '0-4', kind: 'protect' }, { athlete: '0-3', kind: 'protect' },
    ], [{ athlete: '1-0', kind: 'shoot' }]])],
    ['wide-switch', 'Vale', soccer.resolveTurn(pitch, [[
      { athlete: '0-10', kind: 'show-wide' }, { athlete: '0-8', kind: 'switch-field', target: '0-10' },
    ], soccerAI(pitch, 1)])],
    ['press-recovery', 'Vale', soccer.resolveTurn(tackle, [[{ athlete: '0-8', kind: 'press' }], []])],
    ['bank-breakout', 'Blake', hockey.resolveTurn(ice, [[
      { athlete: '0-1', kind: 'show-outlet' }, { athlete: '0-3', kind: 'wall-outlet', target: '0-1' },
    ], hockeyAI(ice, 1)])],
    ['screened-goal', 'Vale', hockey.resolveTurn(timer, [[
      { athlete: '0-0', kind: 'pass', target: '0-1' }, { athlete: '0-1', kind: 'one-timer' }, { athlete: '0-2', kind: 'screen' },
    ], hockeyAI(timer, 1)])],
    ['fake-conversion', 'Reed', football.resolveTurn(grid, [[
      { athlete: '0-o-0', kind: 'play-action', target: '0-o-7' }, { athlete: '0-o-7', kind: 'slant' }, { athlete: '0-o-2', kind: 'protect' },
    ], footballAI(grid, 1)])],
    ['blitz-sack', 'Brooks', football.resolveTurn(pressure, [[
      { athlete: '0-d-0', kind: 'blitz' }, { athlete: '0-d-1', kind: 'blitz' },
    ], [{ athlete: '1-o-0', kind: 'deep-pass', target: '1-o-7' }]])],
  ]
  for (const [id, athlete, { events }] of cases) {
    assert.deepEqual(creditFocus({ id }, events), { id, athlete })
    assert.deepEqual(creditFocus({ id }, events.map(event => event.achievement
      ? { ...event, achievement: { ...event.achievement, team: 1 } } : event)), { id })
    assert.deepEqual(creditFocus({ id, athlete: 'First athlete' }, events), { id, athlete: 'First athlete' })
  }
})

test('an earned field lesson survives replay, pays once at the final, and preserves the weekly session', () => {
  let club = beginClubFixture(createClub('football'), 'fake-conversion')
  const start = openClubFixture(club)
  const set = football.setFormation(start.match, 'power')
  const orders = [
    { athlete: '0-o-0', kind: 'play-action', target: '0-o-7' },
    { athlete: '0-o-7', kind: 'slant' }, { athlete: '0-o-2', kind: 'protect' },
  ]
  const opposition = footballAI(set, 1, start.style)
  const first = football.resolveTurn(set, [orders, opposition])
  club = readClub(JSON.stringify(saveClubTurn(club, orders, first.match, 'power', opposition, first.events)))
  assert.deepEqual(club.pending.focus, { id: 'fake-conversion', athlete: 'Reed' })
  assert.equal(clubAthlete(club, 'reed').xp.football, 0)
  assert.deepEqual(openClubFixture(club).match, first.match)
  const invalid = structuredClone(club)
  invalid.pending.focus.athlete = 'Vale'
  assert.throws(() => openClubFixture(readClub(JSON.stringify(invalid))), /does not match/)
  assert.throws(() => beginClubFixture(createClub('football'), 'wide-switch'), /for this sport/)

  let match = first.match
  while (club.pending) {
    const enemy = footballAI(match, 1, start.style)
    const next = football.resolveTurn(match, [[], enemy])
    club = saveClubTurn(club, [], next.match, match.offense === 0 ? match.formation : undefined, enemy, next.events)
    match = next.match
  }
  const saved = readClub(JSON.stringify(club))
  const reed = clubAthlete(saved, 'reed')
  assert.equal(reed.xp.football, 4)
  assert.equal(reed.technical.football.passing, 1)
  assert.equal(reed.technical.hockey.passing, 0)
  const practiced = trainTechnical(saved, 'reed', 'football', 'passing')
  assert.equal(clubAthlete(practiced, 'reed').technical.football.passing, 2)
})

test('the hockey signature changes shot location and the football signature trades depth for protection', () => {
  const iceClub = createClub('hockey')
  const reed = clubAthlete(iceClub, 'reed')
  reed.xp.hockey = 3
  reed.mastery.Playmaker = 3
  const ice = openClubFixture(beginClubFixture(learnSignature(iceClub, 'reed', 'hockey', 'walk-point'))).match
  const skater = hockey.athleteById(ice, '0-0')
  skater.position = { x: 72, y: 20 }
  hockey.athleteById(ice, '1-0').position = { x: 73, y: 21 }
  const walk = { athlete: skater.id, kind: 'walk-point', target: 1 }
  assert.ok(hockey.legalCommands(ice, skater.id).some(order => order.kind === walk.kind && order.target === walk.target))
  assert.ok(hockey.previewShot(ice, walk, []).pressure < hockey.previewShot(ice, { athlete: skater.id, kind: 'shoot' }, []).pressure)
  const result = hockey.resolveTurn(ice, [[walk], []])
  assert.ok(result.events.some(event => /walks the point/.test(event.text)))
  assert.equal(hockey.athleteById(result.match, skater.id).stamina, 83)

  const gridClub = specialize(createClub('football'), 'adeyemi', 'Defender')
  const tightEnd = clubAthlete(gridClub, 'adeyemi')
  tightEnd.xp.football = 3
  tightEnd.mastery.Defender = 3
  const grid = openClubFixture(beginClubFixture(learnSignature(gridClub, 'adeyemi', 'football', 'chip-release'))).match
  const chip = { athlete: '0-o-10', kind: 'chip-release' }
  const pass = { athlete: '0-o-0', kind: 'quick-pass', target: chip.athlete }
  const rush = [{ athlete: '1-d-0', kind: 'blitz' }, { athlete: '1-d-1', kind: 'blitz' }]
  assert.ok(football.legalCommands(grid, chip.athlete).some(order => order.kind === chip.kind))
  const plain = football.playEstimate(grid, pass, [], rush)
  const release = football.playEstimate(grid, pass, [chip], rush)
  const fullProtection = football.playEstimate(grid, pass, [{ athlete: '0-o-2', kind: 'protect' }], rush)
  assert.ok(release.yards < plain.yards && release.sack < plain.sack && release.sack > fullProtection.sack)
  assert.ok(release.factors.includes('short outlet'))
  const snap = football.resolveTurn(grid, [[pass, chip], rush])
  assert.ok(snap.events.some(event => /Chip and release/.test(event.text)))
})
