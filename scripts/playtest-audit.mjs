import * as basketball from '../src/basketball.ts'
import * as soccer from '../src/soccer.ts'
import * as hockey from '../src/hockey.ts'
import * as football from '../src/football.ts'
import { planTurn as basketballAI } from '../src/opponent.ts'
import { planTurn as soccerAI } from '../src/soccer-opponent.ts'
import { planTurn as hockeyAI } from '../src/hockey-opponent.ts'
import { planTurn as footballAI } from '../src/football-opponent.ts'
import { clubAthlete, createClub, keeperSlot, nextFixture, profile, recruit, setStarter, train } from '../src/club.ts'
import { beginClubFixture, openClubFixture, saveClubTurn } from '../src/club-fixture.ts'

const matches = Number(process.argv[2] ?? 500)
const seasons = Number(process.argv[3] ?? 20)
for (const count of [matches, seasons]) {
  if (!Number.isSafeInteger(count) || count < 1) throw new Error('Supply a positive match and season count.')
}

const sports = {
  basketball: { ...basketball, plan: basketballAI },
  soccer: { ...soccer, plan: soccerAI },
  hockey: { ...hockey, plan: hockeyAI },
  football: { ...football, plan: footballAI },
}

const quickMatches = Object.entries(sports).map(([sport, rules]) => {
  const totals = { sport, matches, points: 0, draws: 0, scoreless: 0, openingWins: 0, turnovers: 0 }
  for (let seed = 0; seed < matches; seed++) {
    const opening = seed % 2
    let match = rules.createMatch(seed, opening)
    while (!rules.finished(match)) {
      const result = rules.resolveTurn(match, [rules.plan(match, 0), rules.plan(match, 1)])
      totals.turnovers += result.events.filter(event => event.kind === 'turnover').length
      match = result.match
    }
    const [home, away] = match.score
    totals.points += home + away
    if (home === away) totals.draws++
    if (home + away === 0) totals.scoreless++
    if (match.score[opening] > match.score[1 - opening]) totals.openingWins++
  }
  return totals
})

function rotate(club, sport) {
  const lineup = club.lineups[sport]
  const keeper = keeperSlot(sport)
  const replacements = club.roster.filter(player => !lineup.includes(player.id)).sort((a, b) => a.fatigue - b.fatigue)
  const starters = lineup.map((id, slot) => ({ slot, player: clubAthlete(club, id) }))
    .sort((a, b) => b.player.fatigue - a.player.fatigue)
  for (const replacement of replacements) {
    const index = starters.findIndex(({ player, slot }) => replacement.fatigue < player.fatigue
      && (slot !== keeper || profile(replacement.id).keeper))
    if (index >= 0) club = setStarter(club, sport, starters.splice(index, 1)[0].slot, replacement.id)
  }
  return club
}

const career = ['stock', 'rotation', 'rotation + recovery'].map(policy => {
  let stamina = 0
  let starters = 0
  let capped = 0
  let recoverySessions = 0
  for (let season = 0; season < seasons; season++) {
    let club = recruit(createClub('all'), 'imani')
    club.league.seedOffset = season * 257
    for (let fixture = 0; fixture < 12; fixture++) {
      const { sport, week } = nextFixture(club)
      if (policy === 'rotation + recovery' && club.trainedWeek !== week) {
        const tired = [...club.roster].sort((a, b) => b.fatigue - a.fatigue)
          .find(player => club.lineups[sport].includes(player.id) && player.fatigue >= 12)
        if (tired) {
          club = train(club, tired.id, 'recovery')
          recoverySessions++
        }
      }
      if (policy !== 'stock') club = rotate(club, sport)
      club = beginClubFixture(club)
      const session = openClubFixture(club)
      const rules = sports[sport]
      let match = session.match
      for (const athlete of match.athletes.filter(player => player.team === 0)) {
        starters++
        stamina += athlete.stamina
        if (athlete.stamina === 35) capped++
      }
      while (!rules.finished(match)) {
        const plan = rules.plan(match, 0)
        const opponent = session.opponent(match, 1)
        match = rules.resolveTurn(match, [plan, opponent]).match
        club = saveClubTurn(club, plan, match, undefined, opponent)
      }
    }
  }
  return { policy, seasons, starts: starters, averageStamina: +(stamina / starters).toFixed(1),
    atFatigueCap: +(100 * capped / starters).toFixed(1), recoverySessions }
})

console.log(JSON.stringify({ quickMatches, career }, null, 2))
