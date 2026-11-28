import type { AthleteSnapshot, ResolvedMove, TurnEvent } from './match.ts'
import type { Point } from './math.ts'
import type { SoundCue } from './match-sound.ts'

interface PlaybackFeedback {
  impact(event: TurnEvent): boolean
  sound(cue: SoundCue): void
}

export async function playResolution(
  board: HTMLElement, status: HTMLElement, events: readonly TurnEvent[], athletes: readonly AthleteSnapshot[],
  startingHolder: string, project: (point: Point) => Point, feedback: PlaybackFeedback, signal: AbortSignal,
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
  const particles = new Set<HTMLElement>()
  const stop = () => {
    for (const animation of animations) animation.cancel()
    for (const particle of particles) particle.remove()
    for (const marker of markers.values()) marker.classList.remove('revealed')
    board.classList.remove('playing')
    ball.remove()
  }
  signal.addEventListener('abort', stop, { once: true })

  function location(point: Point) {
    const projected = project(point)
    return { left: `${projected.x * 100}%`, top: `${projected.y * 100}%` }
  }

  async function animate(element: HTMLElement, frames: Keyframe[], duration: number) {
    if (signal.aborted) return
    const animation = element.animate(frames, { duration, easing: 'ease-out' })
    animations.add(animation)
    try {
      await animation.finished
    } catch (error) {
      if (!signal.aborted) throw error
    } finally {
      animations.delete(animation)
    }
  }

  const pause = (duration: number) => animate(ball, [{ opacity: 1 }, { opacity: 1 }], duration)

  function travel(element: HTMLElement, from: Point, to: Point, duration: number) {
    Object.assign(element.style, location(to))
    return animate(element, [location(from), location(to)], duration)
  }

  async function trace(from: Point, to: Point, duration: number) {
    const a = project(from)
    const b = project(to)
    const dx = (b.x - a.x) * board.clientWidth
    const dy = (b.y - a.y) * board.clientHeight
    const streak = document.createElement('span')
    streak.className = 'ball-trail'
    Object.assign(streak.style, location(from), {
      width: `${Math.hypot(dx, dy)}px`, rotate: `${Math.atan2(dy, dx)}rad`,
    })
    board.prepend(streak)
    particles.add(streak)
    try {
      await animate(streak, [{ opacity: .95, scale: '0.15 1' }, { opacity: 0, scale: '1 1' }], duration)
    } finally {
      streak.remove()
      particles.delete(streak)
    }
  }

  let holder: string | undefined = startingHolder
  let ballAt = positions.get(startingHolder)!
  Object.assign(ball.style, location(ballAt))

  async function movePlayers(moves: readonly ResolvedMove[]) {
    const upcoming = moves.flatMap(move => {
      const marker = markers.get(move.athlete)
      if (!marker) return []
      positions.set(move.athlete, move.to)
      const moveMarker = travel(marker, move.from, move.to, 260)
      if (holder !== move.athlete) return [moveMarker]
      const follow = travel(ball, ballAt, move.to, 260)
      ballAt = move.to
      return [moveMarker, follow]
    })
    await Promise.all(upcoming)
  }

  try {
    const plans = events.filter(event => event.cue?.type === 'plan')
    status.textContent = plans.map(event => event.text).join(' · ')
    for (const event of plans) {
      if (event.cue?.type !== 'plan') continue
      for (const { athlete } of event.cue.commands) markers.get(athlete)?.classList.add('revealed')
    }
    feedback.sound('commit')
    await pause(390)
    for (const marker of markers.values()) marker.classList.remove('revealed')

    for (const event of events) {
      if (signal.aborted) break
      const cue = event.cue
      if (event.kind === 'plan') continue
      if (cue && cue.type !== 'ball') status.textContent = event.text
      if (cue?.type === 'move') await movePlayers(cue.moves)
      if (cue?.type === 'ball') {
        const hard = cue.action === 'shot' || cue.action === 'kick'
        const collision = cue.action === 'strip' || cue.action === 'carry'
        feedback.sound(hard ? 'shot' : collision ? 'contact' : 'pass')
        const duration = hard ? 340 : 230
        const points = cue.via ? [ballAt, cue.via, cue.to] : [ballAt, cue.to]
        // A resolved rebound may start behind the first shot's endpoint.
        if (cue.action === 'rebound') points.splice(1, 0, cue.from)
        holder = cue.holder
        const receiving = holder && markers.get(holder)
        const previous = holder && positions.get(holder)
        const playerTravel = receiving && previous && (previous.x !== cue.to.x || previous.y !== cue.to.y)
          ? travel(receiving, previous, cue.to, duration * (points.length - 1))
          : undefined
        if (holder && receiving) positions.set(holder, cue.to)
        for (let index = 1; index < points.length && !signal.aborted; index++) {
          const from = points[index - 1]
          const to = points[index]
          await Promise.all([travel(ball, from, to, duration), trace(from, to, duration)])
        }
        await playerTravel
        ballAt = cue.to
        if (signal.aborted) break
        status.textContent = event.text
      }
      if (cue?.type === 'contact') {
        feedback.sound('contact')
        const engaged = [markers.get(cue.athlete), markers.get(cue.opponent)]
        await Promise.all(engaged.map(marker => marker && animate(marker, [
          { scale: 1 }, { scale: 1.23 }, { scale: 1 },
        ], 200)))
      }

      if (!signal.aborted && feedback.impact(event)) {
        status.textContent = event.text
        await pause(event.kind === 'score' ? 575 : 290)
      }
      if (cue?.type === 'reset' && !signal.aborted) {
        const fade = board.animate([{ opacity: 1 }, { opacity: .15 }], { duration: 130, fill: 'forwards' })
        animations.add(fade)
        await fade.finished.catch(() => undefined)
        animations.delete(fade)
        fade.cancel()
        if (signal.aborted) break
        for (const move of cue.moves) {
          positions.set(move.athlete, move.to)
          const marker = markers.get(move.athlete)
          if (marker) Object.assign(marker.style, location(move.to))
        }
        holder = cue.holder
        ballAt = positions.get(holder)!
        Object.assign(ball.style, location(ballAt))
        await animate(board, [{ opacity: .15 }, { opacity: 1 }], 170)
      }
    }
  } finally {
    stop()
    signal.removeEventListener('abort', stop)
  }
}
