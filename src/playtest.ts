import type { Sport } from './league.ts'

type Mode = 'practice' | 'quick match' | 'club fixture'
interface Sample {
  sport: Sport
  mode: Mode
  startedTurn: number
  turns: number
  elapsedSeconds: number
  firstCommitSeconds: number | null
  completed: boolean
  score: readonly [number, number]
}

const KEY = 'turn-pro-playtest-v1'
const NAMES: Record<Sport, string> = { basketball: 'Basketball', soccer: 'Soccer', hockey: 'Ice hockey', football: 'American football' }
let report = { startedAt: 0, samples: [] as Sample[], notes: '' }

function remember() {
  try { sessionStorage.setItem(KEY, JSON.stringify(report)) } catch {
    // Feedback can still be downloaded in this page when session storage is unavailable.
  }
}

export function trackMatch(sport: Sport, mode: Mode) {
  const openedAt = Date.now()
  let sample: Sample | undefined
  let recordingStarted = 0
  return (turn: number, score: readonly [number, number], completed: boolean) => {
    if (recordingStarted !== report.startedAt) {
      recordingStarted = report.startedAt
      sample = undefined
    }
    if (!recordingStarted) return
    const elapsed = Math.max(0, Math.round((Date.now() - Math.max(openedAt, report.startedAt)) / 1000))
    if (!sample) {
      sample = { sport, mode, startedTurn: turn, turns: 0, elapsedSeconds: 0, firstCommitSeconds: turn === 1 ? elapsed : null,
        completed: false, score }
      report.samples = [...report.samples.slice(-39), sample]
    }
    sample.turns++
    sample.elapsedSeconds = elapsed
    sample.completed = completed
    sample.score = score
    remember()
  }
}

export function installPlaytest(openHelp: HTMLDialogElement) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null')
    if (saved && Number.isFinite(saved.startedAt) && Array.isArray(saved.samples) && typeof saved.notes === 'string') report = saved
  } catch {
    // A fresh report is available if browser storage is disabled.
  }
  const dialog = document.getElementById('playtest-dialog') as HTMLDialogElement
  const notes = document.getElementById('playtest-notes') as HTMLTextAreaElement
  const toggle = document.getElementById('playtest-record') as HTMLButtonElement
  const status = document.getElementById('playtest-status')!
  const download = document.getElementById('playtest-download') as HTMLButtonElement
  notes.value = report.notes

  function render() {
    toggle.textContent = report.startedAt ? 'Stop recording' : 'Start recording'
    const finished = report.samples.filter(sample => sample.completed).length
    status.textContent = `${report.startedAt ? 'Recording' : 'Recording off'} · ${finished} completed activities · ${report.samples.length} recorded activities`
    download.disabled = !report.samples.length && !notes.value.trim()
  }

  document.getElementById('playtest-nav')!.addEventListener('click', () => {
    openHelp.close()
    render()
    dialog.showModal()
  })
  toggle.addEventListener('click', () => {
    report.startedAt = report.startedAt ? 0 : Date.now()
    remember()
    render()
  })
  notes.addEventListener('input', () => {
    report.notes = notes.value
    remember()
    render()
  })
  download.addEventListener('click', () => {
    const lines = report.samples.map(sample => {
      const first = sample.firstCommitSeconds === null ? '' : `, first commit ${sample.firstCommitSeconds}s`
      return `- ${NAMES[sample.sport]} ${sample.mode}, from turn ${sample.startedTurn}, ${sample.turns} committed, ${sample.elapsedSeconds}s elapsed${first}, ${sample.completed ? 'complete' : 'partial'}, score ${sample.score.join('–')}`
    })
    const file = new Blob([['# Turn Pro playtest', '', '## Recorded play', ...lines, '', '## Player notes', notes.value.trim()].join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = 'turn-pro-playtest.txt'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  })
}
