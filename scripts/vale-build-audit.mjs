import * as basketball from '../src/basketball.ts'
import * as soccer from '../src/soccer.ts'
import { planTurn as basketballAI, planTurnV1 as basketballV1 } from '../src/opponent.ts'
import { planTurn as soccerAI, planTurnV1 as soccerV1 } from '../src/soccer-opponent.ts'
import { clubAthlete, createClub, readClub, setStarter } from '../src/club.ts'
import { beginClubFixture } from '../src/club-fixture.ts'
import { quickStep, recoveryBonus } from '../src/athletics.ts'

const pairs = Number(process.argv[2] ?? 240)
if (!Number.isSafeInteger(pairs) || pairs < 1) throw new Error('Supply a positive number of paired seeds.')

const builds = {
  Finisher: { signature: 'cut-and-finish', passive: 'quick-step', skill: 'finishing', trait: 'speed' },
  Defender: { signature: 'jump-lane', passive: 'second-wind', skill: 'defense', trait: 'endurance' },
}

function clubMatch(sport, build, seed, role) {
  const { signature, passive, skill, trait } = builds[build]
  const club = setStarter(createClub(sport), sport, role, 'vale')
  club.league.seedOffset = seed
  const vale = clubAthlete(club, 'vale')
  Object.assign(vale, { specialty: build })
  vale.xp[sport] = 6
  vale.mastery[build] = 3
  vale.learned[sport] = [signature]
  vale.signature[sport] = signature
  vale.technical[sport][skill] = 1
  vale.athletics[trait] = 1
  vale.equipped[sport] = passive
  const reed = clubAthlete(club, 'reed')
  reed.xp[sport] = 3
  reed.mastery.Playmaker = 3
  reed.learned[sport] = ['relay']
  reed.signature[sport] = 'relay'
  return beginClubFixture(readClub(JSON.stringify(club))).pending.start.match
}

function distributionPlan(match, team, style) {
  const baseline = basketballV1(match, team, style)
  const holder = basketball.athleteById(match, match.holder)
  if (holder.team !== team || basketball.shotEstimate(match, holder).chance >= 65) return baseline
  const passes = basketball.legalCommands(match, holder.id).filter(order => order.kind === 'pass')
    .map(order => {
      const receiver = basketball.athleteById(match, order.target)
      const followUp = basketball.legalCommands(match, receiver.id).find(next => next.kind === 'catch-shoot')
      return { order, followUp, shot: basketball.shotEstimate(match, receiver).chance }
    }).filter(({ followUp }) => followUp).sort((a, b) => b.shot - a.shot)
  const pass = passes[0]
  return pass ? [pass.order, pass.followUp] : baseline
}

function play(sport, build, seed, scenario) {
  const isCourt = sport === 'basketball'
  const engine = isCourt ? basketball : soccer
  const homePolicy = isCourt ? basketballAI : soccerAI
  const awayPolicy = scenario.distribution ? distributionPlan : isCourt
    ? (scenario.adaptive ? basketballAI : basketballV1) : (scenario.adaptive ? soccerAI : soccerV1)
  let match = clubMatch(sport, build, seed, scenario.role)
  if (!isCourt) match.shapes[1] = scenario.style
  const id = `0-${scenario.role}`
  const stats = { win: 0, draw: 0, for: 0, against: 0, shots: 0, chance: 0, turnovers: 0,
    valeCuts: 0, valeFinishes: 0, valeLaneReads: 0, valeTurnoversForced: 0, valeUnassigned: 0,
    valeRecovered: 0, secondWindStamina: 0, quickStepOrders: 0, valeEndStamina: 0, relayFinishes: 0 }
  while (!engine.finished(match)) {
    const home = homePolicy(match, 0)
    const away = awayPolicy(match, 1, scenario.style)
    const possession = engine.athleteById(match, match.holder).team
    const vale = engine.athleteById(match, id)
    const order = home.find(command => command.athlete === id)
    const next = engine.resolveTurn(match, [home, away])
    const texts = next.events.map(({ text }) => text)
    const finish = texts.some(text => /^Vale cuts.*shoots/.test(text))
    const read = texts.some(text => text === 'Vale jumps the passing lane.')
    const turnover = next.events.some(event => event.kind === 'turnover')
    if (possession === 0) {
      const shot = texts.map(text => text.match(/\((\d+)% chance, |(\d+)% goal chance\)/)).find(Boolean)
      if (shot) {
        stats.shots++
        stats.chance += Number(shot[1] ?? shot[2])
      }
      if (turnover) stats.turnovers++
    }
    if (order?.kind === 'cut-and-finish') {
      stats.valeCuts++
      if (quickStep(vale, true)) stats.quickStepOrders++
    }
    if (finish) stats.valeFinishes++
    if (finish && texts.some(text => text.startsWith('Reed relays the ball'))) stats.relayFinishes++
    if (read) stats.valeLaneReads++
    if (read && turnover) stats.valeTurnoversForced++
    if (!order) {
      stats.valeUnassigned++
      const gain = Math.max(0, engine.athleteById(next.match, id).stamina - vale.stamina)
      stats.valeRecovered += gain
      if (vale.technique === 'second-wind') stats.secondWindStamina += Math.max(0, gain - (isCourt ? 6 : 5) - recoveryBonus(vale))
    }
    match = next.match
  }
  const [own, rival] = match.score
  Object.assign(stats, { win: Number(own > rival), draw: Number(own === rival),
    for: own, against: rival, valeEndStamina: engine.athleteById(match, id).stamina })
  return stats
}

function summarize(matches) {
  const sums = Object.fromEntries(Object.keys(matches[0]).map(key =>
    [key, matches.reduce((total, match) => total + match[key], 0)]))
  const rounded = number => Number(number.toFixed(2))
  return {
    wins: sums.win, draws: sums.draw, losses: matches.length - sums.win - sums.draw,
    scoreFor: rounded(sums.for / matches.length), scoreAgainst: rounded(sums.against / matches.length),
    shots: sums.shots, meanShotChance: sums.shots ? rounded(sums.chance / sums.shots) : null, turnovers: sums.turnovers,
    valeCuts: sums.valeCuts, valeFinishes: sums.valeFinishes, valeLaneReads: sums.valeLaneReads,
    valeReadThenTurnover: sums.valeTurnoversForced, relayFinishes: sums.relayFinishes, valeUnassigned: sums.valeUnassigned,
    valeRecoveredPerUnassigned: rounded(sums.valeRecovered / Math.max(1, sums.valeUnassigned)),
    valeEndStamina: rounded(sums.valeEndStamina / matches.length),
    quickStepOnCutOrders: sums.quickStepOrders, extraStaminaFromSecondWind: sums.secondWindStamina,
  }
}

function winDifference(finisher, defender) {
  const deltas = finisher.map(({ win }, index) => win - defender[index].win)
  const mean = deltas.reduce((a, b) => a + b, 0) / pairs
  const spread = pairs > 1
    ? 1.96 * Math.sqrt(deltas.reduce((total, delta) => total + (delta - mean) ** 2, 0) / (pairs * (pairs - 1))) : 0
  return { percentagePoints: +(mean * 100).toFixed(1), approximate95PercentInterval: spread
    ? [+(100 * (mean - spread)).toFixed(1), +(100 * (mean + spread)).toFixed(1)] : null }
}

const scenarios = {
  basketball: [
    { label: 'Switch defense with the earlier policy', style: 'switch', role: 1, adaptive: false },
    { label: 'Switch defense with signature awareness', style: 'switch', role: 1, adaptive: true },
    { label: 'Pass denial with signature awareness', style: 'pressure', role: 1, adaptive: true },
    { label: 'Pass-first rival; Vale at small forward', style: 'pressure', role: 2, distribution: true },
  ],
  soccer: [
    { label: 'High press with the earlier policy', style: 'press', role: 8, adaptive: false },
    { label: 'High press with signature awareness', style: 'press', role: 8, adaptive: true },
    { label: 'Compact shape with signature awareness', style: 'compact', role: 8, adaptive: true },
    { label: 'High press with the earlier policy; Vale at attacking midfield', style: 'press', role: 7, adaptive: false },
    { label: 'High press with signature awareness; Vale at attacking midfield', style: 'press', role: 7, adaptive: true },
  ],
}

const report = Object.entries(scenarios).flatMap(([sport, scripts]) => scripts.map(scenario => {
  const finisher = []
  const defender = []
  for (let index = 0; index < pairs; index++) {
    const seed = index * 65537
    finisher.push(play(sport, 'Finisher', seed, scenario))
    defender.push(play(sport, 'Defender', seed, scenario))
  }
  return { sport, scenario: scenario.label, pairs, finisher: summarize(finisher), defender: summarize(defender),
    pairedFinisherWinRateDifference: winDifference(finisher, defender) }
}))

console.log(JSON.stringify(report, null, 2))
