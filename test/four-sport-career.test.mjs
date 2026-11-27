import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clubAthlete, createClub, equip, nextFixture, nextSeason, ratings, readClub, recruit, setStarter, train,
} from '../src/club.ts'
import { beginClubFixture, openClubFixture, saveClubTurn } from '../src/club-fixture.ts'
import { leagueTable, schedule, seasonOutcome, seasonSchedule, SPORTS, TURN_LIMITS } from '../src/league.ts'
import * as basketball from '../src/basketball.ts'
import * as soccer from '../src/soccer.ts'
import * as hockey from '../src/hockey.ts'
import * as football from '../src/football.ts'
import { planTurn as basketballAI } from '../src/opponent.ts'
import { planTurn as soccerAI } from '../src/soccer-opponent.ts'
import { planTurn as hockeyAI } from '../src/hockey-opponent.ts'
import { planTurn as footballAI } from '../src/football-opponent.ts'

test('film transfers across sports while weekly technique practice and recovery remain distinct choices', () => {
  const original = createClub('all')
  const film = train(original, 'reed', 'film')
  assert.throws(() => train(film, 'reed', 'hockey'), /used this week/)
  for (const sport of SPORTS) {
    assert.equal(ratings(clubAthlete(film, 'reed'), sport).awareness, 10)
    assert.equal(clubAthlete(film, 'reed').xp[sport], 0)
  }
  const trained = train(original, 'reed', 'football')
  assert.equal(ratings(clubAthlete(trained, 'reed'), 'football').passing,
    ratings(clubAthlete(original, 'reed'), 'football').passing + 1)
  assert.deepEqual(ratings(clubAthlete(trained, 'reed'), 'hockey'), ratings(clubAthlete(original, 'reed'), 'hockey'))
  clubAthlete(original, 'reed').fatigue = 43
  const recovered = train(original, 'reed', 'recovery')
  assert.equal(clubAthlete(recovered, 'reed').fatigue, 15)
  assert.equal(clubAthlete(recovered, 'reed').film, 0)
  assert.throws(() => train(recovered, 'reed', 'film'), /used this week/)
})

test('hockey line changes use club reserves and only credit players after they take the ice', () => {
  let club = recruit(createClub('hockey'), 'imani')
  assert.throws(() => setStarter(club, 'hockey', 10, 'reed'), /goalkeeper/)
  club = setStarter(club, 'hockey', 10, 'imani')
  const lineup = club.lineups.hockey.map(id => ratings(clubAthlete(club, id), 'hockey'))
  let match = hockey.createMatch(2100, 1, lineup)
  assert.equal(hockey.athleteById(match, '0-5').name, 'Imani')
  match = hockey.resolveTurn(match, [[{ athlete: '0-5', kind: 'change' }], []]).match
  assert.equal(hockey.athleteById(match, '0-0').name, 'Rowan')
  assert.deepEqual(hockey.clubAppearances(match).map(appearance => appearance.slot), [0, 1, 2, 3, 4, 10])
  match = hockey.resolveTurn(match, [[], []]).match
  assert.equal(hockey.clubAppearances(match).length, 11)
  assert.equal(hockey.clubAppearances(match).find(appearance => appearance.slot === 10).orders, 1)
})

test('football athletes retain role, fatigue, and ability when changing units', () => {
  let club = setStarter(createClub('football'), 'football', 0, 'vale')
  const player = clubAthlete(club, 'vale')
  player.xp.football = 6
  player.fatigue = 26
  club = equip(club, 'vale', 'football', 'clean-look')
  let match = openClubFixture(beginClubFixture(club)).match
  assert.equal(match.athletes[0].name, 'Vale')
  assert.equal(match.athletes[0].stamina, 74)
  match.down = 4
  match = football.resolveTurn(match, [[{ athlete: '0-o-0', kind: 'punt' }], []]).match
  assert.equal(match.offense, 1)
  const safety = match.athletes.find(athlete => athlete.id === '0-d-9')
  assert.deepEqual([safety.name, safety.stamina, safety.technique], ['Vale', 73, 'clean-look'])
  assert.deepEqual(football.clubAppearances(match)[0], { slot: 0, stamina: 73, orders: 1 })
})

test('rival styles counter different plays and follow the shared budget', () => {
  const ice = hockey.createMatch(3)
  assert.ok(hockeyAI(ice, 1, 'pressure').filter(order => order.kind === 'forecheck').length
    > hockeyAI(ice, 1, 'slot').filter(order => order.kind === 'forecheck').length)
  const gridiron = football.createMatch(3)
  assert.equal(footballAI(gridiron, 1, 'pressure').filter(order => order.kind === 'blitz').length, 2)
  assert.equal(footballAI(gridiron, 1, 'shell').filter(order => order.kind === 'cover-deep').length, 2)
})

function playFixture(club) {
  const fixture = nextFixture(club)
  let active = beginClubFixture(club)
  const session = openClubFixture(active)
  const resolve = { basketball: basketball.resolveTurn, soccer: soccer.resolveTurn,
    hockey: hockey.resolveTurn, football: football.resolveTurn }[session.sport]
  const opponent = { basketball: basketballAI, soccer: soccerAI, hockey: hockeyAI, football: footballAI }[session.sport]
  let match = session.match
  for (let i = 0; i < TURN_LIMITS[fixture.sport]; i++) {
    const orders = opponent(match, 0)
    const reply = session.opponent(match, 1)
    const result = resolve(match, [orders, reply])
    active = saveClubTurn(active, orders, result.match, undefined, reply)
    match = result.match
    if (i === 0) {
      active = readClub(JSON.stringify(active))
      const resumed = openClubFixture(active)
      assert.deepEqual(resumed.match, match)
      assert.deepEqual(resumed.history[0].events, result.events)
    }
  }
  assert.equal(active.pending, null)
  return active
}

test('a four-sport season plays all 12 regular fixtures, then a qualifying club plays four final legs', () => {
  let club = train(createClub('all'), 'reed', 'film')
  assert.deepEqual(schedule('all').map(fixture => fixture.week), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6])
  for (let i = 0; i < 12; i++) {
    assert.equal(nextFixture(club).sport, SPORTS[i % 4])
    club = playFixture(club)
  }
  assert.ok(leagueTable(club, 1).every(row => row.played === 12))
  assert.ok(SPORTS.every(sport => clubAthlete(club, 'reed').xp[sport] >= 3))
  assert.deepEqual(readClub(JSON.stringify(club)), club)

  const finalist = { ...club, results: schedule('all').map(() => [2, 0]) }
  assert.deepEqual(seasonSchedule(finalist, 1).slice(12).map(fixture => fixture.sport), SPORTS)
  let completed = finalist
  while (nextFixture(completed)) completed = playFixture(completed)
  assert.equal(completed.results.length, 16)
  assert.ok(['Champion', 'Runner-up'].includes(seasonOutcome(completed, 1)))
  const newSeason = nextSeason(readClub(JSON.stringify(completed)), 'hockey')
  assert.equal(newSeason.history[0].mode, 'all')
  assert.equal(clubAthlete(newSeason, 'reed').film, 1)
  assert.deepEqual(readClub(JSON.stringify(newSeason)), newSeason)
})

test('a version 3 club resumes the same saved fixture with new development initialized', () => {
  let club = beginClubFixture(createClub('both'))
  const session = openClubFixture(club)
  const result = basketball.resolveTurn(session.match, [[], basketballAI(session.match, 1, session.defense)])
  club = saveClubTurn(club, [], result.match, undefined, session.opponent(session.match, 1))
  const { basketball: basketballLine, soccer: soccerLine } = club.lineups
  const oldSave = {
    ...club, version: 3, lineups: { basketball: basketballLine, soccer: soccerLine },
    roster: club.roster.map(({ film, xp, equipped, ...player }) => ({
      ...player, xp: { basketball: xp.basketball, soccer: xp.soccer },
      equipped: { basketball: equipped.basketball, soccer: equipped.soccer },
    })),
  }
  const migrated = readClub(JSON.stringify(oldSave))
  assert.equal(migrated.version, 7)
  assert.deepEqual(openClubFixture(migrated).history, openClubFixture(club).history)
  assert.deepEqual(openClubFixture(migrated).match, openClubFixture(club).match)
  assert.deepEqual(migrated, club)
})

test('in-progress soccer and football fixtures retain their previous rules after tuning', () => {
  for (const [sport, rules, opponent] of [['soccer', soccer, soccerAI], ['football', football, footballAI]]) {
    const club = beginClubFixture(createClub(sport))
    delete club.pending.start
    club.pending.rules = rules.PREVIOUS_RULES_VERSION
    const session = openClubFixture(club)
    const plan = opponent(session.match, 0)
    const reply = session.opponent(session.match, 1)
    const played = rules.resolveTurn(session.match, [plan, reply])
    const resumed = openClubFixture(readClub(JSON.stringify(saveClubTurn(club, plan, played.match, undefined, reply))))
    assert.equal(resumed.match.rulesVersion, rules.PREVIOUS_RULES_VERSION)
    assert.deepEqual(resumed.match, played.match)
    assert.deepEqual(resumed.history[0].events, played.events)
  }
})
