import {
  findAthlete, teamNames,
  type AthleteSnapshot, type MatchSnapshot, type PlanCommand, type Plans, type Team, type TurnEvent,
} from './match.ts'
import type { Point } from './math.ts'
import { TECHNIQUES } from './club.ts'
import type { LoggedTurn } from './club-fixture.ts'
import { trackMatch } from './playtest.ts'

declare const TURN_PRO_FULL_PROTOTYPE: boolean

export interface SportView<S extends MatchSnapshot, C extends PlanCommand> {
  id: 'basketball' | 'soccer' | 'hockey' | 'football'
  turnName?: string
  surfaceName: string
  intro: string
  width: number
  height: number
  turnLimit: number
  create(seed: number, budget: 3 | 4): S
  practices?: { name: string; create(budget: 3 | 4): S; intro: string; steps: readonly PracticeStep[] }[]
  limit(match: S): number
  legalCommands(match: S, id: string): C[]
  label(match: S, command: C): string
  stamina(command: C): number
  preview(match: S, command: C, plan: readonly C[]): string
  noOrders(athlete: AthleteSnapshot): string
  previewTarget(match: S, command: C, plan: readonly C[]): Point | undefined
  opponent(match: S, team: Team): C[]
  resolveTurn(match: S, plans: Plans<C>): { match: S; events: TurnEvent[] }
  draw(context: CanvasRenderingContext2D, match: S): void
  clockDetail(match: S, portrait: boolean): string
  opponentDetail(match: S): string
  lineupDetail?(match: S, portrait: boolean): string
}

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T
}

const scoreboard = element('scoreboard')
const possession = element('possession')
const markers = element('markers')
const lineup = element('lineup')
const lineupDetail = element('lineup-detail')
const budget = element('budget')
const orders = element('orders')
const actions = element('actions')
const commit = element<HTMLButtonElement>('commit')
const note = element('commit-note')
const summary = element('summary')
const turns = element('turns')
const canvas = element<HTMLCanvasElement>('court-lines')
const context = canvas.getContext('2d')!

interface PracticeStep {
  label: string
  athlete: string
  kind: string
  target?: string | number
}

export interface SeasonMatch<S extends MatchSnapshot, C extends PlanCommand> {
  match: S
  history: LoggedTurn[]
  saveTurn(orders: readonly C[], match: S): void
}

export function mountGame<S extends MatchSnapshot, C extends PlanCommand>(
  sport: SportView<S, C>, signal: AbortSignal, season?: SeasonMatch<S, C>,
) {
  const budgetPreset = element('budget-preset')
  const practice = element('practice-tools')
  const checklist = element('practice-checklist')
  let steps: readonly PracticeStep[] = []
  let coached = false
  const stepReady = ({ athlete, kind, target }: PracticeStep) =>
    plan.some(order => order.athlete === athlete && order.kind === kind && order.target === target)
  const budgetInput = element<HTMLSelectElement>('budget-mode')
  const nextBudget = () => budgetInput.value === '4' ? 4 : 3
  const portrait = matchMedia('(max-width: 560px)')
  const isPortrait = () => sport.id !== 'basketball' && portrait.matches
  let match = season?.match ?? sport.create(2026, nextBudget())
  let track = TURN_PRO_FULL_PROTOTYPE ? trackMatch(sport.id, season ? 'club fixture' : 'quick match') : undefined
  let selected = selectPlayer()
  let plan: C[] = []
  const teams = teamNames(match)
  const restartButton = element<HTMLButtonElement>('restart')
  const turnName = sport.turnName ?? 'Turn'
  restartButton.hidden = Boolean(season)
  commit.innerHTML = `Commit ${turnName.toLowerCase()} <span aria-hidden="true">→</span>`

  function selectPlayer(): string {
    const holder = findAthlete(match.athletes, match.holder)
    return holder.team === 0 ? holder.id : match.athletes.find(player => player.team === 0 && player.role !== 'GK')!.id
  }

  function project(point: Point): Point {
    return isPortrait() ? { x: point.y / sport.height, y: 1 - point.x / sport.width }
      : { x: point.x / sport.width, y: point.y / sport.height }
  }

  function drawBoard() {
    if (isPortrait()) {
      context.setTransform(0, -canvas.height / sport.width, canvas.width / sport.height, 0, 0, canvas.height)
    } else {
      context.setTransform(canvas.width / sport.width, 0, 0, canvas.height / sport.height, 0, 0)
    }
    sport.draw(context, match)
    context.strokeStyle = sport.id === 'soccer' || sport.id === 'football' ? '#e3fc9b'
      : sport.id === 'hockey' ? '#204e6a' : '#194f43'
    context.lineWidth = sport.id === 'basketball' ? 0.28 : 0.5
    context.setLineDash([0.8, 0.55])
    for (const command of plan) {
      const from = findAthlete(match.athletes, command.athlete).position
      const to = sport.previewTarget(match, command, plan)
      if (!to) continue
      context.beginPath()
      context.moveTo(from.x, from.y)
      context.lineTo(to.x, to.y)
      context.stroke()
    }
    context.setLineDash([])
  }

  function renderScore() {
    const [home, away] = match.score
    const clock = (match.turn > sport.turnLimit)
      ? `<strong>Final</strong>${home === away ? 'Draw' : `${teams[home > away ? 0 : 1]} win`}`
      : `<strong>${turnName} ${match.turn} / ${sport.turnLimit}</strong>${sport.clockDetail(match, isPortrait())}`
    scoreboard.innerHTML = `
      <div class="team-score home">
        <div class="team-name"><b>${teams[0]}</b><small>You</small></div><strong class="points">${home}</strong>
      </div>
      <div class="turn-clock">${clock}</div>
      <div class="team-score away">
        <strong class="points">${away}</strong><div class="team-name"><b>${teams[1]}</b><small>${sport.opponentDetail(match)}</small></div>
      </div>`
  }

  function renderBoard() {
    const holder = findAthlete(match.athletes, match.holder)
    possession.classList.toggle('away', holder.team === 1)
    const object = sport.id === 'hockey' ? 'puck' : 'ball'
    possession.innerHTML = (match.turn > sport.turnLimit) ? 'Match complete' : `${sport.id === 'hockey' ? 'Puck' : 'Ball'} <strong>${teams[holder.team]} · ${holder.name}</strong>`
    markers.innerHTML = match.athletes.map(athlete => {
      const ownsBall = athlete.id === holder.id && !(match.turn > sport.turnLimit)
      const queued = plan.some(command => command.athlete === athlete.id)
      const description = `${teams[athlete.team]} ${athlete.name}, number ${athlete.number}${ownsBall ? `, has the ${object}` : ''}${queued ? ', command queued' : ''}`
      const position = project(athlete.position)
      return `<button type="button" class="marker ${athlete.team ? 'away' : 'home'} ${queued ? 'queued' : ''}"
        style="left:${position.x * 100}%;top:${position.y * 100}%"
        aria-label="${description}" title="${description}" aria-pressed="${selected === athlete.id}" data-athlete="${athlete.id}">
        ${athlete.number}${ownsBall ? '<i class="ball" aria-hidden="true"></i>' : ''}
      </button>`
    }).join('')
    lineup.innerHTML = match.athletes.filter(athlete => athlete.team === 0).map(athlete =>
      `<button type="button" data-athlete="${athlete.id}" aria-pressed="${selected === athlete.id}"
         aria-label="${athlete.name}, ${athlete.stamina} stamina">
        <span class="player-line"><span>${sport.id !== 'basketball' ? athlete.role : athlete.number}</span><b>${athlete.name}</b></span>
        <span class="stamina-bar" aria-hidden="true"><i class="${athlete.stamina < 40 ? 'low' : ''}" style="width:${athlete.stamina}%"></i></span>
      </button>`).join('')
    lineupDetail.textContent = sport.lineupDetail?.(match, isPortrait()) ?? ''
    lineupDetail.hidden = !sport.lineupDetail
    drawBoard()
  }

  function availableCommands(): C[] {
    const athlete = findAthlete(match.athletes, selected)
    if (athlete.team !== 0) return []
    if (plan.length >= sport.limit(match) && !plan.some(command => command.athlete === selected)) return []
    return sport.legalCommands(match, selected)
  }

  function renderPlan() {
    budget.textContent = `${plan.length} / ${sport.limit(match)} commands`
    orders.innerHTML = plan.length ? `<ul>${plan.map(command => {
      const athlete = findAthlete(match.athletes, command.athlete)
      const detail = sport.preview(match, command, plan).replace(/ · $/, '')
      return `<li><span><strong>${athlete.name}</strong> · ${sport.label(match, command)}${detail ? `<small>${detail}</small>` : ''}</span>
        <button type="button" class="remove" data-remove="${athlete.id}" aria-label="Remove ${athlete.name}'s command">×</button></li>`
    }).join('')}</ul>` : ''

    if ((match.turn > sport.turnLimit)) {
      actions.innerHTML = season
        ? '<p class="instructions">Fixture recorded. Return to the club to see the result and prepare for the next match.</p>'
        : '<p class="instructions">Review the play-by-play or start a new match.</p>'
      commit.disabled = true
      note.textContent = ''
      return
    }

    const athlete = findAthlete(match.athletes, selected)
    const commands = availableCommands()
    const active = plan.find(command => command.athlete === athlete.id)
    const endOfBudget = plan.length >= sport.limit(match) && !active
    const instruction = athlete.team !== 0 ? 'Select a Comets athlete to give an order.'
      : endOfBudget ? 'Remove an order or select a teammate with a queued command.'
      : commands.length === 0 ? sport.noOrders(athlete)
      : active ? 'Choose another order to replace the one queued.'
      : 'Choose an order. Uncommanded teammates follow their assignments.'

    actions.innerHTML = `<div class="athlete-header">
      <b>${athlete.name}</b><small>${athlete.role}</small><span class="stamina-value">STA ${athlete.stamina}</span>
      </div><p class="instructions">${instruction}</p>
      ${athlete.technique ? `<p class="practice-ability">${TECHNIQUES[athlete.technique].label} · ${TECHNIQUES[athlete.technique].detail}</p>` : ''}
      <ul class="options" ${commands.length ? '' : 'hidden'}>${commands.map((command, index) => {
        const label = sport.label(match, command)
        const detail = sport.preview(match, command, plan)
        return `<li><button class="option" type="button" data-command="${index}"
        aria-pressed="${Boolean(active && sport.label(match, active) === label)}">
          <span>${label}</span><small>${detail}−${sport.stamina(command)} STA</small>
        </button></li>`
      }).join('')}</ul>`
    checklist.hidden = !steps.length && !coached
    checklist.innerHTML = coached ? '<p>Practice play resolved. See the play-by-play for the outcome.</p>' : steps.length
      ? '<ol>' + steps.map(step => '<li>' + (stepReady(step) ? 'Queued · ' : '') + step.label + '</li>').join('') + '</ol>' : ''
    commit.disabled = steps.some(step => !stepReady(step))
    note.textContent = commit.disabled ? 'Queue the practice orders to continue.' : plan.length ? 'Both teams reveal after you commit.' : 'No orders queued. Commit to use base assignments.'
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

  markers.addEventListener('click', event => selectAthlete(markers, event), { signal })
  lineup.addEventListener('click', event => selectAthlete(lineup, event), { signal })

  actions.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-command]')
    if (!button) return
    const command = availableCommands()[Number(button.dataset.command)]
    if (!command) return
    plan = [...plan.filter(previous => previous.athlete !== command.athlete), command]
    renderBoard()
    renderPlan()
    actions.querySelector<HTMLButtonElement>(`[data-command="${button.dataset.command}"]`)?.focus()
  }, { signal })

  orders.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-remove]')
    if (!button?.dataset.remove) return
    selected = button.dataset.remove
    plan = plan.filter(command => command.athlete !== selected)
    renderBoard()
    renderPlan()
    lineup.querySelector<HTMLButtonElement>(`[data-athlete="${selected}"]`)?.focus()
  }, { signal })

  function recordTurn(turn: number, events: TurnEvent[], score = match.score) {
    const important = events.find(event => event.kind === 'score')
      ?? events.find(event => event.kind === 'turnover')
      ?? events.find(event => event.kind === 'save')
      ?? events.find(event => event.kind === 'rebound')
      ?? events.find(event => event.kind === 'ball')
      ?? events.find(event => event.kind === 'possession')
      ?? events.find(event => event.kind === 'restart')
      ?? events.find(event => event.kind === 'finish')
      ?? events.find(event => event.kind === 'movement')
    const message = important?.text ?? 'Both teams adjust their positions.'
    summary.textContent = `${turnName} ${turn} · ${message}`
    for (const history of turns.querySelectorAll('details[open]')) history.removeAttribute('open')
    const detail = document.createElement('details')
    detail.className = 'turn'
    detail.open = true
    detail.innerHTML = `<summary>${turnName} ${turn} · ${score.join('–')}<small>${message}</small></summary>
      <ul class="timeline">${events.map(event => `<li class="${event.kind}">${event.text}</li>`).join('')}</ul>`
    turns.prepend(detail)
  }

  commit.addEventListener('click', () => {
    if (match.turn > sport.turnLimit || commit.disabled) return
    const turn = match.turn
    const opponent = sport.opponent(match, 1)
    const resolution = sport.resolveTurn(match, [plan, opponent])
    season?.saveTurn(plan, resolution.match)
    match = resolution.match
    track?.(turn, match.score, Boolean(steps.length) || match.turn > sport.turnLimit)
    if (steps.length) {
      steps = []
      coached = true
      if (TURN_PRO_FULL_PROTOTYPE) track = trackMatch(sport.id, 'quick match')
    }
    plan = []
    selected = selectPlayer()
    render()
    recordTurn(turn, resolution.events)
    if (match.turn > sport.turnLimit) (season ? element<HTMLButtonElement>('club-nav') : restartButton).focus()
  }, { signal })

  function restart(next: S, message: string, practiceSteps: readonly PracticeStep[] = []) {
    steps = practiceSteps
    coached = false
    match = next
    if (TURN_PRO_FULL_PROTOTYPE) track = trackMatch(sport.id, practiceSteps.length ? 'practice' : 'quick match')
    selected = selectPlayer()
    plan = []
    turns.replaceChildren()
    summary.textContent = message
    render()
  }

  if (!season) {
    restartButton.addEventListener('click', () => {
      restart(sport.create((match.seed + 1) >>> 0, nextBudget()), sport.id === 'hockey' ? 'New match. The Comets start with the puck.' : 'New match. The Comets start with the ball.')
    }, { signal })
  }

  practice.replaceChildren()
  if (!season) {
    for (const drill of sport.practices ?? []) {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = drill.name
      button.addEventListener('click', () => restart(drill.create(nextBudget()), drill.intro, drill.steps), { signal })
      practice.append(button)
    }
  }
  summary.textContent = sport.intro
  turns.replaceChildren()
  for (const entry of season?.history ?? []) recordTurn(entry.turn, entry.events, entry.score)
  document.body.classList.toggle('soccer', sport.id === 'soccer')
  document.body.classList.toggle('hockey', sport.id === 'hockey')
  document.body.classList.toggle('football', sport.id === 'football')
  element('court-title').textContent = sport.surfaceName
  const markerLabels = { soccer: 'Athletes on pitch', hockey: 'Players on ice', football: 'Players on field', basketball: 'Athletes on court' }
  markers.setAttribute('aria-label', markerLabels[sport.id])
  budgetPreset.hidden = Boolean(season) || sport.id !== 'soccer'
  practice.hidden = Boolean(season) || !sport.practices?.length
  portrait.addEventListener('change', render, { signal })

  render()
}
