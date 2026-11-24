import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createClub, nextFixture, nextSeason, readClub, schedule, settleFixture,
} from '../src/club.ts'
import { beginClubFixture, openClubFixture, saveClubTurn } from '../src/club-fixture.ts'
import {
  leagueTable, rivalryRecords, seasonOutcome, seasonSchedule, simulateRivals,
} from '../src/league.ts'
import * as basketball from '../src/basketball.ts'
import { planTurn } from '../src/opponent.ts'

function reachedFinal(mode) {
  const club = createClub(mode)
  club.results = schedule(mode).map(() => [2, 0])
  club.league.otherResults = schedule(mode).map(() => [0, 0])
  return club
}

test('regular fixtures advance all four clubs and retain the other match’s result', () => {
  const club = beginClubFixture(createClub('both'))
  const fixture = nextFixture(club)
  const first = settleFixture(club, [2, 1], openClubFixture(club).match.athletes)
  assert.deepEqual(first.league.otherResults, [simulateRivals(fixture)])
  assert.deepEqual(readClub(JSON.stringify(first)), first)
  const table = leagueTable(first, first.season)
  assert.ok(table.every(row => row.played === 1))
  const comets = table.find(row => row.team === 'Comets')
  assert.deepEqual(comets, { team: 'Comets', played: 1, wins: 1, draws: 0, losses: 0, points: 3 })
  assert.equal(table.find(row => row.team === 'Forge').losses, 1)
})

test('mixed finals use match points across both sports and award a tied series to the higher seed', () => {
  const club = reachedFinal('both')
  const fixtures = seasonSchedule(club, club.season)
  assert.deepEqual(fixtures.slice(6).map(fixture => fixture.sport), ['basketball', 'soccer'])
  assert.ok(fixtures.slice(6).every(fixture => fixture.stage === 'final' && fixture.rival === 'Forge'))
  assert.equal(seasonOutcome(club, club.season), undefined)
  assert.throws(() => nextSeason(club, 'soccer'), /Finish the current season/)

  const active = beginClubFixture(club)
  const session = openClubFixture(active)
  const turn = basketball.resolveTurn(session.match, [[], planTurn(session.match, 1, session.defense)])
  const saved = saveClubTurn(active, [], turn.match)
  assert.deepEqual(openClubFixture(readClub(JSON.stringify(saved))).match, turn.match)
  const first = settleFixture(active, [2, 1], turn.match.athletes)
  assert.equal(nextFixture(first).sport, 'soccer')
  const last = beginClubFixture(first)
  const championship = settleFixture(last, [0, 3], openClubFixture(last).match.athletes)
  assert.equal(championship.league.otherResults.length, 6)
  assert.equal(seasonOutcome(championship, 1), 'Champion')
  assert.equal(leagueTable(championship, 1)[0].points, 18)
  assert.equal(rivalryRecords([championship]).find(row => row.rival === 'Forge').losses, 1)
  const next = nextSeason(championship, 'basketball')
  assert.equal(seasonOutcome(next.history[0], 1), 'Champion')
  assert.equal(nextFixture(next).seed, 2283)
  assert.deepEqual(readClub(JSON.stringify(next)), next)
})

test('single-sport finals have one match and clubs outside the top two finish in the league', () => {
  const club = reachedFinal('basketball')
  club.results = [[0, 2], [2, 0], [2, 0], [0, 2]]
  assert.equal(leagueTable(club, 1)[0].team, 'Forge')
  assert.equal(leagueTable(club, 1)[1].team, 'Comets')
  assert.equal(seasonSchedule(club, 1).length, 5)
  const result = { ...club, results: [...club.results, [2, 2]] }
  assert.equal(seasonOutcome(result, 1), 'Runner-up')
  const missed = { ...club, results: club.results.map(() => [0, 1]) }
  assert.equal(nextFixture(missed), undefined)
  assert.equal(seasonOutcome(missed, 1), 'Missed the final')
  const corrupt = { ...missed, results: [...missed.results, [100, 1]] }
  assert.throws(() => readClub(JSON.stringify(corrupt)), /schedule/)
})

test('older saves fill in already played league rounds and preserve completed seasons', () => {
  const club = reachedFinal('both')
  const { league, ...rest } = club
  const initial = club.results.slice(0, 5)
  const previous = { ...rest, version: 2, results: initial }
  const upgraded = readClub(JSON.stringify(previous))
  assert.deepEqual(upgraded.results, initial)
  assert.deepEqual(upgraded.league.otherResults, schedule('both').slice(0, 5).map(simulateRivals))
  assert.equal(nextFixture(upgraded).seed, 2061)
  const finished = readClub(JSON.stringify({ ...rest, version: 2 }))
  assert.equal(finished.league, null)
  assert.equal(seasonOutcome(finished, 1), 'Finished')
  assert.equal(nextFixture(finished), undefined)
  assert.equal(nextSeason(finished, 'both').history[0].league, null)
})
