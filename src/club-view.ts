import {
  clubAthlete, createClub, development, nextFixture, profile, PROSPECTS, ratings, ROLES, schedule, SPECIALTIES,
  type Club, type SeasonMode, type Specialty, type Sport,
} from './club.ts'
import { DEFENSE_NAMES } from './opponent.ts'
import { SHAPE_NAMES } from './soccer.ts'

export interface ClubView {
  getClub(): Club | null
  update(club: Club): void
  start(): void
  recruit(id: string): void
  train(id: string, sport: Sport): void
  specialize(id: string, choice: Specialty): void
  changeStarter(sport: Sport, slot: number, id: string): void
  exportSave(): void
  importSave(file: File): Promise<void>
}

const SPORT: Record<Sport, string> = { basketball: 'Basketball', soccer: 'Soccer' }

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
        <p>Choose a schedule for your solo season.</p>
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
    const scheduleRows = schedule(club.mode).map((game, index) => {
      const score = club.results[index]
      const active = index === club.results.length
      const result = score ? `${score[0]}–${score[1]} · ${score[0] === score[1] ? 'Draw' : score[0] > score[1] ? 'Win' : 'Loss'}`
        : active ? (club.pending ? 'In progress' : 'Up next') : 'Scheduled'
      return `<tr ${active ? 'class="up-next"' : ''}><td>${game.week}</td><td>${SPORT[game.sport]}</td><td>${game.rival}</td><td>${result}</td></tr>`
    }).join('')
    const wins = club.results.filter(([a, b]) => a > b).length
    const draws = club.results.filter(([a, b]) => a === b).length
    const losses = club.results.length - wins - draws
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
      return `<li><b>${SPORT[sport]}</b> · ${player.xp[sport]} XP · +${development(player, sport)} skill
        <small>Passing ${stat.passing} · Finishing ${stat.finishing} · Defensive bonus ${stat.defense}</small></li>`
    }).join('')
    const sign = club.roster.length === 12 && editable
      ? `<section class="club-panel"><h3>Recruit one athlete</h3><div class="recruits">${PROSPECTS.map(entry =>
        `<div><b>${entry.name}</b><p>Awareness ${entry.awareness} · Basketball ${entry.basketball} · Soccer ${entry.soccer}${entry.keeper ? ' · Goalkeeper' : ''}</p>
        <button data-recruit="${entry.id}">Sign ${entry.name}</button></div>`).join('')}</div></section>` : ''
    const headline = fixture
      ? `Week ${fixture.week} · ${SPORT[fixture.sport]} vs ${fixture.rival}` : 'Season complete'
    const opponent = fixture && (fixture.sport === 'soccer' ? SHAPE_NAMES[fixture.soccer] : DEFENSE_NAMES[fixture.basketball])

    container.innerHTML = `<section class="club-hero"><h2>Comets club</h2>
      <p><b>${headline}</b>${opponent ? ` · ${opponent}` : ''}</p>
      <p class="season-record">${wins} wins · ${draws} draws · ${losses} losses · ${wins * 3 + draws} season points</p>
      <div class="club-actions">${fixture ? `<button class="primary" data-action="play">${club.pending ? 'Resume fixture' : 'Play fixture'}</button>`
        : '<button data-action="new">Start another season</button>'}</div>
    </section>
    <p class="club-status" role="status">${message}</p>
    <div class="club-grid">
      <section class="club-panel"><h3>Schedule</h3><div class="schedule-scroll">
        <table class="schedule"><thead><tr><th scope="col">Week</th><th scope="col">Sport</th><th scope="col">Rival</th><th scope="col">Result</th></tr></thead><tbody>${scheduleRows}</tbody></table>
      </div></section>
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
    </div>${sign}${saveControls(true)}`
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
      controller.update(createClub(mode))
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
