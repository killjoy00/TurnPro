import type { AthleteSnapshot, ResolvedMove, TurnEvent } from './match.ts'
import type { Point } from './math.ts'

export async function playResolution(
  board: HTMLElement, status: HTMLElement, events: readonly TurnEvent[], athletes: readonly AthleteSnapshot[],
  startingHolder: string, project: (point: Point) => Point, onScore: () => void, signal: AbortSignal,
) {
  const markers = new Map([...board.querySelectorAll<HTMLElement>('[data-athlete]')]
    .map(marker => [marker.dataset.athlete!, marker]))
  const positions = new Map(athletes.map(athlete => [athlete.id, athlete.position]))
  const ball = document.createElement('span')
  ball.className = 'resolved-ball'
  ball.setAttribute('aria-hidden', 'true')
  board.append(ball)
  board.classList.add('playing')

  const animations = new Set<Animation>()
  const stop = () => {
    for (const animation of animations) animation.cancel()
    board.classList.remove('playing')
    ball.remove()
  }
  signal.addEventListener('abort', stop, { once: true })

  function location(point: Point) {
    const projected = project(point)
    return { left: `${projected.x * 100}%`, top: `${projected.y * 100}%` }
  }

  async function animate(element: HTMLElement, frames: Keyframe[], duration: number) {
    const animation = element.animate(frames, { duration, easing: 'ease-in-out' })
    animations.add(animation)
    try {
      await animation.finished
    } catch (error) {
      if (!signal.aborted) throw error
    } finally {
      animations.delete(animation)
    }
  }

  const pause = (duration: number) => animate(ball, [{ scale: 1 }, { scale: 1 }], duration)

  function travel(element: HTMLElement, from: Point, to: Point, duration: number) {
    Object.assign(element.style, location(to))
    return animate(element, [location(from), location(to)], duration)
  }

  let holder: string | undefined = startingHolder
  Object.assign(ball.style, location(positions.get(startingHolder)!))

  async function movePlayers(moves: readonly ResolvedMove[]) {
    const duration = 340
    await Promise.all(moves.flatMap(move => {
      const marker = markers.get(move.athlete)!
      positions.set(move.athlete, move.to)
      return holder === move.athlete
        ? [travel(marker, move.from, move.to, duration), travel(ball, move.from, move.to, duration)]
        : [travel(marker, move.from, move.to, duration)]
    }))
  }

  try {
    const plans = events.filter(event => event.cue?.type === 'plan')
    status.textContent = plans.map(event => event.text).join(' · ')
    for (const event of plans) {
      if (event.cue?.type !== 'plan') continue
      for (const { athlete } of event.cue.commands) markers.get(athlete)?.classList.add('revealed')
    }
    await pause(430)
    for (const marker of markers.values()) marker.classList.remove('revealed')

    for (const event of events) {
      if (signal.aborted) break
      const cue = event.cue
      if (!cue || cue.type === 'plan') continue
      if (cue.type !== 'ball') status.textContent = event.text
      if (cue.type === 'move') await movePlayers(cue.moves)
      if (cue.type === 'ball') {
        holder = cue.holder
        await travel(ball, cue.from, cue.to, cue.action === 'shot' ? 360 : 260)
        if (signal.aborted) break
        status.textContent = event.text
        if (event.kind === 'score') {
          onScore()
          await animate(ball, [{ scale: 1 }, { scale: 2 }, { scale: 1 }], 380)
        }
      }
      if (cue.type === 'contact') {
        const athletes = [markers.get(cue.athlete)!, markers.get(cue.opponent)!]
        await Promise.all(athletes.map(marker => animate(marker, [
          { outline: '0 solid #f9e590' }, { outline: '4px solid #f9e590' }, { outline: '0 solid #f9e590' },
        ], 340)))
      }
      // The rules reset the half court after possession changes. Fade between the two setups.
      if (cue.type === 'reset') {
        const fade = board.animate([{ opacity: 1 }, { opacity: .12 }], { duration: 180, fill: 'forwards' })
        animations.add(fade)
        await fade.finished.catch(() => undefined)
        animations.delete(fade)
        fade.cancel()
        if (signal.aborted) break
        for (const move of cue.moves) {
          positions.set(move.athlete, move.to)
          Object.assign(markers.get(move.athlete)!.style, location(move.to))
        }
        holder = cue.holder
        Object.assign(ball.style, location(positions.get(holder)!))
        await animate(board, [{ opacity: .12 }, { opacity: 1 }], 220)
      }
    }
  } finally {
    stop()
    signal.removeEventListener('abort', stop)
  }
}
