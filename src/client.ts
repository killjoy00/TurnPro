import {
  ACTIONS, athleteById, COMMAND_LIMIT, commandLabel, COURT, createMatch, finished, LANDMARKS,
  legalCommands, possessionTeam, resolveTurn, shotEstimate, TEAMS, TURN_LIMIT,
  type Command, type Match, type TurnEvent,
} from './basketball.ts'
import { planTurn } from './opponent.ts'

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T
}

const scoreboard = element('scoreboard')
const possession = element('possession')
const markers = element('markers')
const lineup = element('lineup')
const budget = element('budget')
const orders = element('orders')
const actions = element('actions')
const commit = element<HTMLButtonElement>('commit')
const note = element('commit-note')
const summary = element('summary')
const turns = element('turns')
const canvas = element<HTMLCanvasElement>('court-lines')
const context = canvas.getContext('2d')!

const STARTING_SEED = 2026
let match = createMatch(STARTING_SEED)
let selected = match.holder
let plan: Command[] = []

function drawCourt() {
  const scaleX = canvas.width / COURT.width
  const scaleY = canvas.height / COURT.length
  context.setTransform(scaleX, 0, 0, scaleY, 0, 0)
  context.fillStyle = '#d8bb88'
  context.fillRect(0, 0, COURT.width, COURT.length)
  for (let y = 0; y < COURT.length; y += 1.1) {
    context.fillStyle = Math.round(y / 1.1) % 2 ? '#ae885512' : '#fff2cc17'
    context.fillRect(0, y, COURT.width, 1.1)
  }

  const hoop = COURT.hoop
  context.lineWidth = 0.19
  context.strokeStyle = '#345652'
  context.strokeRect(0.25, 0.25, COURT.width - 0.5, COURT.length - 0.5)
  context.fillStyle = '#145f5650'
  context.fillRect(17, 0, 16, 19)
  context.strokeRect(17, 0, 16, 19)
  context.beginPath()
  context.arc(25, 19, 6, 0, Math.PI)
  context.stroke()
  context.beginPath()
  context.setLineDash([0.8, 0.5])
  context.arc(25, 19, 6, Math.PI, Math.PI * 2)
  context.stroke()
  context.setLineDash([])
  context.beginPath()
  context.arc(hoop.x, hoop.y, COURT.arc, Math.asin(-hoop.y / COURT.arc), Math.PI - Math.asin(-hoop.y / COURT.arc))
  context.stroke()
  context.beginPath()
  context.arc(25, 47, 6, Math.PI, Math.PI * 2)
  context.stroke()
  context.beginPath()
  context.moveTo(22, 4)
  context.lineTo(28, 4)
  context.stroke()
  context.strokeStyle = '#8b412c'
  context.lineWidth = 0.24
  context.beginPath()
  context.arc(hoop.x, hoop.y, 0.85, 0, Math.PI * 2)
  context.stroke()

  for (const command of plan) {
    const from = athleteById(match, command.athlete).position
    const to = command.kind === 'cut' ? LANDMARKS[command.target]
      : 'target' in command ? athleteById(match, command.target).position : undefined
    if (!to) continue
    context.strokeStyle = '#194f43'
    context.lineWidth = 0.28
    context.setLineDash([0.6, 0.45])
    context.beginPath()
    context.moveTo(from.x, from.y)
    context.lineTo(to.x, to.y)
    context.stroke()
    context.setLineDash([])
  }
}

function renderScore() {
  const [home, away] = match.score
  const clock = finished(match)
    ? `<strong>Final</strong>${home === away ? 'Draw' : `${TEAMS[home > away ? 0 : 1]} win`}`
    : `<strong>Turn ${match.turn} / ${TURN_LIMIT}</strong>Planning`
  scoreboard.innerHTML = `
    <div class="team-score home">
      <div class="team-name"><b>${TEAMS[0]}</b><small>You</small></div><strong class="points">${home}</strong>
    </div>
    <div class="turn-clock">${clock}</div>
    <div class="team-score away">
      <strong class="points">${away}</strong><div class="team-name"><b>${TEAMS[1]}</b><small>CPU</small></div>
    </div>`
}

function renderBoard() {
  const holder = athleteById(match, match.holder)
  possession.classList.toggle('away', holder.team === 1)
  possession.innerHTML = finished(match) ? 'Match complete' : `Ball <strong>${TEAMS[holder.team]} · ${holder.name}</strong>`
  markers.innerHTML = match.athletes.map(athlete => {
    const ownsBall = athlete.id === holder.id && !finished(match)
    const queued = plan.some(command => command.athlete === athlete.id)
    const description = `${TEAMS[athlete.team]} ${athlete.name}, number ${athlete.number}${ownsBall ? ', has the ball' : ''}${queued ? ', command queued' : ''}`
    return `<button type="button" class="marker ${athlete.team ? 'away' : 'home'} ${queued ? 'queued' : ''}"
      style="left:${athlete.position.x / COURT.width * 100}%;top:${athlete.position.y / COURT.length * 100}%"
      aria-label="${description}" title="${description}" aria-pressed="${selected === athlete.id}" data-athlete="${athlete.id}">
      ${athlete.number}${ownsBall ? '<i class="ball" aria-hidden="true"></i>' : ''}
    </button>`
  }).join('')
  lineup.innerHTML = match.athletes.filter(athlete => athlete.team === 0).map(athlete =>
    `<button type="button" data-athlete="${athlete.id}" aria-pressed="${selected === athlete.id}"
       aria-label="${athlete.name}, ${athlete.stamina} stamina">
      <span class="player-line"><span>${athlete.number}</span><b>${athlete.name}</b></span>
      <span class="stamina-bar" aria-hidden="true"><i class="${athlete.stamina < 40 ? 'low' : ''}" style="width:${athlete.stamina}%"></i></span>
    </button>`).join('')
  drawCourt()
}

function availableCommands(): Command[] {
  const athlete = athleteById(match, selected)
  if (athlete.team !== 0) return []
  if (plan.length >= COMMAND_LIMIT && !plan.some(command => command.athlete === selected)) return []
  return legalCommands(match, selected)
}

function renderPlan() {
  budget.textContent = `${plan.length} / ${COMMAND_LIMIT} commands`
  orders.innerHTML = plan.length ? `<ul>${plan.map(command => {
    const athlete = athleteById(match, command.athlete)
    return `<li><span><strong>${athlete.name}</strong> · ${commandLabel(match, command)}</span>
      <button type="button" class="remove" data-remove="${athlete.id}" aria-label="Remove ${athlete.name}'s command">×</button></li>`
  }).join('')}</ul>` : ''

  if (finished(match)) {
    actions.innerHTML = '<p class="instructions">Review the play-by-play or start a new match.</p>'
    commit.disabled = true
    note.textContent = ''
    return
  }

  const athlete = athleteById(match, selected)
  const commands = availableCommands()
  const active = plan.find(command => command.athlete === athlete.id)
  const endOfBudget = plan.length >= COMMAND_LIMIT && !active
  const instruction = athlete.team !== 0 ? 'Select a Comets athlete to give an order.'
    : endOfBudget ? 'Remove an order or select a teammate with a queued command.'
    : commands.length === 0 ? 'Recover stamina on base assignments this turn.'
    : active ? 'Choose another order to replace the one queued.'
    : 'Choose an order. Uncommanded teammates follow their assignments.'

  actions.innerHTML = `<div class="athlete-header">
    <b>${athlete.name}</b><small>${athlete.role}</small><span class="stamina-value">STA ${athlete.stamina}</span>
    </div><p class="instructions">${instruction}</p>
    <ul class="options" ${commands.length ? '' : 'hidden'}>${commands.map((command, index) => {
      const label = commandLabel(match, command)
      const shot = command.kind === 'shoot' ? shotEstimate(match, athlete) : null
      const detail = shot ? `${shot.points} pt · ~${shot.chance}% now · ` : ''
      return `<li><button class="option" type="button" data-command="${index}"
      aria-pressed="${Boolean(active && commandLabel(match, active) === label)}">
        <span>${label}</span><small>${detail}−${ACTIONS[command.kind].stamina} STA</small>
      </button></li>`
    }).join('')}</ul>`
  commit.disabled = false
  note.textContent = plan.length ? 'Both teams reveal after you commit.' : 'No orders queued. Commit to use base assignments.'
}

function render() {
  renderScore()
  renderBoard()
  renderPlan()
}

function selectAthlete(container: HTMLElement, event: MouseEvent) {
  const button = (event.target as Element).closest<HTMLButtonElement>('button[data-athlete]')
  if (!button?.dataset.athlete) return
  selected = button.dataset.athlete
  renderBoard()
  renderPlan()
  container.querySelector<HTMLButtonElement>(`[data-athlete="${selected}"]`)?.focus()
}

markers.addEventListener('click', event => selectAthlete(markers, event))
lineup.addEventListener('click', event => selectAthlete(lineup, event))

actions.addEventListener('click', event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button[data-command]')
  if (!button) return
  const command = availableCommands()[Number(button.dataset.command)]
  if (!command) return
  plan = [...plan.filter(previous => previous.athlete !== command.athlete), command]
  renderBoard()
  renderPlan()
  actions.querySelector<HTMLButtonElement>(`[data-command="${button.dataset.command}"]`)?.focus()
})

orders.addEventListener('click', event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button[data-remove]')
  if (!button?.dataset.remove) return
  selected = button.dataset.remove
  plan = plan.filter(command => command.athlete !== selected)
  renderBoard()
  renderPlan()
  lineup.querySelector<HTMLButtonElement>(`[data-athlete="${selected}"]`)?.focus()
})

function recordTurn(turn: number, events: TurnEvent[]) {
  const important = events.find(event => event.kind === 'finish')
    ?? events.find(event => event.kind === 'score')
    ?? events.find(event => event.kind === 'turnover')
    ?? events.find(event => event.kind === 'possession')
    ?? events.find(event => event.kind === 'rebound')
    ?? events.find(event => event.kind === 'ball')
    ?? events.find(event => event.kind === 'movement')
  const message = important?.text ?? 'Both teams adjust their positions.'
  summary.textContent = `Turn ${turn} · ${message}`
  for (const history of turns.querySelectorAll('details[open]')) history.removeAttribute('open')
  const detail = document.createElement('details')
  detail.className = 'turn'
  detail.open = true
  detail.innerHTML = `<summary>Turn ${turn} · ${match.score.join('–')}</summary>
    <ul class="timeline">${events.map(event => `<li class="${event.kind}">${event.text}</li>`).join('')}</ul>`
  turns.prepend(detail)
}

commit.addEventListener('click', () => {
  if (finished(match)) return
  const turn = match.turn
  const opponent = planTurn(match, 1)
  const resolution = resolveTurn(match, [plan, opponent])
  match = resolution.match
  plan = []
  selected = possessionTeam(match) === 0 ? match.holder : '0-0'
  render()
  recordTurn(turn, resolution.events)
  if (finished(match)) element<HTMLButtonElement>('restart').focus()
})

element<HTMLButtonElement>('restart').addEventListener('click', () => {
  match = createMatch((match.seed + 1) >>> 0)
  selected = match.holder
  plan = []
  turns.replaceChildren()
  summary.textContent = 'New match. The Comets start with the ball.'
  render()
})

summary.textContent = 'Select a Comets athlete on the court or in the lineup to plan the first turn.'
render()
