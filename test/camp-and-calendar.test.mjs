import assert from 'node:assert/strict'
import test from 'node:test'
import {
  campSessions, chooseMasteryBranch, clubAthlete, createClub, equip, fixtureLineup, learnSignature, nextFixture,
  ratings, readClub, recruit, setFixturePriority, setStarter, settleFixture, specialize, train, trainTechnical,
} from '../src/club.ts'
import { beginClubFixture, openClubFixture, saveClubTurn } from '../src/club-fixture.ts'
import { cupTrophies, leagueTable, seasonCalendar } from '../src/league.ts'
import * as basketball from '../src/basketball.ts'

const reload = club => readClub(JSON.stringify(club))

function finish(club, score = [1, 0]) {
  const active = beginClubFixture(club)
  return settleFixture(active, score, openClubFixture(active).match.athletes)
}

test('two weekly sessions share one budget across drills, lessons, and recovery', () => {
  let club = createClub('all')
  const vale = clubAthlete(club, 'vale')
  vale.xp.basketball = 3
  vale.mastery.Finisher = 3
  clubAthlete(club, 'shaw').fatigue = 38
  club = learnSignature(club, 'vale', 'basketball', 'cut-and-finish')
  club = reload(train(club, 'shaw', 'recovery'))
  assert.equal(clubAthlete(club, 'shaw').fatigue, 10)
  assert.deepEqual(campSessions(club).map(session => session.kind), ['lesson', 'training'])
  assert.throws(() => trainTechnical(club, 'vale', 'basketball', 'finishing'), /Both camp sessions/)
  club = finish(finish(club))
  assert.equal(nextFixture(club).stage, 'cup')
  assert.equal(campSessions(club).length, 2)
  club = finish(club)
  assert.equal(nextFixture(club).week, 2)
  assert.deepEqual(campSessions(club), [])
  club = trainTechnical(club, 'vale', 'basketball', 'finishing')
  assert.throws(() => trainTechnical(club, 'vale', 'basketball', 'finishing'), /already used/)
  assert.equal(train(club, 'vale', 'speed').camp.sessions.length, 2)
})

test('mastery picks unlock a distinct portable passive and keep the single passive slot', () => {
  let club = createClub('all')
  const reed = clubAthlete(club, 'reed')
  assert.throws(() => chooseMasteryBranch(club, 'reed', 'thread-pass'), /unavailable/)
  reed.mastery.Playmaker = 6
  assert.throws(() => chooseMasteryBranch(club, 'reed', 'clean-look'), /unavailable/)
  const distributor = chooseMasteryBranch(club, 'reed', 'thread-pass')
  const conditioner = chooseMasteryBranch(club, 'reed', 'second-wind')
  assert.throws(() => chooseMasteryBranch(distributor, 'reed', 'second-wind'), /unavailable/)
  assert.throws(() => equip(conditioner, 'reed', 'soccer', 'thread-pass'), /locked/)
  club = reload(equip(specialize(distributor, 'reed', 'Defender'), 'reed', 'soccer', 'thread-pass'))
  assert.equal(ratings(clubAthlete(club, 'reed'), 'soccer').technique, 'thread-pass')
  assert.equal(clubAthlete(club, 'reed').xp.soccer, 0)
  assert.equal(clubAthlete(club, 'reed').technical.soccer.passing, 0)
  assert.equal(campSessions(club).length, 0)
})

test('prioritized athletes rest from intervening lineups and return for the cup', () => {
  const club = createClub('all')
  clubAthlete(club, 'vale').fatigue = 60
  const originalLineups = structuredClone(club.lineups)
  const priority = reload(setFixturePriority(club, 'vale', 2))
  const lineup = fixtureLineup(priority, nextFixture(priority))
  assert.equal(lineup.rotation.out, 'vale')
  assert.throws(() => setStarter(priority, 'soccer', 8, 'rowan'), /target fixture/)
  const started = beginClubFixture(priority)
  const session = openClubFixture(started)
  assert.deepEqual(started.pending.start.starters, lineup.starters)
  const opponent = session.opponent(session.match, 1)
  const turn = basketball.resolveTurn(session.match, [[], opponent])
  const saved = reload(saveClubTurn(started, [], turn.match, undefined, opponent))
  assert.deepEqual(openClubFixture(saved).match, turn.match)
  let after = settleFixture(saved, [2, 0], turn.match.athletes)
  assert.equal(clubAthlete(after, 'vale').fatigue, 40)
  assert.equal(clubAthlete(after, 'vale').xp.basketball, 0)
  assert.equal(clubAthlete(after, lineup.rotation.in).xp.basketball, 1)
  assert.ok(!fixtureLineup(after, nextFixture(after)).starters.includes('vale'))
  after = reload(finish(after))
  assert.equal(clubAthlete(after, 'vale').fatigue, 20)
  assert.ok(fixtureLineup(after, nextFixture(after)).starters.includes('vale'))
  const beforeCup = leagueTable(after, 1)
  assert.deepEqual(cupTrophies(finish(after, [1, 1])), [])
  after = reload(finish(after, [2, 0]))
  assert.deepEqual(after.lineups, originalLineups)
  assert.deepEqual(leagueTable(after, 1), beforeCup)
  assert.deepEqual(cupTrophies(after), ['soccer'])
  assert.equal(after.priority, null)
})

test('protected players need an eligible replacement in every intervening lineup', () => {
  let club = finish(finish(finish(createClub('all'))))
  assert.equal(nextFixture(club).sport, 'hockey')
  assert.throws(() => setFixturePriority(club, 'shaw', 5), /no eligible reserve/)
  club = recruit(club, 'imani')
  club = setFixturePriority(club, 'shaw', 5)
  assert.equal(fixtureLineup(club, nextFixture(club)).starters[10], 'imani')
})

test('earlier all-sport saves preserve their schedule, current plans, and one spent session', () => {
  const { calendar, camp, priority, ...classic } = createClub('all')
  const active = beginClubFixture(classic)
  const session = openClubFixture(active)
  const reply = session.opponent(session.match, 1)
  const turn = basketball.resolveTurn(session.match, [[], reply])
  const committed = saveClubTurn(active, [], turn.match, undefined, reply)
  const { camp: ignored, priority: unplanned, ...saved } = committed
  const previous = { ...saved, version: 7, trainedWeek: 1, roster: saved.roster.map(({ branches, ...player }) => player) }
  const migrated = reload(previous)
  assert.equal(migrated.version, 8)
  assert.equal(seasonCalendar(migrated).length, 12)
  assert.deepEqual(campSessions(migrated), [{ kind: 'legacy' }])
  assert.deepEqual(openClubFixture(migrated).match, turn.match)
  const rested = settleFixture(migrated, [1, 0], turn.match.athletes)
  assert.equal(train(rested, 'reed', 'film').camp.sessions.length, 2)
})

test('save validation rejects duplicate camp activities and priorities outside the current week', () => {
  const club = train(createClub('all'), 'reed', 'film')
  assert.throws(() => reload({ ...club, camp: { week: 1, sessions: [...club.camp.sessions, ...club.camp.sessions] } }),
    /training camp/)
  assert.throws(() => reload({ ...club, priority: { athlete: 'vale', fixture: 5 } }), /fixture priority/)
})
