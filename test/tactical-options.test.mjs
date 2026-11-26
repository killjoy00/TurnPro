import assert from 'node:assert/strict'
import test from 'node:test'
import * as basketball from '../src/basketball.ts'
import * as soccer from '../src/soccer.ts'
import * as hockey from '../src/hockey.ts'
import * as football from '../src/football.ts'
import { clubAthlete, createClub, equip, ratings, readClub, setStarter, specialize } from '../src/club.ts'
import { beginClubFixture, openClubFixture, saveClubTurn } from '../src/club-fixture.ts'
import { planTurn as basketballAI } from '../src/opponent.ts'
import { planTurn as soccerAI } from '../src/soccer-opponent.ts'
import { planTurn as hockeyAI } from '../src/hockey-opponent.ts'
import { planTurn as footballAI } from '../src/football-opponent.ts'

test('a connected screen creates a roll and close shot, and the defense can switch', () => {
  const match = basketball.createPickAndRollPractice()
  const pass = { athlete: '0-0', kind: 'pass', target: '0-4' }
  const roll = { athlete: '0-4', kind: 'roll-screen' }
  const guard = basketballAI(match, 1)
  const screen = basketball.resolveTurn(match, [[pass, { ...roll, kind: 'screen' }], guard])
  const played = basketball.resolveTurn(match, [[pass, roll], guard])
  assert.ok(!screen.events.some(event => /catches on the roll/.test(event.text)))
  assert.ok(played.events.some(event => /Okafor catches on the roll and shoots/.test(event.text)))
  assert.ok(played.events.some(event => event.cue?.type === 'move' && event.cue.moves.some(move => move.athlete === '0-4')))
  const switched = basketball.resolveTurn(match, [[pass, roll], [{ athlete: '1-4', kind: 'switch' }]])
  assert.ok(switched.events.some(event => /switches onto Reed.*picks up Okafor/.test(event.text)))
  assert.equal(basketball.athleteById(played.match, '0-4').stamina, 83)
})

test('a soccer switch beats central traffic when the flank is open and accounts for its landing defenders', () => {
  const match = soccer.createSwitchPractice()
  const spread = { athlete: '0-10', kind: 'show-wide' }
  const pass = { athlete: '0-8', kind: 'switch-field', target: '0-10' }
  assert.ok(!soccer.legalCommands(match, pass.athlete).some(order => order.kind === 'pass' && order.target === pass.target))
  const clear = soccer.previewPass(match, pass, [spread])
  const crowded = structuredClone(match)
  const defender = soccer.athleteById(crowded, '1-4')
  defender.position = { ...clear.destination }
  assert.ok(soccer.previewPass(crowded, pass, [spread]).chance < clear.chance)
  const played = soccer.resolveTurn(match, [[spread, pass], soccerAI(match, 1)])
  assert.equal(played.match.holder, '0-10')
  assert.ok(soccer.athleteById(played.match, pass.target).position.y > 57)
  assert.ok(played.events.some(event => /switch of play/.test(event.text)))

  const offside = structuredClone(match)
  const receiver = soccer.athleteById(offside, pass.target)
  receiver.position.x = 85
  for (const athlete of offside.athletes.filter(player => player.team === 1)) athlete.position.x = 72
  assert.equal(soccer.previewPass(offside, pass, [spread]).offside, true)
  const flagged = soccer.resolveTurn(offside, [[spread, pass], []])
  assert.ok(flagged.events.some(event => /offside restart/.test(event.text)))
})

test('a bank outlet trades extra distance for a route outside the direct forecheck', () => {
  const match = hockey.createBreakoutPractice()
  const carrier = hockey.athleteById(match, '0-3')
  const receiver = hockey.athleteById(match, '0-1')
  const outlet = { athlete: carrier.id, kind: 'wall-outlet', target: receiver.id }
  const support = { athlete: receiver.id, kind: 'show-outlet' }
  assert.ok(hockey.passChance(match, carrier, receiver, true) > hockey.passChance(match, carrier, receiver))
  const played = hockey.resolveTurn(match, [[outlet, support], hockeyAI(match, 1)])
  assert.equal(played.match.holder, receiver.id)
  assert.ok(hockey.athleteById(played.match, receiver.id).position.y < receiver.position.y)
  assert.ok(played.events.some(event => /banks the puck along the boards/.test(event.text)))
  assert.ok(hockey.commandTarget(match, outlet).y < receiver.position.y)
})

test('play-action punishes run fits, with protection and deep coverage affecting the result', () => {
  const match = football.createPlayActionPractice()
  const fake = { athlete: '0-o-0', kind: 'play-action', target: '0-o-7' }
  const slant = { athlete: '0-o-7', kind: 'slant' }
  const protect = { athlete: '0-o-2', kind: 'protect' }
  const filling = footballAI(match, 1)
  const balanced = football.playEstimate(match, fake, [slant, protect])
  const sold = football.playEstimate(match, fake, [slant, protect], filling)
  const covered = football.playEstimate(match, fake, [slant, protect], [
    { athlete: '1-d-7', kind: 'cover-deep' }, { athlete: '1-d-8', kind: 'cover-deep' },
  ])
  const unprotected = football.playEstimate(match, fake, [slant], filling)
  assert.ok(sold.chance > balanced.chance && covered.chance < balanced.chance && unprotected.sack > sold.sack)
  const played = football.resolveTurn(match, [[fake, slant, protect], filling])
  assert.ok(played.events.some(event => /fakes the handoff/.test(event.text)))
  assert.ok(played.events.some(event => /run fake draws 2 defenders/.test(event.text)))
  assert.equal(played.match.down, 1)
})

test('natural traits follow an athlete across positions and sports and support distinct ability paths', () => {
  let club = createClub('all')
  const vale = clubAthlete(club, 'vale')
  vale.xp.basketball = 3
  club = equip(club, 'vale', 'basketball', 'quick-step')
  club = specialize(club, 'vale', 'Defender')
  assert.equal(ratings(clubAthlete(club, 'vale'), 'hockey').athletics.speed, 1)
  assert.equal(ratings(clubAthlete(club, 'okafor'), 'soccer').athletics.strength, 1)
  club = setStarter(club, 'basketball', 0, 'vale')
  const match = openClubFixture(beginClubFixture(club)).match
  assert.equal(basketball.athleteById(match, '0-0').athletics.speed, 1)
  assert.equal(basketball.athleteById(match, '0-0').technique, 'quick-step')
  assert.equal(basketball.athleteById(match, '0-1').athletics.composure, 1)
})

test('a committed opponent plan and the starting athletic profiles are used after reload', () => {
  const club = beginClubFixture(createClub('basketball'))
  const fixture = openClubFixture(club)
  const plan = [{ athlete: '0-0', kind: 'drive' }]
  const opponent = []
  assert.ok(basketballAI(fixture.match, 1, fixture.defense).length > 0)
  const result = basketball.resolveTurn(fixture.match, [plan, opponent])
  const saved = saveClubTurn(club, plan, result.match, undefined, opponent)
  const loaded = readClub(JSON.stringify(saved))
  clubAthlete(loaded, 'reed').athletics.speed = 2
  const resumed = openClubFixture(loaded)
  assert.deepEqual(resumed.match, result.match)
  assert.deepEqual(resumed.history[0].events, result.events)
  assert.deepEqual(loaded.pending.opponentPlans, [[]])

  const legacy = beginClubFixture(createClub('basketball'))
  delete legacy.pending.athletics
  delete legacy.pending.opponentPlans
  assert.equal(basketball.athleteById(openClubFixture(legacy).match, '0-0').athletics, undefined)
})
