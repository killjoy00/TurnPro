import * as basketball from './basketball.ts'
import * as soccer from './soccer.ts'
import * as hockey from './hockey.ts'
import { planTurn as hockeyAI, type HockeyStyle } from './hockey-opponent.ts'
import * as football from './football.ts'
import { planTurn as footballAI, type FootballStyle } from './football-opponent.ts'
import { mountGame, type SeasonMatch, type SportView } from './game-view.ts'
import { DEFENSE_NAMES, planTurn as basketballAI, type DefenseStyle } from './opponent.ts'
import { planTurn as soccerAI } from './soccer-opponent.ts'
import { drawBasketball, drawFootball, drawHockey, drawSoccer } from './surfaces.ts'
import { equip, readClub, recruit, setStarter, specialize, train, type Club } from './club.ts'
import { beginClubFixture, openClubFixture, saveClubTurn } from './club-fixture.ts'
import { mountClub } from './club-view.ts'
import { teamNames, type MatchSnapshot, type PlanCommand } from './match.ts'
import { installGamepad } from './gamepad.ts'
import { installDisplaySettings } from './display-settings.ts'

declare const TURN_PRO_FULL_PROTOTYPE: boolean

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

function mountHockey(signal: AbortSignal, season?: SeasonMatch<hockey.Match, hockey.Command> & { style: HockeyStyle }) {
  const hockeyView: SportView<hockey.Match, hockey.Command> = {
    id: 'hockey',
    surfaceName: 'Ice rink',
    intro: 'Advance the puck, set up a one-timer, or call in fresh skaters from your goalie’s order list.',
    width: hockey.RINK.width,
    height: hockey.RINK.height,
    turnLimit: hockey.TURN_LIMIT,
    create: seed => hockey.createMatch(seed),
    limit: () => 3,
    practices: [{
      name: 'Practice a screened one-timer',
      intro: 'Pass to Vale while Okafor screens the goalie. Ready Vale’s shot on the same turn.',
      create: hockey.createRushPractice,
      steps: [
        { label: 'Reed · Pass to Vale', athlete: '0-0', kind: 'pass', target: '0-1' },
        { label: 'Vale · Ready one-timer', athlete: '0-1', kind: 'one-timer' },
        { label: 'Okafor · Screen the goalie', athlete: '0-2', kind: 'screen' },
      ],
    }],
    legalCommands: hockey.legalCommands,
    label: hockey.commandLabel,
    stamina: order => hockey.ACTIONS[order.kind].stamina,
    preview(match, order) {
      const athlete = hockey.athleteById(match, order.athlete)
      if (order.kind === 'change') return `${hockey.reserveStamina(match, athlete.team)}% line stamina · `
      if (order.kind === 'pass') {
        const receiver = hockey.athleteById(match, order.target)
        return `~${Math.round(hockey.passChance(match, athlete, receiver))}% now · `
      }
      if (order.kind === 'shoot' || order.kind === 'one-timer') {
        const shot = hockey.shotEstimate(match, athlete, false, order.kind === 'one-timer')
        return `~${shot.goal}% goal now · `
      }
      return ''
    },
    noOrders: athlete => athlete.role === 'GK' ? 'The goalie tracks the puck and handles saves automatically.'
      : 'Recover stamina on base assignments this turn.',
    previewTarget: hockey.commandTarget,
    opponent: (match, team) => hockeyAI(match, team, season?.style),
    resolveTurn: hockey.resolveTurn,
    draw: drawHockey,
    opponentDetail: match => `Line ${match.lines[1] + 1}`,
    lineupDetail: match => `On ice · Line ${match.lines[0] + 1} · Reserve ${hockey.reserveStamina(match, 0)}% stamina`,
    clockDetail(match, portrait) {
      const forwards = hockey.direction(match, 0) === 1
      const attack = portrait ? (forwards ? 'up' : 'down') : (forwards ? 'right' : 'left')
      return `Period ${hockey.period(match)} · Attack ${attack}`
    },
  }
  mountGame(hockeyView, signal, season)
}

function mountFootball(signal: AbortSignal, season?: SeasonMatch<football.Match, football.Command> & { style: FootballStyle }) {
  const footballView: SportView<football.Match, football.Command> = {
    id: 'football',
    turnName: 'Snap',
    surfaceName: 'Gridiron',
    intro: 'Pick a play with your quarterback and adjust two assignments. Blue marks the snap, gold marks the first down.',
    width: football.FIELD.width,
    height: football.FIELD.height,
    turnLimit: football.TURN_LIMIT,
    create: seed => football.createMatch(seed),
    practices: [{
      name: 'Practice third and five',
      intro: 'Go to Vale on a slant. Give Blake pass protection and commit all three orders on this snap.',
      create: football.createThirdDownPractice,
      steps: [
        { label: 'Reed · Quick pass to Vale', athlete: '0-o-0', kind: 'quick-pass', target: '0-o-7' },
        { label: 'Vale · Cut on a slant', athlete: '0-o-7', kind: 'slant' },
        { label: 'Blake · Pass protect', athlete: '0-o-2', kind: 'protect' },
      ],
    }],
    limit: () => 3,
    legalCommands: football.legalCommands,
    label: football.commandLabel,
    stamina: order => football.ACTIONS[order.kind].stamina,
    preview(match, order, plan) {
      if ('target' in order || order.kind === 'field-goal') {
        const reading = football.playEstimate(match, order, plan)
        return order.kind === 'field-goal' ? `~${reading.chance}% make · `
          : `~${reading.chance}% if thrown · ${reading.yards} yd route · `
      }
      if (order.kind === 'inside' || order.kind === 'sweep-left' || order.kind === 'sweep-right') {
        return `~${football.playEstimate(match, order, plan).yards} yd base · `
      }
      if (order.kind === 'slant') return 'Supports a quick pass · '
      if (order.kind === 'go') return 'Supports a deep pass · '
      return ''
    },
    noOrders: () => 'This athlete follows their base assignment and recovers stamina on this snap.',
    previewTarget: football.commandTarget,
    opponent: (match, team) => footballAI(match, team, season?.style),
    resolveTurn: football.resolveTurn,
    draw: drawFootball,
    clockDetail: match => `Q${football.quarter(match)} · ${football.downLabel(match)}`,
    opponentDetail: match => match.offense === 1 ? 'Offense' : 'Defense',
    lineupDetail(match, portrait) {
      const forward = football.direction(match, match.offense) === 1
      const attack = portrait ? (forward ? 'up' : 'down') : (forward ? 'right' : 'left')
      return `${teamNames(match)[match.offense]} offense · ${football.spotLabel(match.yard)} · Attack ${attack}`
    },
  }
  mountGame(footballView, signal, season)
}

const selector = document.getElementById('sport') as HTMLSelectElement
const defense = document.getElementById('defense') as HTMLSelectElement
const clubNav = document.getElementById('club-nav') as HTMLButtonElement
const clubScreen = document.getElementById('club-screen')!
const matchScreen = document.getElementById('match-screen')!
const warning = document.getElementById('save-warning')!
const prototypeKey = 'turn-pro-club-v1'
const key = TURN_PRO_FULL_PROTOTYPE ? prototypeKey : 'turn-pro-steam-preview-club-v1'
let screen: 'quick' | 'club' | 'fixture' = 'quick'
let route = new AbortController()
let club: Club | null = null
let lastSaved: string | null = null

function warn(message: string) {
  warning.hidden = !message
  warning.textContent = message
}

function supportsSeason(state: Club) {
  return TURN_PRO_FULL_PROTOTYPE || state.mode === 'both' || state.mode === 'basketball' || state.mode === 'soccer'
}

function verifyClub(state: Club) {
  if (!supportsSeason(state)) throw new Error('This season requires the four-sport build.')
  if (state.pending) openClubFixture(state)
  return state
}

try {
  lastSaved = localStorage.getItem(key)
  if (lastSaved) club = verifyClub(readClub(lastSaved))
  else if (!TURN_PRO_FULL_PROTOTYPE) {
    const previous = localStorage.getItem(prototypeKey)
    if (previous) {
      const state = readClub(previous)
      if (supportsSeason(state)) club = verifyClub(state)
    }
  }
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
  if (TURN_PRO_FULL_PROTOTYPE && (selector.value === 'hockey' || selector.value === 'football')) {
    document.getElementById('quick-defense')!.hidden = true
    if (selector.value === 'hockey') mountHockey(route.signal)
    else mountFootball(route.signal)
    return
  }
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
  else if (session.sport === 'soccer') mountGame(soccerView, route.signal, { ...session, saveTurn })
  else if (TURN_PRO_FULL_PROTOTYPE && session.sport === 'hockey') mountHockey(route.signal, { ...session, saveTurn })
  else if (TURN_PRO_FULL_PROTOTYPE && session.sport === 'football') mountFootball(route.signal, { ...session, saveTurn })
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
      if (!signal.aborted) updateClub(verifyClub(readClub(raw)))
    },
  }, signal, TURN_PRO_FULL_PROTOTYPE)
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

installDisplaySettings()
installGamepad()
