import {
  availableProspects, clubAthlete, createClub, development, nextFixture, nextSeason, profile, ratings, ROLES,
  SPECIALTIES, TECHNIQUES, unlocked, unlockRequirement,
  type Club, type SeasonMode, type Specialty, type Sport,
} from './club.ts'
import { DEFENSE_NAMES } from './opponent.ts'
import { SHAPE_NAMES } from './soccer.ts'
import type { Technique } from './match.ts'
import { leagueTable, rivalPair, rivalryRecords, RIVALS, schedule, seasonOutcome, seasonSchedule, type SeasonRecord } from './league.ts'

export interface ClubView {
  getClub(): Club | null
  update(club: Club): void
  start(): void
  recruit(id: string): void
  train(id: string, sport: Sport): void
  specialize(id: string, choice: Specialty): void
  equip(id: string, sport: Sport, technique: Technique | null): void
  changeStarter(sport: Sport, slot: number, id: string): void
  exportSave(): void
  importSave(file: File): Promise<void>
}

const SPORT: Record<Sport, string> = { basketball: 'Basketball', soccer: 'Soccer' }
const seasonOutcomeByIndex = (record: SeasonRecord, index: number) => seasonOutcome(record, index + 1)

export function mountClub(container: HTMLElement, controller: ClubView, signal: AbortSignal) {
  let lineupSport: Sport = controller.getClub()?.mode === 'soccer' ? 'soccer' : 'basketball'
  let athlete = 'reed'
  let message = ''
  let choosingSeason = false

  function render() {
    const club = controller.getClub()
    const fixture = club && nextFixture(club)
    if (!club || choosingSeason) {
      container.innerHTML = `<section class="club-hero">
        <h2>Comets club</h2>
        <p>${club ? 'Choose a schedule for the next season with your existing club.' : 'Choose a schedule for your solo season.'}</p>
        <div class="club-actions">
          <button data-season="both">Both sports · 6 fixtures</button>
          <button data-season="basketball">Basketball · 4 fixtures</button>
          <button data-season="soccer">Soccer · 4 fixtures</button>
          ${club ? '<button data-action="cancel">Back to completed season</button>' : ''}
        </div>
      </section>${saveControls(Boolean(club))}
      <p class="club-status" role="status">${message}</p>`
      return
    }

    const player = clubAthlete(club, athlete)
    const info = profile(athlete)
    const regular = schedule(club.mode)
    const scheduleRows = seasonSchedule(club, club.season).map((game, index) => {
      const score = club.results[index]
      const active = index === club.results.length
      const result = score ? `${score[0]}–${score[1]} · ${score[0] === score[1] ? 'Draw' : score[0] > score[1] ? 'Win' : 'Loss'}`
        : active ? (club.pending ? 'In progress' : 'Up next') : 'Scheduled'
      return `<tr ${active ? 'class="up-next"' : ''}><td>${game.stage === 'final' ? 'Final' : game.week}</td><td>${SPORT[game.sport]}</td><td>${game.rival}</td><td>${result}</td></tr>`
    }).join('')
    const regularResults = club.results.slice(0, regular.length)
    const wins = regularResults.filter(([a, b]) => a > b).length
    const draws = regularResults.filter(([a, b]) => a === b).length
    const losses = regularResults.length - wins - draws
    const outcome = seasonOutcome(club, club.season)
    const standings = club.league && leagueTable(club, club.season)
    const rank = (standings ? standings.findIndex(row => row.team === 'Comets') : -1) + 1
    const completed = [...club.history.map(seasonOutcomeByIndex), outcome]
    const titles = completed.filter(result => result === 'Champion').length
    const editable = fixture && !club.pending
    const canTrain = editable && club.trainedWeek !== fixture.week
    const allowedSports = club.mode === 'both' ? (['basketball', 'soccer'] as const) : [club.mode]
    const roster = club.roster.map(entry => {
      const data = profile(entry.id)
      return `<button class="roster-entry" data-athlete="${entry.id}" aria-pressed="${entry.id === athlete}">
        <b>${data.name}</b><span>${entry.specialty}${data.keeper ? ' · GK' : ''}</span>
        <small>${entry.fatigue}% fatigue</small></button>`
    }).join('')
    const current = club.lineups[lineupSport]
    const lineup = current.map((id, slot) => {
      const label = ROLES[lineupSport][slot]
      const choices = club.roster.filter(member => {
        if (lineupSport !== 'soccer') return true
        if (slot === 0) return profile(member.id).keeper
        return member.id !== current[0] || profile(id).keeper
      }).map(entry => `<option value="${entry.id}" ${entry.id === id ? 'selected' : ''}>${profile(entry.id).name} · ${entry.fatigue}% fatigue</option>`).join('')
      return `<label class="lineup-choice"><span>${label}</span><select data-slot="${slot}" aria-label="${label} starter, slot ${slot + 1}" ${editable ? '' : 'disabled'}>${choices}</select></label>`
    }).join('')
    const stats = (['basketball', 'soccer'] as const).map(sport => {
      const stat = ratings(player, sport)
      const options = (Object.keys(TECHNIQUES) as Technique[]).map(key => {
        if (TECHNIQUES[key].specialty && TECHNIQUES[key].specialty !== player.specialty) return ''
        const available = unlocked(player, sport, key)
        return `<option value="${key}" ${player.equipped[sport] === key ? 'selected' : ''} ${available ? '' : 'disabled'}>
          ${TECHNIQUES[key].label}${available ? '' : ` · ${unlockRequirement(key)}`}</option>`
      }).join('')
      return `<li><b>${SPORT[sport]}</b> · ${player.xp[sport]} XP · +${development(player, sport)} skill
        <small>Passing ${stat.passing} · Finishing ${stat.finishing} · Defensive bonus ${stat.defense}</small>
        <label class="lineup-choice">Ability <select data-ability="${sport}" aria-label="${SPORT[sport]} ability for ${info.name}" ${editable ? '' : 'disabled'}>
          <option value="">No ability equipped</option>${options}
        </select></label>
        ${stat.technique ? `<small>${TECHNIQUES[stat.technique].detail}</small>` : ''}</li>`
    }).join('')
    const prospects = availableProspects(club)
    const sign = prospects.length && editable
      ? `<section class="club-panel"><h3>Recruit one athlete this season</h3><div class="recruits">${prospects.map(entry =>
        `<div><b>${entry.name}</b><p>Awareness ${entry.awareness} · Basketball ${entry.basketball} · Soccer ${entry.soccer}${entry.keeper ? ' · Goalkeeper' : ''}</p>
        <button data-recruit="${entry.id}">Sign ${entry.name}</button></div>`).join('')}</div></section>` : ''
    const headline = fixture
      ? `${fixture.stage === 'final' ? 'Club final' : `Week ${fixture.week}`} · ${SPORT[fixture.sport]} vs ${fixture.rival}`
      : 'Season complete'
    const opponent = fixture && (fixture.sport === 'soccer' ? SHAPE_NAMES[fixture.soccer] : DEFENSE_NAMES[fixture.basketball])

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
        <td>${row.wins}–${row.draws}–${row.losses}</td></tr>`
    }).join('')
    const past = club.history.map(({ mode, results }, index) => {
      const record = results.map(([a, b]) => a > b ? 'W' : a === b ? 'D' : 'L').join('–')
      return `<li>Season ${index + 1} · ${mode === 'both' ? 'Both sports' : SPORT[mode]} · ${record} · ${completed[index]}</li>`
    }).join('')
    container.innerHTML = `<section class="club-hero"><h2>Comets club</h2>
      <p><b>Season ${club.season} · ${headline}</b>${opponent ? ` · ${opponent}` : ''}</p>
      ${outcome && outcome !== 'Finished' ? `<p class="league-outcome"><b>${outcome}</b>${rank ? ` · League rank ${rank}` : ''}</p>` : ''}
      <p class="season-record">${wins} wins · ${draws} draws · ${losses} losses · ${wins * 3 + draws} league points${titles ? ` · ${titles} ${titles === 1 ? 'title' : 'titles'}` : ''}</p>
      <div class="club-actions">${fixture ? `<button class="primary" data-action="play">${club.pending ? 'Resume fixture' : 'Play fixture'}</button>`
        : '<button data-action="new">Start another season</button>'}</div>
    </section>
    <p class="club-status" role="status">${message}</p>
    <div class="club-grid">
      <section class="club-panel"><h3>Schedule</h3><div class="schedule-scroll">
        <table class="schedule fixture-schedule"><thead><tr><th scope="col">Week</th><th scope="col">Sport</th><th scope="col">Rival</th><th scope="col">Result</th></tr></thead><tbody>${scheduleRows}</tbody></table>
      </div></section>
      ${leaguePanel}
      <section class="club-panel"><h3>Starting lineup</h3><div class="club-actions">
        ${allowedSports.map(sport => `<button data-lineup="${sport}" aria-pressed="${lineupSport === sport}">${SPORT[sport]}</button>`).join('')}
      </div><div class="lineup-options">${lineup}</div></section>
      <section class="club-panel"><h3>Roster</h3><div class="roster-list">${roster}</div></section>
      <section class="club-panel"><h3>${info.name}</h3>
        <p><b>Awareness ${info.awareness}</b> · ${player.fatigue}% fatigue</p>
        <label class="lineup-choice">Specialty <select data-specialty aria-label="Specialty for ${info.name}" ${editable ? '' : 'disabled'}>
          ${Object.keys(SPECIALTIES).map(key => `<option ${key === player.specialty ? 'selected' : ''}>${key}</option>`).join('')}</select></label>
        <p class="muted">${SPECIALTIES[player.specialty]}</p><ul class="sport-stats">${stats}</ul>
        ${editable ? `<p class="muted">${canTrain ? 'One training session available this week.' : 'Training used this week.'}</p>
        <div class="club-actions">${allowedSports.map(sport => `<button data-train="${sport}" ${canTrain ? '' : 'disabled'}>Train ${SPORT[sport]}</button>`).join('')}</div>` : ''}
      </section>
    </div>${sign}<details class="club-panel rival-records"><summary>Rival records</summary>
      <div class="schedule-scroll"><table class="schedule"><thead><tr><th scope="col">Club</th>
        <th scope="col">Basketball defense</th><th scope="col">Soccer defense</th><th scope="col">W–D–L</th>
      </tr></thead><tbody>${rivalRows}</tbody></table></div></details>${past ? `<details class="club-panel past-seasons"><summary>Past seasons</summary><ol>${past}</ol></details>` : ''}
    ${saveControls(true)}`
  }

  function saveControls(hasSave: boolean) {
    return `<div class="club-actions save-controls">
      ${hasSave ? '<button data-action="export">Export save</button>' : ''}
      <label class="import-save">${hasSave ? 'Import and replace save' : 'Import save'}<input type="file" id="club-import" accept=".json,application/json"></label>
    </div>`
  }

  container.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button')
    if (!button) return
    const data = button.dataset
    if (data.action === 'play') {
      controller.start()
      return
    }
    message = ''
    if (data.season) {
      const mode = data.season as SeasonMode
      const current = controller.getClub()
      controller.update(current ? nextSeason(current, mode) : createClub(mode))
      athlete = 'reed'
      lineupSport = mode === 'soccer' ? 'soccer' : 'basketball'
      choosingSeason = false
    } else if (data.action === 'new' || data.action === 'cancel') {
      choosingSeason = data.action === 'new'
    } else if (data.action === 'export') {
      controller.exportSave()
      return
    } else if (data.athlete) {
      athlete = data.athlete
    } else if (data.lineup) {
      lineupSport = data.lineup as Sport
    } else if (data.recruit) {
      controller.recruit(data.recruit)
      athlete = data.recruit
      message = `${profile(athlete).name} joined the club.`
    } else if (data.train) {
      controller.train(athlete, data.train as Sport)
      message = `${profile(athlete).name} earned 3 ${SPORT[data.train as Sport]} XP.`
    }
    render()
    if (data.athlete || data.lineup) container.querySelector<HTMLButtonElement>('[aria-pressed="true"]' +
      (data.athlete ? `[data-athlete="${athlete}"]` : `[data-lineup="${lineupSport}"]`))?.focus()
  }, { signal })

  container.addEventListener('change', async event => {
    const input = event.target as HTMLInputElement | HTMLSelectElement
    message = ''
    try {
      if (input instanceof HTMLInputElement && input.files?.[0]) {
        input.disabled = true
        await controller.importSave(input.files[0])
        if (signal.aborted) return
        athlete = 'reed'
        lineupSport = controller.getClub()?.mode === 'soccer' ? 'soccer' : 'basketball'
        choosingSeason = false
        message = 'Club save loaded.'
      } else if (input.dataset.slot !== undefined) {
        controller.changeStarter(lineupSport, Number(input.dataset.slot), input.value)
      } else if (input.dataset.ability) {
        controller.equip(athlete, input.dataset.ability as Sport, input.value ? input.value as Technique : null)
      } else if (input.dataset.specialty !== undefined) {
        controller.specialize(athlete, input.value as Specialty)
      }
    } catch {
      message = 'That change could not be applied. Check the save file or lineup.'
    }
    render()
  }, { signal })
  render()
}
