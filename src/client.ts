import * as basketball from './basketball.ts'
import * as soccer from './soccer.ts'
import { mountGame, type SportView } from './game-view.ts'
import { planTurn as basketballAI } from './opponent.ts'
import { planTurn as soccerAI } from './soccer-opponent.ts'
import { drawBasketball, drawSoccer } from './surfaces.ts'

const basketballView: SportView<basketball.Match, basketball.Command> = {
  id: 'basketball',
  surfaceName: 'Half court',
  intro: 'Select a Comets athlete on the court or in the lineup to plan the first turn.',
  width: basketball.COURT.width,
  height: basketball.COURT.length,
  turnLimit: basketball.TURN_LIMIT,
  create: seed => basketball.createMatch(seed),
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
}

const soccerView: SportView<soccer.Match, soccer.Command> = {
  id: 'soccer',
  surfaceName: 'Full pitch',
  intro: 'Start with a carry or pass at midfield. Queue a teammate’s run to open a lane.',
  width: soccer.PITCH.width,
  height: soccer.PITCH.length,
  turnLimit: soccer.TURN_LIMIT,
  create: (seed, limit) => soccer.createMatch(seed, 0, limit),
  practice: {
    create: soccer.createCrossingPractice,
    intro: 'Queue Vale’s cross to Adeyemi. Send Adeyemi into the middle, then commit.',
  },
  limit: match => match.commandLimit,
  legalCommands: soccer.legalCommands,
  label: soccer.commandLabel,
  stamina: command => soccer.ACTIONS[command.kind].stamina,
  preview(match, command) {
    const player = soccer.athleteById(match, command.athlete)
    if (command.kind === 'shoot') {
      return `~${soccer.shotEstimate(match, player).goal}% goal now · `
    }
    if ('target' in command && command.kind !== 'run') {
      const receiver = soccer.athleteById(match, command.target)
      if (soccer.startsOffside(match, player, receiver)) return 'Offside · '
    }
    return ''
  },
  noOrders: athlete => athlete.role === 'GK'
    ? 'Your keeper tracks the ball and attempts saves automatically.'
    : 'Recover stamina while your team keeps its shape.',
  previewTarget: soccer.commandTarget,
  opponent: soccerAI,
  resolveTurn: soccer.resolveTurn,
  draw: drawSoccer,
  clockDetail(match, portrait) {
    const forwards = soccer.direction(match, 0) === 1
    const attack = portrait ? (forwards ? 'up' : 'down') : (forwards ? 'right' : 'left')
    return `${match.turn <= soccer.HALF_TURNS ? '1st' : '2nd'} half · Attack ${attack}`
  },
}

const selector = document.getElementById('sport') as HTMLSelectElement
let game: AbortController | undefined
function changeSport() {
  game?.abort()
  game = new AbortController()
  if (selector.value === 'soccer') mountGame(soccerView, game.signal)
  else mountGame(basketballView, game.signal)
}
selector.addEventListener('change', changeSport)
changeSport()
