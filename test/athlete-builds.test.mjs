import assert from 'node:assert/strict'
import test from 'node:test'
import { UNTRAINED } from '../src/athletics.ts'
import { clubAthlete, createClub, equip, equipSignature, learnSignature, ratings, readClub, settleFixture, setStarter, specialize, train, trainTechnical } from '../src/club.ts'
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
  assert.throws(() => learnSignature(specialize(club, 'reed', 'Finisher'), 'reed', 'basketball', 'cut-and-finish'), /cannot be learned/)
  reed.mastery.Finisher = 3
  reed.mastery.Defender = 3
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

test('appearance experience follows the current specialty across sports and eventually makes a passive portable', () => {
  let club = createClub('all')
  const reed = clubAthlete(club, 'reed')
  reed.xp.basketball = 6
  club = equip(club, 'reed', 'basketball', 'thread-pass')
  assert.equal(clubAthlete(specialize(club, 'reed', 'Defender'), 'reed').equipped.basketball, null)
  club = train(club, 'reed', 'basketball')
  assert.equal(clubAthlete(club, 'reed').mastery.Playmaker, 1)

  for (const [sport, slot, orders] of [['basketball', 0, 3], ['soccer', 6, 3], ['hockey', 0, 2]]) {
    const pending = beginClubFixture(club)
    const fixture = openClubFixture(pending)
    assert.equal(fixture.sport, sport)
    club = settleFixture(pending, [1, 0], fixture.match.athletes, [{ slot, stamina: 80, orders }])
  }
  assert.deepEqual(clubAthlete(club, 'reed').mastery, { Playmaker: 6, Defender: 0, Finisher: 0 })
  assert.deepEqual(clubAthlete(club, 'rowan').mastery, { Playmaker: 0, Defender: 0, Finisher: 0 })
  club = specialize(club, 'reed', 'Defender')
  assert.equal(clubAthlete(club, 'reed').equipped.basketball, 'thread-pass')
  assert.throws(() => equip(club, 'reed', 'soccer', 'thread-pass'), /locked/)
  club = beginClubFixture(club)
  club = settleFixture(club, [0, 0], openClubFixture(club).match.athletes, [{ slot: 0, stamina: 80, orders: 0 }])
  assert.equal(clubAthlete(club, 'reed').mastery.Defender, 1)
  assert.deepEqual(readClub(JSON.stringify(club)), club)
})

test('weekly drills improve only the selected skill and sport in each match engine', () => {
  for (const sport of SPORTS) {
    const fresh = createClub(sport)
    assert.throws(() => trainTechnical(fresh, 'reed', sport, 'finishing'), /unavailable/)
    clubAthlete(fresh, 'reed').xp[sport] = 3
    const before = openClubFixture(beginClubFixture(fresh)).match.athletes.find(athlete => athlete.team === 0 && athlete.name === 'Reed')
    const trained = trainTechnical(fresh, 'reed', sport, 'finishing')
    assert.equal(clubAthlete(trained, 'reed').xp[sport], 4)
    assert.throws(() => train(trained, 'reed', 'speed'), /used this week/)
    const match = openClubFixture(beginClubFixture(readClub(JSON.stringify(trained)))).match
    const athlete = match.athletes.find(athlete => athlete.team === 0 && athlete.name === 'Reed')
    const rating = sport === 'basketball' ? 'shooting' : 'finishing'
    assert.equal(athlete[rating], before[rating] + 1)
    assert.equal(athlete.passing, before.passing)
    const drillPlayer = clubAthlete(trained, 'reed')
    for (const other of SPORTS.filter(played => played !== sport)) {
      assert.deepEqual(ratings(drillPlayer, other), ratings(clubAthlete(fresh, 'reed'), other))
    }
    drillPlayer.technical[sport].finishing = 3
    assert.throws(() => readClub(JSON.stringify(trained)), /roster/)
  }
})

test('a relay lets three coordinated orders produce two completed passes and a shot', () => {
  for (const data of [
    { engine: basketball, match: basketball.createMatch(0), relayId: '0-1', finisher: '0-3', seed: 0 },
    { engine: soccer, match: soccer.createCrossingPractice(), relayId: '0-6', finisher: '0-9', seed: 8 },
  ]) {
    const { engine, match, relayId, finisher, seed } = data
    match.randomState = seed
    const first = { athlete: match.holder, kind: 'pass', target: relayId }
    const relay = { athlete: relayId, kind: 'relay', target: finisher }
    const cut = { athlete: finisher, kind: 'cut-and-finish', target: 0 }
    engine.athleteById(match, finisher).signature = 'cut-and-finish'
    assert.throws(() => engine.resolveTurn(match, [[first, relay, cut], []]), /unavailable/)
    engine.athleteById(match, relayId).signature = 'relay'
    const withoutRelay = engine.resolveTurn(match, [[first, cut], []])
    assert.equal(withoutRelay.match.holder, relayId)
    assert.deepEqual(withoutRelay.match.score, [0, 0])
    const plan = [first, relay, cut]
    const combined = engine.resolveTurn(match, [plan, []])
    const events = combined.events.map(event => event.text)
    assert.ok(events.findIndex(line => /relays the ball/.test(line)) > 2)
    assert.ok(events.findIndex(line => /cuts.*shoots/.test(line)) > events.findIndex(line => /relays the ball/.test(line)))
    assert.ok(combined.match.score[0] > 0)
    assert.deepEqual(engine.resolveTurn(JSON.parse(JSON.stringify(match)), [plan, []]), combined)
    assert.equal(engine.athleteById(combined.match, relayId).stamina, 100 - engine.ACTIONS.relay.stamina)
  }
})

test('v6 saves credit already learned signatures and preserve in-progress turns', () => {
  const fresh = createClub('basketball')
  const vale = clubAthlete(fresh, 'vale')
  vale.xp.basketball = 3
  vale.mastery.Finisher = 3
  let club = beginClubFixture(learnSignature(fresh, vale.id, 'basketball', 'cut-and-finish'))
  const session = openClubFixture(club)
  const orders = [{ athlete: '0-0', kind: 'pass', target: '0-1' }, { athlete: '0-1', kind: 'cut-and-finish', target: 0 }]
  const played = basketball.resolveTurn(session.match, [orders, basketballAI(session.match, 1, session.defense)])
  club = saveClubTurn(club, orders, played.match)
  const old = { ...club, version: 6, roster: club.roster.map(({ mastery, technical, ...player }) => player) }
  const migrated = readClub(JSON.stringify(old))
  assert.deepEqual(migrated, club)
  assert.deepEqual(openClubFixture(migrated).match, played.match)
})
