import assert from 'node:assert/strict'
import test from 'node:test'
import { UNTRAINED } from '../src/athletics.ts'
import { clubAthlete, createClub, equip, equipSignature, learnSignature, ratings, readClub, settleFixture, setStarter, specialize, train } from '../src/club.ts'
import { beginClubFixture, openClubFixture, saveClubTurn } from '../src/club-fixture.ts'
import { SPORTS } from '../src/league.ts'
import * as basketball from '../src/basketball.ts'
import * as soccer from '../src/soccer.ts'
import * as hockey from '../src/hockey.ts'
import * as football from '../src/football.ts'
import { planTurn as basketballAI } from '../src/opponent.ts'
import { planTurn as footballAI } from '../src/football-opponent.ts'

test('shared athletic training uses a weekly session and talents unlock per sport', () => {
  let club = train(createClub('all'), 'reed', 'speed')
  assert.throws(() => train(club, 'reed', 'composure'), /used this week/)
  assert.throws(() => equip(club, 'reed', 'soccer', 'quick-step'), /locked/)
  clubAthlete(club, 'reed').xp.soccer = 3
  club = equip(club, 'reed', 'soccer', 'quick-step')
  assert.throws(() => equip(club, 'reed', 'hockey', 'quick-step'), /locked/)
  const player = clubAthlete(readClub(JSON.stringify(club)), 'reed')
  for (const sport of SPORTS) assert.equal(ratings(player, sport).athletics.speed, 1)
  assert.equal(ratings(player, 'soccer').technique, 'quick-step')
  assert.equal(ratings(player, 'basketball').technique, undefined)
})

test('role practice boosts only the roles and sports played', () => {
  let club = createClub('basketball')
  const trimmed = (player, sport, slot) => [ratings(player, sport, slot).passing, ratings(player, sport, slot).finishing]
  for (let i = 0; i < 4; i++) {
    if (i === 1) club = setStarter(club, 'basketball', 1, 'reed')
    if (i === 2) club = setStarter(club, 'basketball', 0, 'reed')
    club = beginClubFixture(club)
    const match = openClubFixture(club).match
    club = settleFixture(club, [2, 0], match.athletes)
  }
  const reed = clubAthlete(club, 'reed')
  assert.deepEqual(reed.roleStarts.basketball, { PG: 3, SG: 1 })
  assert.deepEqual(reed.roleStarts.hockey, {})
  assert.equal(trimmed(reed, 'basketball', 0)[0], trimmed(reed, 'basketball', 1)[0] + 1)
  assert.deepEqual(trimmed(reed, 'soccer', 6), trimmed(reed, 'soccer', 8))
  assert.equal(clubAthlete(club, 'rowan').roleStarts.basketball.PG, undefined)
})

test('endurance changes actual unassigned recovery in all four match engines', () => {
  for (const [sport, engine] of Object.entries({ basketball, soccer, hockey, football })) {
    const session = openClubFixture(beginClubFixture(createClub(sport)))
    const baseline = session.match
    const trained = structuredClone(baseline)
    const first = baseline.athletes[0]
    first.stamina = 65
    trained.athletes[0].stamina = 65
    trained.athletes[0].athletics = { ...UNTRAINED, endurance: 2 }
    const original = engine.resolveTurn(baseline, [[], []]).match.athletes.find(player => player.id === first.id)
    const fitter = engine.resolveTurn(trained, [[], []]).match.athletes.find(player => player.id === first.id)
    assert.equal(fitter.stamina, original.stamina + 4, sport)
  }
})

test('Quick step changes ordered routes and worn-out athletes lose the burst', () => {
  const match = soccer.createPressPractice()
  const athlete = soccer.athleteById(match, '0-9')
  athlete.stamina = 70
  athlete.athletics = { ...UNTRAINED, speed: 1 }
  const ordinary = soccer.runDestination(match, athlete, 1)
  athlete.technique = 'quick-step'
  assert.ok(soccer.runDestination(match, athlete, 1).x > ordinary.x)
  athlete.stamina = 45
  const tired = soccer.runDestination(match, athlete, 1)
  delete athlete.technique
  assert.deepEqual(soccer.runDestination(match, athlete, 1), tired)

  const gridiron = football.createThirdDownPractice()
  const receiver = gridiron.athletes.find(player => player.id === '0-o-7')
  const pass = { athlete: '0-o-0', kind: 'quick-pass', target: receiver.id }
  const route = { athlete: receiver.id, kind: 'slant' }
  const expected = football.playEstimate(gridiron, pass, [route]).yards
  receiver.athletics = { ...UNTRAINED, speed: 1 }
  receiver.technique = 'quick-step'
  assert.equal(football.playEstimate(gridiron, pass, [route]).yards, expected + 3)
})

test('composure improves a tired shot and Anchor helps a runner through contact', () => {
  const match = basketball.createMatch(2)
  const shooter = basketball.athleteById(match, '0-0')
  shooter.stamina = 30
  const tired = basketball.shotEstimate(match, shooter).chance
  shooter.athletics = { ...UNTRAINED, composure: 2 }
  assert.ok(basketball.shotEstimate(match, shooter).chance > tired)

  const gridiron = football.createMatch(2)
  const runner = gridiron.athletes.find(player => player.id === '0-o-1')
  runner.athletics = { ...UNTRAINED, strength: 1 }
  const run = { athlete: '0-o-0', kind: 'inside' }
  const yards = football.playEstimate(gridiron, run, []).yards
  runner.technique = 'anchor'
  assert.ok(football.playEstimate(gridiron, run, []).yards > yards)
})

test('football club saves replay a changed formation and its public counterplay', () => {
  const club = beginClubFixture(createClub('football'))
  const session = openClubFixture(club)
  const set = football.setFormation(session.match, 'spread')
  const result = football.resolveTurn(set, [[], footballAI(set, 1, session.style)])
  const saved = readClub(JSON.stringify(saveClubTurn(club, [], result.match, 'spread')))
  const resumed = openClubFixture(saved)
  assert.deepEqual(saved.pending.formations, ['spread'])
  assert.deepEqual(resumed.match, result.match)
  assert.deepEqual(resumed.history[0].events, result.events)
  assert.match(resumed.history[0].events.map(event => event.text).join(' '), /line up in Spread/)
  assert.throws(() => readClub(JSON.stringify({ ...saved, pending: { ...saved.pending, formations: [] } })), /current fixture/)
})

test('v4 club saves initialize new training and positions with their fixture intact', () => {
  const original = beginClubFixture(createClub('all'))
  const old = { ...original, version: 4, roster: original.roster.map(({ athletics, roleStarts, ...player }) => player) }
  const migrated = readClub(JSON.stringify(old))
  assert.deepEqual(migrated, original)
  assert.deepEqual(openClubFixture(migrated), openClubFixture(original))
})

test('the same athlete can apprentice in two specialties and swap learned signatures beside a passive', () => {
  let club = createClub('all')
  const reed = clubAthlete(club, 'reed')
  assert.throws(() => equipSignature(club, 'reed', 'basketball', 'cut-and-finish'), /before equipping/)
  assert.throws(() => learnSignature(club, 'reed', 'basketball', 'cut-and-finish'), /cannot be learned/)
  reed.xp.basketball = 3
  reed.xp.soccer = 3
  club = equip(club, 'reed', 'basketball', 'second-wind')
  club = specialize(club, 'reed', 'Finisher')
  club = learnSignature(club, 'reed', 'basketball', 'cut-and-finish')
  assert.throws(() => train(club, 'reed', 'speed'), /used this week/)
  assert.throws(() => equipSignature(club, 'reed', 'soccer', 'cut-and-finish'), /before equipping/)
  assert.equal(ratings(clubAthlete(club, 'reed'), 'basketball').signature, 'cut-and-finish')

  for (const score of [[2, 0], [1, 0]]) {
    club = beginClubFixture(club)
    assert.throws(() => equipSignature(club, 'reed', 'basketball', null), /current fixture/)
    club = settleFixture(club, score, openClubFixture(club).match.athletes)
  }
  club = specialize(club, 'reed', 'Defender')
  club = learnSignature(club, 'reed', 'basketball', 'jump-lane')
  assert.equal(ratings(clubAthlete(club, 'reed'), 'basketball').signature, 'cut-and-finish')
  club = equipSignature(club, 'reed', 'basketball', 'jump-lane')
  const saved = readClub(JSON.stringify(club))
  assert.deepEqual(clubAthlete(saved, 'reed').learned.basketball, ['cut-and-finish', 'jump-lane'])
  assert.equal(ratings(clubAthlete(saved, 'reed'), 'basketball').signature, 'jump-lane')
  assert.equal(ratings(clubAthlete(saved, 'reed'), 'basketball').technique, 'second-wind')
  assert.equal(ratings(clubAthlete(saved, 'reed'), 'soccer').signature, undefined)

  const invalid = structuredClone(saved)
  clubAthlete(invalid, 'reed').signature.hockey = 'jump-lane'
  assert.throws(() => readClub(JSON.stringify(invalid)), /roster/)
  clubAthlete(saved, 'reed').learned.basketball = []
  assert.throws(() => readClub(JSON.stringify(saved)), /roster/)
})

test('a cut and finish unlocks a scoring sequence from an off-ball order in basketball and soccer', () => {
  for (const { engine, match, passer, receiver, base } of [
    { engine: basketball, match: basketball.createMatch(0), passer: '0-0', receiver: '0-1', base: 'cut' },
    { engine: soccer, match: soccer.createCrossingPractice(), passer: '0-8', receiver: '0-9', base: 'run' },
  ]) {
    if (engine === soccer) match.randomState = 1
    const pass = { athlete: passer, kind: 'pass', target: receiver }
    const cut = { athlete: receiver, kind: base, target: 0 }
    const combined = { ...cut, kind: 'cut-and-finish' }
    const standard = engine.resolveTurn(match, [[pass, cut], []])
    assert.equal(standard.match.holder, receiver)
    assert.equal(standard.match.score[0], 0)
    assert.throws(() => engine.resolveTurn(match, [[pass, combined], []]), /unavailable/)

    const runner = engine.athleteById(match, receiver)
    runner.signature = 'cut-and-finish'
    const noPass = engine.resolveTurn(match, [[combined], []])
    assert.equal(noPass.match.score[0], 0)
    const trained = engine.resolveTurn(match, [[pass, combined], []])
    assert.ok(trained.events.some(event => /cuts.*shoots/.test(event.text)))
    assert.ok(trained.match.score[0] > 0)
    assert.deepEqual(engine.resolveTurn(JSON.parse(JSON.stringify(match)), [[pass, combined], []]), trained)

    runner.stamina = 15
    assert.ok(!engine.legalCommands(match, runner.id).some(order => order.kind === 'cut-and-finish'))
  }
})

test('an unassigned lane reader changes a completed pass into a turnover at a stamina cost', () => {
  for (const { engine, match, passer, target, defender, assignment } of [
    { engine: basketball, match: basketball.createMatch(1), passer: '0-0', target: '0-3',
      defender: '1-2', assignment: 'stay' },
    { engine: soccer, match: soccer.createCrossingPractice(), passer: '0-8', target: '0-6',
      defender: '1-9', assignment: 'hold' },
  ]) {
    match.randomState = 1
    const pass = { athlete: passer, kind: 'pass', target }
    assert.equal(engine.resolveTurn(match, [[pass], []]).match.holder, target)
    const reader = engine.athleteById(match, defender)
    reader.signature = 'jump-lane'
    const reaction = engine.resolveTurn(match, [[pass], []])
    assert.ok(reaction.events.some(event => /jumps the passing lane/.test(event.text)))
    assert.ok(reaction.events.some(event => event.kind === 'turnover'))
    assert.equal(engine.athleteById(reaction.match, defender).stamina, 92)
    const ordered = engine.resolveTurn(match, [[pass], [{ athlete: defender, kind: assignment }]])
    assert.ok(!ordered.events.some(event => /jumps the passing lane/.test(event.text)))
    const noPass = engine.resolveTurn(match, [[], []])
    assert.deepEqual(engine.athleteById(noPass.match, defender).stamina, 100)
  }
})

test('v5 pending fixtures retain prior ratings, plans, and outcomes after signature migration', () => {
  const club = beginClubFixture(createClub('basketball'))
  const session = openClubFixture(club)
  const win = basketball.resolveTurn(session.match, [[], basketballAI(session.match, 1, session.defense)])
  const saved = saveClubTurn(club, [], win.match)
  const old = { ...saved, version: 5, roster: saved.roster.map(({ learned, signature, ...player }) => player) }
  const migrated = readClub(JSON.stringify(old))
  assert.deepEqual(migrated, saved)
  assert.deepEqual(openClubFixture(migrated), openClubFixture(saved))
})
