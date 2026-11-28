import type { Sport } from './league.ts'

export type SoundCue = 'order' | 'commit' | 'pass' | 'shot' | 'contact' | 'stop' | 'score' | 'finish'

const KEY = 'turn-pro-match-sound'
const WINNING_NOTES: Record<Sport, readonly number[]> = {
  basketball: [220, 330, 440, 554],
  soccer: [261.63, 329.63, 392, 523.25],
  hockey: [196, 294, 392, 392],
  football: [164.81, 246.94, 329.63, 440],
}
let muted = false
let context: AudioContext | undefined
let mix: GainNode | undefined
let noise: AudioBuffer | undefined
const active = new Set<AudioScheduledSourceNode>()

export function installMatchSound() {
  const setting = document.getElementById('match-sound') as HTMLSelectElement
  try { muted = localStorage.getItem(KEY) === 'off' } catch { /* Use the default in private storage. */ }
  setting.value = muted ? 'off' : 'on'
  setting.addEventListener('change', () => {
    muted = setting.value === 'off'
    if (muted) for (const node of active) node.stop()
    else {
      unlockMatchSound()
      playMatchSound('commit', 'basketball')
    }
    try { localStorage.setItem(KEY, setting.value) } catch { /* Keep the preference for this session. */ }
  })
}

// Called from the player's commit or settings gesture so the browser can allow audio.
export function unlockMatchSound() {
  if (muted || !window.AudioContext) return
  try {
    if (!context) {
      context = new AudioContext()
      mix = context.createGain()
      mix.gain.value = .26
      const limiter = context.createDynamicsCompressor()
      mix.connect(limiter).connect(context.destination)
      noise = context.createBuffer(1, Math.floor(context.sampleRate * .65), context.sampleRate)
      const samples = noise.getChannelData(0)
      for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1
    }
    if (context.state !== 'running') void context.resume().catch(() => undefined)
  } catch { /* Match controls also work without Web Audio. */ }
}

export function playMatchSound(cue: SoundCue, sport: Sport, signal?: AbortSignal, home = true) {
  const audio = context
  const output = mix
  if (muted || !audio || !output || signal?.aborted) return
  const start = audio.currentTime + .008

  function envelope(node: AudioScheduledSourceNode, input: AudioNode, time: number, length: number, volume: number) {
    const gain = audio!.createGain()
    input.connect(gain).connect(output!)
    gain.gain.setValueAtTime(.001, time)
    gain.gain.exponentialRampToValueAtTime(volume, time + .016)
    gain.gain.exponentialRampToValueAtTime(.001, time + length)
    const stop = () => node.stop()
    signal?.addEventListener('abort', stop, { once: true })
    active.add(node)
    node.onended = () => {
      signal?.removeEventListener('abort', stop)
      active.delete(node)
      node.disconnect()
      if (input !== node) input.disconnect()
      gain.disconnect()
    }
    node.start(time)
    node.stop(time + length + .012)
  }

  function tone(frequency: number, length: number, volume: number, shift = 1, delay = 0, wave: OscillatorType = 'triangle') {
    const note = audio!.createOscillator()
    const time = start + delay
    note.type = wave
    note.frequency.setValueAtTime(frequency, time)
    note.frequency.exponentialRampToValueAtTime(frequency * shift, time + length)
    envelope(note, note, time, length, volume)
  }

  function texture(frequency: number, length: number, volume: number) {
    const source = audio!.createBufferSource()
    source.buffer = noise!
    const filter = audio!.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = frequency
    filter.Q.value = .8
    source.connect(filter)
    envelope(source, filter, start, length, volume)
  }

  switch (cue) {
    case 'order':
      tone(460, .063, .22, 1.35)
      break
    case 'commit':
      tone(152, .14, .31, .53)
      tone(510, .09, .17, 1.3, .04)
      break
    case 'pass':
      texture(sport === 'hockey' ? 2800 : 1450, .115, .25)
      tone(sport === 'hockey' ? 610 : 310, .085, .14, .7)
      break
    case 'shot':
      texture(sport === 'football' ? 650 : 2200, .19, .36)
      tone(sport === 'basketball' ? 160 : 220, .2, .25, .43)
      break
    case 'contact':
      texture(710, .15, .37)
      tone(94, .14, .45, .52)
      break
    case 'stop':
      tone(sport === 'hockey' ? 730 : 880, .17, .28, .57, 0, 'triangle')
      texture(1000, .21, .28)
      break
    case 'score':
      tone(83, .35, .52, .53)
      texture(950, .62, home ? .4 : .2)
      for (const [index, frequency] of WINNING_NOTES[sport].entries()) {
        tone(home ? frequency : frequency * .65, .27, .39, 1, index * .072, sport === 'hockey' ? 'sawtooth' : 'triangle')
      }
      break
    case 'finish':
      tone(420, .18, .25, 1, 0, 'triangle')
      tone(315, .34, .24, .97, .22, 'triangle')
  }
}
