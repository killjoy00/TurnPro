import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clubAthlete, createClub, equip, nextFixture, nextSeason, ratings, readClub, recruit, schedule, setStarter, specialize, train,
} from '../src/club.ts'
import { beginClubFixture, openClubFixture, saveClubTurn } from '../src/club-fixture.ts'
import * as basketball from '../src/basketball.ts'
import * as soccer from '../src/soccer.ts'
import { planTurn as basketballAI } from '../src/opponent.ts'
import { planTurn as soccerAI } from '../src/soccer-opponent.ts'

function resolveClubTurn(club, session, orders = []) {
  const { match, sport } = session
  const result = sport === 'basketball'
    ? basketball.resolveTurn(match, [orders, basketballAI(match, 1, session.defense)])
    : soccer.resolveTurn(match, [orders, soccerAI(match, 1)])
  return { club: saveClubTurn(club, orders, result.match), session: { ...session, match: result.match }, result }
}

test('training and lineup decisions keep sport skills separate and share awareness', () => {
  const first = createClub('both')
  const original = clubAthlete(first, 'reed')
  const trained = train(first, 'reed', 'soccer')
  const reed = clubAthlete(trained, 'reed')
  assert.equal(ratings(reed, 'soccer').passing, ratings(original, 'soccer').passing + 1)
  assert.deepEqual(ratings(reed, 'basketball'), ratings(original, 'basketball'))
  assert.equal(ratings(reed, 'basketball').awareness, ratings(reed, 'soccer').awareness)
  assert.throws(() => train(trained, 'reed', 'basketball'), /used this week/)
  const finished = specialize(trained, 'reed', 'Finisher')
  assert.ok(ratings(clubAthlete(finished, 'reed'), 'soccer').finishing > ratings(reed, 'soccer').finishing)
  assert.ok(ratings(clubAthlete(finished, 'reed'), 'soccer').passing < ratings(reed, 'soccer').passing)

  const signed = recruit(finished, 'imani')
  assert.throws(() => recruit(signed, 'lin'), /one available/)
  assert.throws(() => setStarter(signed, 'soccer', 0, 'reed'), /goalkeeper/)
  const lineup = setStarter(signed, 'soccer', 0, 'imani')
  assert.equal(lineup.lineups.soccer[0], 'imani')
  assert.equal(new Set(lineup.lineups.soccer).size, 11)
})

test('a club save restores an active fixture, applies fatigue, and completes all six fixtures', () => {
  let club = train(createClub('both'), 'reed', 'basketball')
  for (const sport of ['basketball', 'soccer']) {
    assert.equal(schedule(sport).length, 4)
    assert.ok(schedule(sport).every(fixture => fixture.sport === sport))
  }
  for (let i = 0; i < 6; i += 1) {
    const fixture = nextFixture(club)
    if (fixture.week > club.trainedWeek) club = train(club, 'reed', fixture.sport)
    club = beginClubFixture(club)
    let match = openClubFixture(club)
    assert.equal(match.match.teams[1], fixture.rival)
    assert.throws(() => train(club, 'reed', fixture.sport), /Finish the current fixture/)
    if (i === 1) {
      assert.ok(match.match.athletes.find(player => player.name === 'Reed').stamina < 100)
      assert.equal(match.match.athletes.find(player => player.name === 'Reed').awareness, 9)
      assert.equal(clubAthlete(club, 'reed').xp.soccer, 0)
    }
    while (club.pending) {
      const resolved = resolveClubTurn(club, match)
      club = resolved.club
      match = resolved.session
      if (match.match.turn === 2) {
        const restored = readClub(JSON.stringify(club))
        const resumed = openClubFixture(restored)
        assert.deepEqual(resumed.match, match.match)
        assert.deepEqual(resumed.history[0].events, resolved.result.events)
        club = restored
      }
    }
    assert.equal(club.results.length, i + 1)
  }
  assert.equal(nextFixture(club), undefined)
  assert.deepEqual(readClub(JSON.stringify(club)), club)
  assert.throws(() => beginClubFixture(club), /complete/)
})

test('corrupted and incompatible saves cannot replace a valid season', () => {
  const club = createClub('both')
  assert.throws(() => readClub(JSON.stringify({ ...club, mode: ['both'] })), /unsupported/)
  const bad = { ...club, lineups: { ...club.lineups, soccer: Array(11).fill('reed') } }
  assert.throws(() => readClub(JSON.stringify(bad)), /lineups/)
  const active = beginClubFixture(club)
  assert.throws(() => openClubFixture(readClub(JSON.stringify({ ...active, pending: { rules: 999, turns: [] } }))), /rules version/)
  const tampered = { ...active, pending: { ...active.pending, turns: [[{ athlete: '1-0', kind: 'shoot' }]] } }
  assert.throws(() => openClubFixture(readClub(JSON.stringify(tampered))), /unavailable/)
})

test('abilities unlock by specialty and sport, and the club carries them into another season', () => {
  let club = createClub('both')
  assert.throws(() => equip(club, 'reed', 'basketball', 'thread-pass'), /locked/)
  while (nextFixture(club)) {
    const fixture = nextFixture(club)
    if (club.trainedWeek < fixture.week) club = train(club, 'reed', 'basketball')
    club = beginClubFixture(club)
    let session = openClubFixture(club)
    while (club.pending) {
      const resolved = resolveClubTurn(club, session)
      club = resolved.club
      session = resolved.session
    }
  }

  const previous = club.results
  const league = club.league
  club = nextSeason(club, 'basketball')
  assert.equal(club.season, 2)
  assert.deepEqual(club.history, [{ mode: 'both', results: previous, league }])
  assert.equal(club.results.length, 0)
  assert.equal(club.trainedWeek, 0)
  assert.throws(() => equip(club, 'reed', 'soccer', 'thread-pass'), /locked/)
  club = equip(equip(club, 'reed', 'basketball', 'thread-pass'), 'reed', 'soccer', 'second-wind')
  assert.equal(ratings(clubAthlete(club, 'reed'), 'basketball').technique, 'thread-pass')
  assert.equal(ratings(clubAthlete(club, 'reed'), 'soccer').technique, 'second-wind')
  assert.equal(clubAthlete(specialize(club, 'reed', 'Defender'), 'reed').equipped.basketball, 'thread-pass')
  assert.deepEqual(readClub(JSON.stringify(club)), club)
  assert.equal(openClubFixture(beginClubFixture(club)).match.athletes[0].technique, 'thread-pass')
})

test('first-season saves from the previous build migrate without losing the active fixture', () => {
  let club = beginClubFixture(recruit(train(createClub('both'), 'reed', 'basketball'), 'imani'))
  const resolved = resolveClubTurn(club, openClubFixture(club))
  club = resolved.club
  const { version, season, history, recruitedSeason, roster, league, ...state } = club
  const v1 = { ...state, version: 1, roster: roster.map(({ equipped, mastery, technical, ...player }) => player) }
  const migrated = readClub(JSON.stringify(v1))
  const reed = clubAthlete(club, 'reed')
  assert.equal(reed.mastery.Playmaker, 1)
  assert.equal(clubAthlete(migrated, 'reed').mastery.Playmaker, 0)
  assert.deepEqual(openClubFixture(migrated), openClubFixture(club))
})
