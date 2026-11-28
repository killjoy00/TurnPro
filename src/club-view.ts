import { FOCUS_XP, isFocusForSport, MATCH_FOCUSES, type FocusId } from './match-focus.ts'
import {
  availableProspects, baseSkill, CAMP_SESSIONS, campSessions, canBookCamp, canLearnSignature, canTrainTechnical, clubAthlete, createClub, development, fixtureLineup, keeperSlot, MAX_FILM_BONUS, nextFixture, nextSeason, profile, ratings, RECOVERY_SESSION, RESTED_FIXTURE_RECOVERY, ROLES,
  roleName, roleProgress, SPECIALTIES, TECHNIQUES, unlocked, unlockRequirement,
  type Club, type SeasonMode, type Specialty, type Sport, type TrainingFocus,
} from './club.ts'
import { SIGNATURES, SIGNATURE_XP, signatureAvailable, type Signature } from './athlete-abilities.ts'
import { ATHLETIC_TRAITS, isAthleticTrait, MAX_TRAIT, type AthleticTrait } from './athletics.ts'
import {
  DRILLS, MASTERY_BRANCHES, MAX_MASTERY, MAX_TECHNICAL_RANK, SIGNATURE_MASTERY, SPECIALTY_NAMES, specialtyRank, TECHNICAL_PREREQUISITE,
  TECHNICAL_SKILLS, type TechnicalSkill,
} from './progression.ts'
import { DEFENSE_NAMES } from './opponent.ts'
import { SHAPE_NAMES } from './soccer.ts'
import { HOCKEY_STYLES } from './hockey-opponent.ts'
import { FOOTBALL_STYLES } from './football-opponent.ts'
import type { Technique } from './match.ts'
import { BETWEEN_WEEK_RECOVERY, cupTrophies, leagueTable, rivalPair, rivalSignature, rivalryRecords, RIVALS, SAME_WEEK_RECOVERY, seasonOutcome, seasonSchedule, seasonSports, SPORTS, type Fixture, type SeasonRecord } from './league.ts'

export interface ClubView {
  getClub(): Club | null
  update(club: Club): void
  start(focus?: FocusId): void
  recruit(id: string): void
  train(id: string, focus: TrainingFocus): void
  chooseBranch(id: string, branch: Technique): void
  prioritize(id: string, fixture: number | null): void
  trainTechnical(id: string, sport: Sport, skill: TechnicalSkill): void
  specialize(id: string, choice: Specialty): void
  equip(id: string, sport: Sport, technique: Technique | null): void
  learnSignature(id: string, sport: Sport, signature: Signature): void
  equipSignature(id: string, sport: Sport, signature: Signature | null): void
  changeStarter(sport: Sport, slot: number, id: string): void
  exportSave(): void
  importSave(file: File): Promise<void>
}

const SPORT: Record<Sport, string> = { basketball: 'Basketball', soccer: 'Soccer', hockey: 'Ice hockey', football: 'American football' }
const TRAITS = Object.keys(ATHLETIC_TRAITS) as AthleticTrait[]
const competition = (game: Fixture) => game.stage === 'cup' ? 'Cup' : game.stage === 'final' ? 'Club final'
  : game.rival === 'Forge' ? 'League rivalry' : 'League'
const matchup = (game: Fixture) => `${game.day ? game.day + ' · ' : ''}${SPORT[game.sport]} ${competition(game).toLowerCase()} vs ${game.rival}`
const seasonOutcomeByIndex = (record: SeasonRecord, index: number) => seasonOutcome(record, index + 1)

export function mountClub(container: HTMLElement, controller: ClubView, signal: AbortSignal) {
  const startingTab = (club: Club | null) => club ? (nextFixture(club)?.sport ?? seasonSports(club.mode)[0]) : 'basketball'
  let lineupSport: Sport = startingTab(controller.getClub())
  let athlete = 'reed'
  let message = ''
  let choosingSeason = false
  let chosenFocus: FocusId | '' | undefined
  let lastDrillSport: Sport | undefined

  function render() {
    const club = controller.getClub()
    const fixture = club && nextFixture(club)
    if (!club || choosingSeason) {
      container.innerHTML = `<section class="club-hero">
        <h2>Comets club</h2>
        <p>${club ? 'Choose a schedule for the next season with your existing club.' : 'Choose a schedule for your solo season.'}</p>
        <div class="club-actions" data-controller-row>
          <button class="primary" data-season="all">All four sports · 12 league + 4 cups</button>
          <button data-season="both">Basketball &amp; soccer · 6 fixtures</button>
          <button data-season="basketball">Basketball · 4 fixtures</button>
          <button data-season="soccer">Soccer · 4 fixtures</button>
          <button data-season="hockey">Ice hockey · 4 fixtures</button><button data-season="football">American football · 4 fixtures</button>
          ${club ? '<button data-action="cancel">Back to completed season</button>' : ''}
        </div>
      </section>${saveControls(Boolean(club))}
      <p class="club-status" role="status"></p>`
      container.querySelector('.club-status')!.textContent = message
      return
    }

    const player = clubAthlete(club, athlete)
    const info = profile(athlete)
    const games = seasonSchedule(club, club.season)
    const regular = games.filter(game => game.stage === 'regular')
    const scheduleRows = games.map((game, index) => {
      const score = club.results[index]
      const active = index === club.results.length
      const result = score ? `${score[0]}–${score[1]} · ${score[0] === score[1] ? 'Draw' : score[0] > score[1]
        ? game.stage === 'cup' ? 'Cup won' : 'Win' : 'Loss'}` : active ? (club.pending ? 'In progress' : 'Up next') : 'Scheduled'
      return `<tr class="${active ? 'up-next ' : ''}${game.stage === 'cup' ? 'cup-fixture' : ''}">
        <td>${game.day ? `W${game.week} · ${game.day}` : game.week}</td><td>${SPORT[game.sport]}<small>${competition(game)}</small></td>
        <td>${game.rival}</td><td>${result}${club.priority?.fixture === index ? `<small>${profile(club.priority.athlete).name} prioritized</small>` : ''}</td></tr>`
    }).join('')
    const weekGames = fixture ? games.flatMap((game, index) => {
      if (game.week !== fixture.week) return []
      const score = club.results[index]
      return [`<li class="${index === club.results.length ? 'current-fixture' : ''}">
        <b>${matchup(game)}</b><small>${score ? score.join('–') : index === club.results.length ? 'Up next' : 'Scheduled'}</small></li>`]
    }).join('') : ''
    const regularResults = club.results.filter((_, index) => games[index]?.stage === 'regular')
    const wins = regularResults.filter(([a, b]) => a > b).length
    const draws = regularResults.filter(([a, b]) => a === b).length
    const losses = regularResults.length - wins - draws
    const outcome = seasonOutcome(club, club.season)
    const standings = club.league && leagueTable(club, club.season)
    const rank = (standings ? standings.findIndex(row => row.team === 'Comets') : -1) + 1
    const completed = [...club.history.map(seasonOutcomeByIndex), outcome]
    const titles = completed.filter(result => result === 'Champion').length
    const editable = fixture && !club.pending
    const booked = campSessions(club)
    const campLeft = CAMP_SESSIONS - booked.length
    const canTrain = editable && campLeft > 0
    const campTraining = (focus: TrainingFocus) => canTrain && canBookCamp(club, { kind: 'training', athlete, focus })
    const rotation = fixture && fixtureLineup(club, fixture)
    const priority = club.priority
    const later = games.flatMap((game, index) => fixture && game.week === fixture.week && index > club.results.length
      ? [{ game, index }] : [])
    const cupTitles = [...club.history, club].flatMap(cupTrophies).length
    const thisSeasonCups = cupTrophies(club)
    const campLabels = booked.map(entry => {
      if (entry.kind === 'legacy') return 'Earlier training session'
      const name = profile(entry.athlete).name
      if (entry.kind === 'lesson') return `${name} · ${SIGNATURES[entry.signature].label}`
      if (entry.kind === 'drill') return `${name} · ${DRILLS[entry.sport][entry.skill]} drill`
      const focus = entry.focus
      return `${name} · ${focus === 'film' ? 'Film study' : focus === 'recovery' ? 'Recovery' : isAthleticTrait(focus)
        ? ATHLETIC_TRAITS[focus].name : SPORT[focus] + ' practice'}`
    })
    const allowedSports = seasonSports(club.mode)
    const roster = club.roster.map(entry => {
      const data = profile(entry.id)
      return `<button class="roster-entry" data-athlete="${entry.id}" aria-pressed="${entry.id === athlete}">
        <b>${data.name}</b><span>${entry.specialty}${data.keeper ? ' · GK' : ''}</span>
        <small>${entry.fatigue}% fatigue</small></button>`
    }).join('')
    const current = club.lineups[lineupSport]
    const keeper = keeperSlot(lineupSport)
    const lineup = current.map((id, slot) => {
      const label = ROLES[lineupSport][slot]
      const choices = club.roster.filter(member => {
        if (keeper < 0) return true
        if (slot === keeper) return profile(member.id).keeper
        return member.id !== current[keeper] || profile(id).keeper
      }).map(entry => {
        const data = profile(entry.id)
        const skill = baseSkill(data, lineupSport) + development(entry, lineupSport)
        const role = roleName(lineupSport, slot)
        const fit = roleProgress(lineupSport, role, entry.roleStarts[lineupSport][role] ?? 0)
        return `<option value="${entry.id}" ${entry.id === id ? 'selected' : ''}>${data.name} · Skill ${skill}${fit.level ? ` · +${fit.level} ${fit.rating}` : ''} · ${ATHLETIC_TRAITS[data.naturalTrait].name} · ${entry.fatigue}% fatigue</option>`
      }).join('')
      return `<label class="lineup-choice"><span>${label}</span><select data-slot="${slot}" aria-label="${label} starter, slot ${slot + 1}" ${editable ? '' : 'disabled'}>${choices}</select></label>`
    }).join('')
    function signatureChoices(sport: Sport) {
      const equipped = player.signature[sport]
      const known = player.learned[sport]
      const options = known.map(key => `<option value="${key}" ${equipped === key ? 'selected' : ''}>
        ${SIGNATURES[key].label} · ${SIGNATURES[key].slot}</option>`).join('')
      const courses = (Object.keys(SIGNATURES) as Signature[]).filter(key => signatureAvailable(key, sport) && !known.includes(key))
      const available = courses.filter(key => canTrain && allowedSports.includes(sport) && canLearnSignature(player, sport, key)
        && canBookCamp(club, { kind: 'lesson', athlete, sport, signature: key }))
      const lessons = courses.map(key => {
        const ability = SIGNATURES[key]
        return `<div class="signature-lesson"><small><b>${ability.label}</b> · ${ability.slot} · ${ability.specialty} · ${SIGNATURE_MASTERY} mastery · ${SIGNATURE_XP} sport XP
          <span>${ability.detail}</span></small>
          ${available.includes(key) ? `<button type="button" class="top-action" data-learn-signature="${key}" data-sport="${sport}">Learn ${ability.label.toLowerCase()} for ${SPORT[sport]}</button>` : ''}</div>`
      }).join('')
      return `<div class="signature-options">
        <label class="lineup-choice">Signature <select data-signature="${sport}" aria-label="${SPORT[sport]} signature for ${info.name}" ${editable && known.length ? '' : 'disabled'}>
          <option value="">No signature equipped</option>${options}
        </select></label>
        ${equipped ? `<small>${SIGNATURES[equipped].detail}</small>` : ''}
        ${lessons ? `<details ${available.length ? 'open' : ''}><summary>Learn signatures</summary>${lessons}</details>` : ''}
      </div>`
    }
    function drillsFor(sport: Sport) {
      const lesson = TECHNICAL_SKILLS.map(skill => {
        const rank = player.technical[sport][skill]
        const canDrill = canTrain && allowedSports.includes(sport) && canTrainTechnical(player, sport, skill)
          && canBookCamp(club, { kind: 'drill', athlete, sport, skill })
        return `<div class="technical-drill"><span>${DRILLS[sport][skill]} <small>${rank}/${MAX_TECHNICAL_RANK}</small></span>
          ${canDrill ? `<button type="button" class="top-action" data-drill="${skill}" data-sport="${sport}"
            aria-label="Train ${DRILLS[sport][skill].toLowerCase()} in ${SPORT[sport]}">Train</button>` : ''}</div>`
      }).join('')
      return `<details class="technical-options" ${lastDrillSport === sport ? 'open' : ''}>
        <summary data-drills="${sport}">Skill drills</summary>
        <small>Unlock at ${TECHNICAL_PREREQUISITE} sport XP. A session adds +1 to the chosen skill and +1 sport XP.</small>
        ${lesson}
      </details>`
    }
    const stats = SPORTS.map(sport => {
      const stat = ratings(player, sport)
      const options = (Object.keys(TECHNIQUES) as Technique[]).map(key => {
        const role = TECHNIQUES[key].specialty
        if (role && role !== player.specialty && player.mastery[role] < MAX_MASTERY) return ''
        const available = unlocked(player, sport, key)
        return `<option value="${key}" ${player.equipped[sport] === key ? 'selected' : ''} ${available ? '' : 'disabled'}>
          ${TECHNIQUES[key].label}${available ? '' : ` · ${unlockRequirement(key)}`}</option>`
      }).join('')
      const roles = Object.entries(player.roleStarts[sport]).map(([role, starts]) => {
        const progress = roleProgress(sport, role, starts)
        const boost = progress.level ? ` · +${progress.level} ${progress.rating}` : ''
        const next = progress.nextAt ? ` · Next +1 ${progress.rating} at ${progress.nextAt}` : ''
        return `<small>${role} · ${starts}/${progress.maxStarts} appearances${boost}${next}</small>`
      }).join('')
      return `<li><b>${SPORT[sport]}</b> · ${player.xp[sport]} XP · +${development(player, sport)} skill
        <small>Passing ${stat.passing} · Finishing ${stat.finishing} · Defensive bonus ${stat.defense}${keeperSlot(sport) >= 0 && stat.keeping ? ` · Keeping ${stat.keeping}` : ''}</small>
        ${roles}
        <label class="lineup-choice">Passive <select data-ability="${sport}" aria-label="${SPORT[sport]} ability for ${info.name}" ${editable ? '' : 'disabled'}>
          <option value="">No ability equipped</option>${options}
        </select></label>
        ${stat.technique ? `<small>${TECHNIQUES[stat.technique].detail}</small>` : ''}
        ${signatureChoices(sport)}${drillsFor(sport)}</li>`
    }).join('')
    const prospects = availableProspects(club)
    const sign = prospects.length && editable
      ? `<section class="club-panel"><h3>Recruit one athlete this season</h3><div class="recruits">${prospects.map(entry =>
        `<div><b>${entry.name}</b><p>${entry.specialty} · ${ATHLETIC_TRAITS[entry.naturalTrait].name} · Awareness ${entry.awareness}${entry.keeper ? ' · Goalkeeper' : ''}</p>
        <p>${allowedSports.map(sport => `${SPORT[sport]} ${baseSkill(entry, sport)}`).join(' · ')}</p>
        <button data-recruit="${entry.id}">Sign ${entry.name}</button></div>`).join('')}</div></section>` : ''
    const headline = fixture
      ? `${fixture.stage === 'regular' ? `Week ${fixture.week}` : competition(fixture)} · ${SPORT[fixture.sport]} vs ${fixture.rival}`
      : 'Season complete'
    const opponent = fixture && {
      soccer: SHAPE_NAMES[fixture.soccer], basketball: DEFENSE_NAMES[fixture.basketball],
      hockey: HOCKEY_STYLES[fixture.hockey], football: FOOTBALL_STYLES[fixture.football],
    }[fixture.sport]
    const scoutedSignature = club.pending
      ? club.pending.start?.match.athletes.find(player => player.team === 1 && player.signature)?.signature
      : fixture && rivalSignature(fixture)?.signature
    const startingStamina = fixture && rotation && !club.pending ? rotation.starters
      .filter((_, slot) => fixture.sport !== 'hockey' || slot < 5 || slot === keeperSlot('hockey'))
      .map(id => ratings(clubAthlete(club, id), fixture.sport).stamina) : []
    const averageStamina = startingStamina.length
      ? Math.round(startingStamina.reduce((sum, stamina) => sum + stamina, 0) / startingStamina.length) : 0
    const tired = startingStamina.filter(stamina => stamina < 65).length

    const leaguePanel = standings ? `<section class="club-panel"><h3>League standings</h3>
      <p class="muted league-rule">Top two reach the final. Ties in the final favor the higher seed.</p>
      <div class="schedule-scroll"><table class="schedule league-table">
        <thead><tr><th scope="col">Rank</th><th scope="col">Club</th><th scope="col" title="Played">P</th>
        <th scope="col" title="Wins">W</th><th scope="col" title="Draws">D</th><th scope="col" title="Losses">L</th><th scope="col">Pts</th></tr></thead>
        <tbody>${standings.map((row, index) => `<tr class="${row.team === 'Comets' ? 'own-club' : ''}">
          <td>${index + 1}</td><th scope="row">${row.team}</th><td>${row.played}</td><td>${row.wins}</td>
          <td>${row.draws}</td><td>${row.losses}</td><td>${row.points}</td></tr>`).join('')}</tbody>
      </table></div>
      <p class="muted league-rule">Ranked by points, wins, head-to-head points, then preseason order.</p>
      ${club.league?.otherResults.length ? `<details class="other-fixtures"><summary>Around the league</summary><ul>${club.league.otherResults.map((score, index) => {
        const [home, away] = rivalPair(regular[index])
        return `<li>Week ${regular[index].week} · ${SPORT[regular[index].sport]} · ${home} ${score.join('–')} ${away}</li>`
      }).join('')}</ul></details>` : ''}
      </section>` : ''
    const rivalRows = rivalryRecords([...club.history, club]).map(row => {
      const rival = RIVALS.find(entry => entry.rival === row.rival)!
      return `<tr><th scope="row">${rival.rival}</th><td>${DEFENSE_NAMES[rival.basketball]}</td><td>${SHAPE_NAMES[rival.soccer]}</td>
        <td>${HOCKEY_STYLES[rival.hockey]}</td><td>${FOOTBALL_STYLES[rival.football]}</td>
        <td>${row.wins}–${row.draws}–${row.losses}</td></tr>`
    }).join('')
    const past = club.history.map((record, index) => {
      const { mode, results } = record
      const letters = results.map(([a, b]) => a > b ? 'W' : a === b ? 'D' : 'L').join('–')
      const trophies = cupTrophies(record).map(sport => SPORT[sport] + ' Cup')
      return `<li>Season ${index + 1} · ${mode === 'all' ? 'All four sports' : mode === 'both' ? 'Basketball &amp; soccer' : SPORT[mode]} · ${letters} · ${completed[index]}${trophies.length ? ' · ' + trophies.join(', ') : ''}</li>`
    }).join('')
    const protectedFixture = priority && games[priority.fixture]
    const protectedStamina = priority && Math.min(100, 100 - clubAthlete(club, priority.athlete).fatigue
      + (priority.fixture - club.results.length) * (RESTED_FIXTURE_RECOVERY + (club.calendar === 'cups' ? SAME_WEEK_RECOVERY : 0)))
    const priorityForm = fixture && (priority || later.length) ? `<div class="fixture-priority">
      ${priority && protectedFixture ? `<p><b>${profile(priority.athlete).name}</b> is protected for ${matchup(protectedFixture)} · Projected starting stamina ${protectedStamina}.</p>` : ''}
      ${rotation && rotation.rotation ? `<p>${profile(rotation.rotation.in).name} replaces ${profile(rotation.rotation.out).name} in the next lineup.</p>` : ''}
      ${editable && later.length ? `<form data-priority>
        <p class="muted">Protect one athlete for a later fixture this week. An eligible reserve covers earlier appearances.</p>
        <label class="lineup-choice">Athlete <select name="athlete">${club.roster.map(entry =>
          `<option value="${entry.id}" ${entry.id === (priority?.athlete ?? athlete) ? 'selected' : ''}>${profile(entry.id).name}</option>`).join('')}</select></label>
        <label class="lineup-choice">Save for <select name="fixture">${later.map(({ game, index }) =>
          `<option value="${index}" ${priority?.fixture === index ? 'selected' : ''}>${matchup(game)}</option>`).join('')}</select></label>
        <button type="submit">Set fixture priority</button><p class="priority-error" role="status"></p>
      </form>` : ''}
      ${priority && editable ? '<button type="button" data-action="clear-priority">Clear priority</button>' : ''}
    </div>` : ''
    const branch = player.branches[player.specialty]
    const masteryBranch = branch ? `<p class="mastery-branch" tabindex="-1"><b>${TECHNIQUES[branch].label}</b> is available in every sport.</p>`
      : player.mastery[player.specialty] === MAX_MASTERY ? `<div class="mastery-branch">
        <h4>Choose a ${player.specialty} branch</h4>
        <p class="muted">One permanent choice for this specialty. It unlocks the passive in every sport. Equip one passive per sport.</p>
        <div class="branch-options">${MASTERY_BRANCHES[player.specialty].map(key => `<div>
          <b>${TECHNIQUES[key].label}</b><p>${TECHNIQUES[key].detail}</p>
          <button type="button" data-branch="${key}" ${editable ? '' : 'disabled'}>Choose ${TECHNIQUES[key].label}</button>
        </div>`).join('')}</div>
      </div>` : ''
    const focusChoices = fixture ? (Object.keys(MATCH_FOCUSES) as FocusId[]).filter(id => isFocusForSport(id, fixture.sport)) : []
    const selectedFocus = chosenFocus === '' || (chosenFocus && focusChoices.includes(chosenFocus)) ? chosenFocus : focusChoices[0]
    const focusInfo = selectedFocus ? MATCH_FOCUSES[selectedFocus] : undefined
    const savedFocus = club.pending?.focus
    const focusPicker = editable ? `<div class="fixture-focus">
      <label for="fixture-focus">Match focus</label>
      <select id="fixture-focus"><option value="">No focus</option>
        ${focusChoices.map(id => `<option value="${id}" ${id === selectedFocus ? 'selected' : ''}>${MATCH_FOCUSES[id].label}</option>`).join('')}
      </select>
      ${focusInfo ? `<p>${focusInfo.instruction} The athlete earns ${FOCUS_XP} XP and one point in
        ${DRILLS[focusInfo.sport][focusInfo.skill].toLowerCase()} up to the skill cap when the fixture ends.</p>` : ''}
    </div>` : savedFocus ? `<p class="muted">${MATCH_FOCUSES[savedFocus.id].label}
      ${savedFocus.athlete ? ` · Completed by ${savedFocus.athlete}` : ''}</p>` : ''
    container.innerHTML = `<section class="club-hero"><h2>Comets club</h2>
      <p><b>Season ${club.season} · ${headline}</b>${opponent ? ` · ${opponent}` : ''}</p>
      ${outcome && outcome !== 'Finished' ? `<p class="league-outcome"><b>${outcome}</b>${rank ? ` · League rank ${rank}` : ''}</p>` : ''}
      <p class="season-record">${wins} wins · ${draws} draws · ${losses} losses · ${wins * 3 + draws} league points${titles ? ` · ${titles} league ${titles === 1 ? 'title' : 'titles'}` : ''}${cupTitles ? ` · ${cupTitles} ${cupTitles === 1 ? 'cup' : 'cups'}` : ''}</p>
      ${thisSeasonCups.length ? `<p class="cup-titles">This season · ${thisSeasonCups.map(sport => SPORT[sport] + ' Cup').join(' · ')}</p>` : ''}
      ${fixture?.stage === 'cup' ? '<p class="muted">Win to lift the cup. A draw leaves it with the rival. League standings are separate.</p>' : ''}
      ${fixture ? `<p class="camp-balance">Week ${fixture.week} camp · ${campLeft} of ${CAMP_SESSIONS} sessions left</p>` : ''}
      ${startingStamina.length ? `<p class="muted club-readiness">Next lineup · Avg stamina ${averageStamina} · ${tired} of ${startingStamina.length} below 65</p>` : ''}
      ${scoutedSignature ? `<p class="muted"><b>Rival signature · ${SIGNATURES[scoutedSignature].label}</b>
        <br>${SIGNATURES[scoutedSignature].detail}</p>` : ''}
      ${focusPicker}
      <div class="club-actions">${fixture ? `<button class="primary" data-action="play">${club.pending ? 'Resume fixture' : 'Play fixture'}</button>`
        : '<button data-action="new">Start another season</button>'}</div>
    </section>
    <p class="club-status" role="status"></p>
    <div class="club-grid">
      <section class="club-panel"><h3>Season calendar</h3>
        ${weekGames ? `<ol class="week-itinerary" aria-label="This week’s fixtures">${weekGames}</ol>` : ''}
        ${priorityForm}
        ${club.calendar === 'cups' ? `<p class="muted league-rule">Recover ${SAME_WEEK_RECOVERY} fatigue between fixtures and ${BETWEEN_WEEK_RECOVERY} between weeks. Athletes who sit out recover another ${RESTED_FIXTURE_RECOVERY}.</p>` : ''}
        <details class="full-calendar" ${!fixture ? 'open' : ''}><summary>Full season schedule</summary><div class="schedule-scroll">
        <table class="schedule fixture-schedule"><thead><tr><th scope="col">When</th><th scope="col">Sport</th><th scope="col">Rival</th><th scope="col">Result</th></tr></thead><tbody>${scheduleRows}</tbody></table>
        </div></details></section>
      ${leaguePanel}
      <section class="club-panel"><h3>Starting lineup</h3><div class="club-actions">
        ${allowedSports.map(sport => `<button data-lineup="${sport}" aria-pressed="${lineupSport === sport}">${SPORT[sport]}</button>`).join('')}
      </div>
      ${lineupSport === 'football' ? '<p class="muted league-rule">Each athlete plays both listed positions and shares one stamina pool.</p>'
        : lineupSport === 'hockey' ? '<p class="muted league-rule">The reserve line rests until your goalie calls a line change.</p>' : ''}
      <div class="lineup-options">${lineup}</div></section>
      <section class="club-panel"><h3>Roster</h3><div class="roster-list">${roster}</div></section>
      <section class="club-panel"><h3>${info.name}</h3>
        <p><b>Awareness ${info.awareness + player.film}</b>${player.film ? ` (+${player.film} from film)` : ''} · ${player.fatigue}% fatigue</p>
        <ul class="athlete-traits" aria-label="Shared athletic attributes">${TRAITS.map(trait => `<li>
          <b>${ATHLETIC_TRAITS[trait].name} ${player.athletics[trait] + Number(info.naturalTrait === trait)}</b>
          <small>${player.athletics[trait]}/${MAX_TRAIT} trained${info.naturalTrait === trait ? ' · +1 natural' : ''}</small>
          <small>${ATHLETIC_TRAITS[trait].detail}</small></li>`).join('')}</ul>
        <label class="lineup-choice">Specialty <select data-specialty aria-label="Specialty for ${info.name}" ${editable ? '' : 'disabled'}>
          ${Object.keys(SPECIALTIES).map(key => `<option ${key === player.specialty ? 'selected' : ''}>${key}</option>`).join('')}</select></label>
        <p class="muted">${SPECIALTIES[player.specialty]}</p>
        <ul class="mastery-list" aria-label="Specialty mastery">${SPECIALTY_NAMES.map(role => `<li>
          <b>${role}</b> <span>${specialtyRank(player.mastery[role])}</span>
          <progress aria-label="${role} mastery" value="${player.mastery[role]}" max="${MAX_MASTERY}"></progress>
          <small>${player.mastery[role]}/${MAX_MASTERY}${role === player.specialty ? ' · Active' : ''}</small>
        </li>`).join('')}</ul>
        <p class="muted">Earn mastery in your active specialty through fixtures and general sport training. At ${SIGNATURE_MASTERY}, spend a session to learn a signature for a sport. At ${MAX_MASTERY}, keep using that specialty’s passive after switching roles, with 6 XP in the sport.</p>
        ${masteryBranch}
        ${fixture ? `<div class="camp">
          <h4 id="camp-heading" tabindex="-1">Weekly training camp</h4>
          <p>${campLeft} of ${CAMP_SESSIONS} sessions left · Shared by the club</p>
          ${campLabels.length ? `<ul>${campLabels.map(label => `<li>${label}</li>`).join('')}</ul>` : ''}
          ${editable ? `<p class="muted">Practice adds 3 sport XP and 1 active mastery up to its cap. Skill drills and signature lessons below also cost a session.</p>
          <div class="club-actions">${allowedSports.map(sport => `<button data-train="${sport}" ${campTraining(sport) ? '' : 'disabled'}>Train ${SPORT[sport]}</button>`).join('')}
          <button data-train="film" ${campTraining('film') && player.film < MAX_FILM_BONUS ? '' : 'disabled'}>Study film (+1 awareness)</button>
          <button data-train="recovery" ${campTraining('recovery') && player.fatigue > 0 ? '' : 'disabled'}>Recover (−${Math.min(RECOVERY_SESSION, player.fatigue)} fatigue)</button>
          ${TRAITS.map(trait => `<button data-train="${trait}" ${campTraining(trait) && player.athletics[trait] < MAX_TRAIT ? '' : 'disabled'}>Train ${ATHLETIC_TRAITS[trait].name}</button>`).join('')}</div>` : ''}
        </div>` : ''}
        <ul class="sport-stats">${stats}</ul>
      </section>
    </div>${sign}<details class="club-panel rival-records"><summary>Rival records</summary>
      <div class="schedule-scroll"><table class="schedule"><thead><tr><th scope="col">Club</th>
        <th scope="col">Basketball defense</th><th scope="col">Soccer defense</th>
        <th scope="col">Hockey defense</th><th scope="col">Football defense</th><th scope="col">W–D–L</th>
      </tr></thead><tbody>${rivalRows}</tbody></table></div></details>${past ? `<details class="club-panel past-seasons"><summary>Past seasons</summary><ol>${past}</ol></details>` : ''}
    ${saveControls(true)}`
    container.querySelector('.club-status')!.textContent = message
  }

  function saveControls(hasSave: boolean) {
    return `<div class="club-actions save-controls">
      ${hasSave ? '<button data-action="export">Export save</button>' : ''}
      <label class="import-save">${hasSave ? 'Import and replace save' : 'Import save'}<input type="file" id="club-import" accept=".json,application/json"></label>
    </div>`
  }

  container.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button')
    if (!button || button.type === 'submit' && button.form?.matches('[data-priority]')) return
    const data = button.dataset
    if (data.action === 'play') {
      const focus = container.querySelector<HTMLSelectElement>('#fixture-focus')?.value
      controller.start(focus ? focus as FocusId : undefined)
      return
    }
    message = ''
    if (data.season) {
      const mode = data.season as SeasonMode
      const current = controller.getClub()
      controller.update(current ? nextSeason(current, mode) : createClub(mode))
      athlete = 'reed'
      lineupSport = seasonSports(mode)[0]
      choosingSeason = false
    } else if (data.action === 'new' || data.action === 'cancel') {
      choosingSeason = data.action === 'new'
    } else if (data.action === 'export') {
      controller.exportSave()
      return
    } else if (data.athlete) {
      athlete = data.athlete
      lastDrillSport = undefined
    } else if (data.lineup) {
      lineupSport = data.lineup as Sport
    } else if (data.recruit) {
      controller.recruit(data.recruit)
      athlete = data.recruit
      message = `${profile(athlete).name} joined the club.`
    } else if (data.learnSignature && data.sport) {
      const key = data.learnSignature as Signature
      controller.learnSignature(athlete, data.sport as Sport, key)
      message = `${profile(athlete).name} learned ${SIGNATURES[key].label} for ${SPORT[data.sport as Sport]}.`
    } else if (data.drill && data.sport) {
      const sport = data.sport as Sport
      const skill = data.drill as TechnicalSkill
      controller.trainTechnical(athlete, sport, skill)
      lastDrillSport = sport
      message = `${profile(athlete).name} gained 1 ${DRILLS[sport][skill].toLowerCase()} and 1 ${SPORT[sport]} XP.`
    } else if (data.action === 'clear-priority') {
      controller.prioritize(athlete, null)
      message = 'Fixture priority cleared.'
    } else if (data.branch) {
      const key = data.branch as Technique
      controller.chooseBranch(athlete, key)
      message = `${profile(athlete).name} can equip ${TECHNIQUES[key].label} in every sport.`
    } else if (data.train) {
      const focus = data.train as TrainingFocus
      controller.train(athlete, focus)
      const name = profile(athlete).name
      message = focus === 'film' ? `${name} gained 1 awareness across sports.`
        : focus === 'recovery' ? `${name} finished recovery at ${clubAthlete(controller.getClub()!, athlete).fatigue}% fatigue.`
          : isAthleticTrait(focus) ? `${name} gained 1 ${ATHLETIC_TRAITS[focus].name.toLowerCase()} across sports.`
            : `${name} earned 3 ${SPORT[focus]} XP.`
    }
    render()
    if (data.branch) container.querySelector<HTMLElement>('.mastery-branch')?.focus()
    if (data.train) container.querySelector<HTMLElement>('#camp-heading')?.focus()
    if (data.drill) container.querySelector<HTMLElement>(`[data-drills="${data.sport}"]`)?.focus()
    if (data.learnSignature) container.querySelector<HTMLSelectElement>(`[data-signature="${data.sport}"]`)?.focus()
    if (data.season) container.querySelector<HTMLButtonElement>('[data-action="play"]')?.focus()
    if (data.athlete || data.lineup) container.querySelector<HTMLButtonElement>('[aria-pressed="true"]' +
      (data.athlete ? `[data-athlete="${athlete}"]` : `[data-lineup="${lineupSport}"]`))?.focus()
  }, { signal })

  container.addEventListener('submit', event => {
    if (!(event.target instanceof HTMLFormElement) || !event.target.matches('[data-priority]')) return
    event.preventDefault()
    const data = new FormData(event.target)
    try {
      controller.prioritize(String(data.get('athlete')), Number(data.get('fixture')))
      message = 'Fixture priority saved.'
    } catch (error) {
      event.target.querySelector('.priority-error')!.textContent = error instanceof Error ? error.message : 'Choose an athlete and fixture.'
      return
    }
    render()
    container.querySelector<HTMLButtonElement>('[data-priority] button')?.focus()
  }, { signal })

  container.addEventListener('change', async event => {
    const input = event.target as HTMLInputElement | HTMLSelectElement
    if (input.closest('[data-priority]')) return
    message = ''
    try {
      if (input instanceof HTMLInputElement && input.files?.[0]) {
        input.disabled = true
        await controller.importSave(input.files[0])
        if (signal.aborted) return
        athlete = 'reed'
        lineupSport = startingTab(controller.getClub())
        choosingSeason = false
        message = 'Club save loaded.'
      } else if (input.id === 'fixture-focus') {
        chosenFocus = input.value as FocusId | ''
      } else if (input.dataset.slot !== undefined) {
        controller.changeStarter(lineupSport, Number(input.dataset.slot), input.value)
      } else if (input.dataset.signature) {
        controller.equipSignature(athlete, input.dataset.signature as Sport, input.value ? input.value as Signature : null)
      } else if (input.dataset.ability) {
        controller.equip(athlete, input.dataset.ability as Sport, input.value ? input.value as Technique : null)
      } else if (input.dataset.specialty !== undefined) {
        controller.specialize(athlete, input.value as Specialty)
      }
    } catch (error) {
      message = input.id !== 'club-import' && error instanceof Error ? error.message
        : 'That change could not be applied. Check the save file or lineup.'
    }
    render()
    if (input.id === 'fixture-focus') container.querySelector<HTMLElement>('#fixture-focus')?.focus()
    if (input.dataset.signature) container.querySelector<HTMLSelectElement>(`[data-signature="${input.dataset.signature}"]`)?.focus()
  }, { signal })
  render()
}
