const ACTIONS = [
  ['select', 'Select', 0],
  ['back', 'Back', 1],
  ['lineup', 'Lineup / orders', 2],
  ['commit', 'Commit turn', 3],
  ['controls', 'Controls', 9],
] as const

type Action = typeof ACTIONS[number][0]
type Bindings = Record<Action, number>
type Direction = 'up' | 'down' | 'left' | 'right'
const BUTTONS: Readonly<Record<number, string>> = {
  0: 'South face button', 1: 'East face button', 2: 'West face button', 3: 'North face button',
  4: 'Left bumper', 5: 'Right bumper', 8: 'View button', 9: 'Menu button', 10: 'Left stick press', 11: 'Right stick press',
}
const CONTROLS_KEY = 'turn-pro-controller-v1'
const defaults = () => Object.fromEntries(ACTIONS.map(([id, , button]) => [id, button])) as Bindings

function loadBindings(): Bindings {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(CONTROLS_KEY) ?? 'null')
    if (saved && typeof saved === 'object') {
      const choices = ACTIONS.map(([id]) => (saved as Record<string, unknown>)[id])
      if (choices.every(button => Number.isInteger(button) && Object.hasOwn(BUTTONS, button as number))
        && new Set(choices).size === ACTIONS.length) {
        return Object.fromEntries(ACTIONS.map(([id], index) => [id, choices[index]])) as Bindings
      }
    }
  } catch {
    return defaults()
  }
  return defaults()
}

function modal() {
  return [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1)
}

function visible(element: HTMLElement | null): element is HTMLElement {
  return element !== null && element.getClientRects().length > 0 && !element.matches(':disabled') && !element.closest('[inert]')
}

function focusable(): HTMLElement[] {
  const root = modal() ?? document
  return [...root.querySelectorAll<HTMLElement>('button, select, input[type="file"], a[href], details > summary')]
    .filter(visible)
}

function focus(element: HTMLElement | undefined) {
  element?.focus({ preventScroll: true })
  element?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

function initialFocus(items = focusable()) {
  focus(items.find(element => element.hasAttribute('data-controller-start')) ?? items[0])
}

function point(element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

function move(direction: Direction) {
  const items = focusable()
  const active = document.activeElement as HTMLElement
  const index = items.indexOf(active)
  if (index < 0) {
    initialFocus(items)
    return
  }
  const origin = point(active)
  const horizontal = direction === 'left' || direction === 'right'
  const sign = direction === 'right' || direction === 'down' ? 1 : -1
  const target = items.map(element => {
    const candidate = point(element)
    const ahead = (horizontal ? candidate.x - origin.x : candidate.y - origin.y) * sign
    const across = Math.abs(horizontal ? candidate.y - origin.y : candidate.x - origin.x)
    return { element, score: ahead > 3 ? ahead + across * 2.3 : Infinity }
  }).filter(choice => Number.isFinite(choice.score)).sort((a, b) => a.score - b.score)[0]?.element
  focus(target ?? items[(items.length + index + sign) % items.length])
}

function axis(pad: Gamepad): Direction | undefined {
  if (pad.buttons[12]?.pressed) return 'up'
  if (pad.buttons[13]?.pressed) return 'down'
  if (pad.buttons[14]?.pressed) return 'left'
  if (pad.buttons[15]?.pressed) return 'right'
  const [x = 0, y = 0] = pad.axes
  if (Math.max(Math.abs(x), Math.abs(y)) < 0.55) return undefined
  if (Math.abs(x) > Math.abs(y)) return x < 0 ? 'left' : 'right'
  return y < 0 ? 'up' : 'down'
}

export function installGamepad() {
  const dialog = document.getElementById('controls-dialog') as HTMLDialogElement
  const rows = document.getElementById('bindings')!
  const message = document.getElementById('binding-message')!
  let bindings = loadBindings()
  let pending: Action | undefined
  let select: { element: HTMLSelectElement; initial: number } | undefined
  let previousButtons: boolean[] = []
  let previousDirection: Direction | undefined
  let heldUntil = 0
  let connected: number | undefined

  function render() {
    rows.innerHTML = ACTIONS.map(([action, label]) => `<button type="button" class="binding" data-binding="${action}">
      <span>${label}</span><b>${pending === action ? 'Press a button' : BUTTONS[bindings[action]]}</b></button>`).join('')
  }

  function store() {
    try {
      localStorage.setItem(CONTROLS_KEY, JSON.stringify(bindings))
      message.textContent = 'Controller bindings saved.'
    } catch {
      message.textContent = 'Controller bindings apply for this session.'
    }
    render()
  }

  function stopSelect(confirm: boolean) {
    const choice = select
    if (!choice) return
    select = undefined
    choice.element.classList.remove('controller-choosing')
    if (confirm && choice.element.selectedIndex !== choice.initial) {
      choice.element.dispatchEvent(new Event('change', { bubbles: true }))
    } else {
      choice.element.selectedIndex = choice.initial
    }
  }

  function startSettings() {
    if (!modal()) dialog.showModal()
  }

  document.getElementById('controls-nav')!.addEventListener('click', startSettings)
  dialog.addEventListener('close', () => {
    pending = undefined
    message.textContent = ''
    render()
  })
  rows.addEventListener('click', event => {
    const target = (event.target as Element).closest<HTMLButtonElement>('button[data-binding]')
    if (!target) return
    pending = target.dataset.binding as Action
    message.textContent = 'Press a face button, bumper, stick button, or menu button to assign it.'
    render()
    focus(rows.querySelector<HTMLButtonElement>(`[data-binding="${pending}"]`) ?? undefined)
  })
  document.getElementById('reset-bindings')!.addEventListener('click', () => {
    bindings = defaults()
    pending = undefined
    store()
  })
  for (const event of ['pointerdown', 'keydown'] as const) {
    document.addEventListener(event, () => {
      document.body.classList.remove('controller-active')
      stopSelect(false)
    })
  }

  function act(action: Action) {
    const active = document.activeElement
    if (action === 'select') {
      if (select) {
        stopSelect(true)
      } else if (active instanceof HTMLSelectElement && visible(active)) {
        select = { element: active, initial: active.selectedIndex }
        active.classList.add('controller-choosing')
      } else if (active instanceof HTMLElement && focusable().includes(active)) {
        const bounds = point(active)
        active.click()
        if (!visible(document.activeElement as HTMLElement) || document.activeElement === document.body) {
          const nearest = focusable().sort((a, b) => {
            const ap = point(a)
            const bp = point(b)
            return Math.hypot(ap.x - bounds.x, ap.y - bounds.y) - Math.hypot(bp.x - bounds.x, bp.y - bounds.y)
          })[0]
          focus(nearest)
        }
      } else {
        initialFocus()
      }
    } else if (action === 'back') {
      if (select) stopSelect(false)
      else if (modal()) modal()!.close()
      else if (document.querySelector('#club-screen:not([hidden]), #sport[hidden]')) document.getElementById('club-nav')!.click()
    } else if (action === 'controls') {
      startSettings()
    } else if (!select && !modal() && document.querySelector('#match-screen:not([hidden])')) {
      if (action === 'commit') {
        const button = document.getElementById('commit') as HTMLButtonElement
        if (!button.disabled) {
          focus(button)
          button.click()
        }
      } else if (action === 'lineup') {
        const selector = active?.closest('#lineup') ? '#actions .option' : '#lineup [aria-pressed="true"]'
        focus(document.querySelector<HTMLElement>(selector) ?? undefined)
      }
    }
  }

  function poll(now: number) {
    let pads: (Gamepad | null)[]
    try {
      pads = navigator.getGamepads()
    } catch {
      return
    }
    requestAnimationFrame(poll)
    const pad = pads.find(player => player?.connected && player.mapping === 'standard')
    if (!pad || document.hidden || !document.hasFocus()) {
      stopSelect(false)
      connected = undefined
      previousDirection = undefined
      return
    }
    const buttons = pad.buttons.map(button => button.pressed)
    const direction = axis(pad)
    if (connected !== pad.index) {
      connected = pad.index
      previousButtons = buttons
      previousDirection = direction
      heldUntil = now + 360
      return
    }
    const pressed = buttons.flatMap((down, index) => down && !previousButtons[index] ? [index] : [])
    previousButtons = buttons
    if (!direction) previousDirection = undefined
    if (pending && dialog.open) {
      const button = pressed.find(index => Object.hasOwn(BUTTONS, index))
      if (button !== undefined) {
        const assigned = pending
        const swap = ACTIONS.find(([id]) => bindings[id] === button)?.[0]
        if (swap) bindings[swap] = bindings[assigned]
        bindings[assigned] = button
        pending = undefined
        store()
        focus(rows.querySelector<HTMLButtonElement>(`[data-binding="${assigned}"]`) ?? undefined)
      }
      return
    }
    if (direction && (direction !== previousDirection || now >= heldUntil)) {
      document.body.classList.add('controller-active')
      heldUntil = now + (direction === previousDirection ? 115 : 330)
      previousDirection = direction
      if (select && !select.element.isConnected) select = undefined
      if (select) {
        const step = direction === 'right' || direction === 'down' ? 1 : -1
        const options = select.element.options
        for (let index = select.element.selectedIndex + step; index >= 0 && index < options.length; index += step) {
          if (options[index].disabled) continue
          select.element.selectedIndex = index
          break
        }
      } else {
        move(direction)
      }
    }
    const action = ACTIONS.find(([id]) => pressed.includes(bindings[id]))?.[0]
    if (action) {
      document.body.classList.add('controller-active')
      act(action)
    }
  }

  render()
  if (typeof navigator.getGamepads === 'function') requestAnimationFrame(poll)
}
