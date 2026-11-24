import * as basketball from './basketball.ts'
import * as soccer from './soccer.ts'
import { mountGame, type SportView } from './game-view.ts'
import { DEFENSE_NAMES, planTurn as basketballAI, type DefenseStyle } from './opponent.ts'
import { planTurn as soccerAI } from './soccer-opponent.ts'
import { drawBasketball, drawSoccer } from './surfaces.ts'
import { equip, readClub, recruit, setStarter, specialize, train, type Club } from './club.ts'
import { beginClubFixture, openClubFixture, saveClubTurn } from './club-fixture.ts'
import { mountClub } from './club-view.ts'
import type { MatchSnapshot, PlanCommand } from './match.ts'
import { installGamepad } from './gamepad.ts'

const basketballView: SportView<basketball.Match, basketball.Command> = {
  id: 'basketball',
  surfaceName: 'Half court',
  intro: 'Select a Comets athlete on the court or in the lineup to plan the first turn.',
  width: basketball.COURT.width,
  height: basketball.COURT.length,
  turnLimit: basketball.TURN_LIMIT,
  create: seed => basketball.createMatch(seed),
  practices: [{
    name: 'Practice a kick-out',
    create: () => basketball.createMatch(2026),
    intro: 'Use a screen, drive and kick out to the shooter in one turn.',
    steps: [
      { label: 'Reed · Drive and kick out to Vale', athlete: '0-0', kind: 'kickout', target: '0-1' },
      { label: 'Okafor · Set screen', athlete: '0-4', kind: 'screen' },
      { label: 'Vale · Catch and shoot', athlete: '0-1', kind: 'catch-shoot' },
    ],
  }],
  limit: () => basketball.COMMAND_LIMIT,
  legalCommands: basketball.legalCommands,
  label: basketball.commandLabel,
  stamina: command => basketball.ACTIONS[command.kind].stamina,
  preview(match, command) {
    if (command.kind !== 'shoot') return ''
    const shot = basketball.shotEstimate(match, basketball.athleteById(match, command.athlete))
    return `${shot.points} pt · ~${shot.chance}% now · `
  },
  noOrders: () => 'Recover stamina on base assignments this turn.',
  previewTarget(match, command) {
    if (command.kind === 'cut') return basketball.LANDMARKS[command.target]
    return 'target' in command ? basketball.athleteById(match, command.target).position : undefined
  },
  opponent: basketballAI,
  resolveTurn: basketball.resolveTurn,
  draw: drawBasketball,
  clockDetail: () => 'Planning',
  opponentDetail: () => 'Balanced',
}

const soccerView: SportView<soccer.Match, soccer.Command> = {
  id: 'soccer',
  surfaceName: 'Full pitch',
  intro: 'Start with a carry or pass at midfield. Queue a teammate’s run to open a lane.',
  width: soccer.PITCH.width,
  height: soccer.PITCH.length,
  turnLimit: soccer.TURN_LIMIT,
  create: (seed, limit) => soccer.createMatch(seed, 0, limit, defense.value as soccer.DefenseShape),
  practices: [
    {
      name: 'Beat the press',
      create: soccer.createPressPractice,
      intro: 'Send Adeyemi through the middle and play Reed’s through ball before the press closes.',
      steps: [
        { label: 'Reed · Through ball to Adeyemi', athlete: '0-6', kind: 'through', target: '0-9' },
        { label: 'Adeyemi · Run into the middle', athlete: '0-9', kind: 'run', target: 1 },
      ],
    },
    {
      name: 'Practice a cross',
      create: soccer.createCrossingPractice,
      intro: 'Queue Vale’s cross to Adeyemi. Send Adeyemi into the middle, then commit.',
      steps: [
        { label: 'Vale · Cross to Adeyemi', athlete: '0-8', kind: 'cross', target: '0-9' },
        { label: 'Adeyemi · Run into the middle', athlete: '0-9', kind: 'run', target: 1 },
      ],
    },
  ],
  limit: match => match.commandLimit,
  legalCommands: soccer.legalCommands,
  label: soccer.commandLabel,
  stamina: command => soccer.ACTIONS[command.kind].stamina,
  preview(match, command, plan) {
    const player = soccer.athleteById(match, command.athlete)
    if (command.kind === 'shoot') {
      return `~${soccer.shotEstimate(match, player).goal}% goal now · `
    }
    if ('target' in command && command.kind !== 'run') {
      const pass = soccer.previewPass(match, command, plan)
      if (pass.offside) return 'Offside · '
      const lane = pass.defenders.length === 0 ? 'Clear' : pass.defenders.length === 1 ? 'Guarded' : 'Crowded'
      return `${lane} · ~${Math.round(pass.chance)}% · `
    }
    return ''
  },
  noOrders: athlete => athlete.role === 'GK'
    ? 'Your keeper tracks the ball and attempts saves automatically.'
    : 'Recover stamina while your team keeps its shape.',
  previewTarget(match, command, plan) {
    return 'target' in command && command.kind !== 'run'
      ? soccer.previewPass(match, command, plan).destination : soccer.commandTarget(match, command)
  },
  opponent: soccerAI,
  resolveTurn: soccer.resolveTurn,
  draw: drawSoccer,
  opponentDetail: match => soccer.SHAPE_NAMES[match.shapes[1]],
  clockDetail(match, portrait) {
    const forwards = soccer.direction(match, 0) === 1
    const attack = portrait ? (forwards ? 'up' : 'down') : (forwards ? 'right' : 'left')
    return `${match.turn <= soccer.HALF_TURNS ? '1st' : '2nd'} half · Attack ${attack}`
  },
}

const selector = document.getElementById('sport') as HTMLSelectElement
const defense = document.getElementById('defense') as HTMLSelectElement
const clubNav = document.getElementById('club-nav') as HTMLButtonElement
const clubScreen = document.getElementById('club-screen')!
const matchScreen = document.getElementById('match-screen')!
const warning = document.getElementById('save-warning')!
const key = 'turn-pro-club-v1'
let screen: 'quick' | 'club' | 'fixture' = 'quick'
let route = new AbortController()
let club: Club | null = null
let lastSaved: string | null = null

function warn(message: string) {
  warning.hidden = !message
  warning.textContent = message
}

function verifySave(raw: string) {
  const state = readClub(raw)
  if (state.pending) openClubFixture(state)
  return state
}

try {
  lastSaved = localStorage.getItem(key)
  if (lastSaved) club = verifySave(lastSaved)
} catch {
  warn('Could not open the local club save. You can import an earlier export from the club screen.')
}

function updateClub(next: Club) {
  club = next
  try {
    if (localStorage.getItem(key) !== lastSaved) {
      warn('The local save changed in another tab. Export this club to keep your current progress.')
      return
    }
    const json = JSON.stringify(next)
    localStorage.setItem(key, json)
    lastSaved = json
    warn('')
  } catch {
    warn('This browser could not save the club. Export the save from the club screen to keep your progress.')
  }
}

function changeScreen(next: typeof screen) {
  route.abort()
  route = new AbortController()
  screen = next
  clubScreen.hidden = next !== 'club'
  matchScreen.hidden = next === 'club'
  selector.hidden = next !== 'quick'
  document.getElementById('restart')!.hidden = next !== 'quick'
  document.getElementById('quick-defense')!.hidden = next !== 'quick'
  clubNav.textContent = next === 'club' ? 'Quick match' : next === 'fixture' ? 'Back to club' : 'Club season'
}

function basketballDefense(style: DefenseStyle): typeof basketballView {
  return { ...basketballView, opponent: (match, team) => basketballAI(match, team, style),
    opponentDetail: () => DEFENSE_NAMES[style] }
}

function showQuick(resetDefense: boolean) {
  changeScreen('quick')
  if (resetDefense) {
    const options = selector.value === 'soccer' ? soccer.SHAPE_NAMES : DEFENSE_NAMES
    defense.replaceChildren(...Object.entries(options).map(([value, label]) => new Option(label, value)))
  }
  if (selector.value === 'soccer') mountGame(soccerView, route.signal)
  else mountGame(basketballDefense(defense.value as DefenseStyle), route.signal)
}

function enterFixture() {
  if (!club) return
  const active = club.pending ? club : beginClubFixture(club)
  const session = openClubFixture(active)
  if (active !== club) updateClub(active)
  changeScreen('fixture')
  const saveTurn = (orders: readonly PlanCommand[], match: MatchSnapshot) => updateClub(saveClubTurn(club!, orders, match))
  if (session.sport === 'basketball') mountGame(basketballDefense(session.defense), route.signal, { ...session, saveTurn })
  else mountGame(soccerView, route.signal, { ...session, saveTurn })
}

function showClub() {
  changeScreen('club')
  const signal = route.signal
  mountClub(clubScreen, {
    getClub: () => club,
    update: updateClub,
    start: enterFixture,
    recruit: id => updateClub(recruit(club!, id)),
    train: (id, sport) => updateClub(train(club!, id, sport)),
    equip: (id, sport, technique) => updateClub(equip(club!, id, sport, technique)),
    specialize: (id, choice) => updateClub(specialize(club!, id, choice)),
    changeStarter: (sport, slot, id) => updateClub(setStarter(club!, sport, slot, id)),
    exportSave() {
      const file = new Blob([JSON.stringify(club, null, 2)], { type: 'application/json' })
      const href = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = href
      link.download = 'turn-pro-club.json'
      link.click()
      setTimeout(() => URL.revokeObjectURL(href), 1000)
    },
    async importSave(file) {
      if (file.size > 128_000) throw new Error('Invalid club save.')
      const raw = await file.text()
      if (!signal.aborted) updateClub(verifySave(raw))
    },
  }, signal)
}

selector.addEventListener('change', () => showQuick(true))
defense.addEventListener('change', () => showQuick(false))
clubNav.addEventListener('click', () => screen === 'club' ? showQuick(true) : showClub())
showQuick(true)

const learn = document.getElementById('learn-dialog') as HTMLDialogElement
document.getElementById('learn-nav')!.addEventListener('click', () => learn.showModal())
learn.addEventListener('click', event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button[data-learn]')
  if (!button) return
  learn.close()
  if (button.dataset.learn === 'club') {
    showClub()
  } else {
    selector.value = button.dataset.learn!
    showQuick(true)
    document.querySelector<HTMLButtonElement>('#practice-tools button')?.click()
    document.querySelector<HTMLButtonElement>('#lineup button[aria-pressed="true"]')?.focus()
  }
})

installGamepad()
