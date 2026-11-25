import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { build } from 'esbuild'

const launch = process.argv.includes('--launch')

const [html, css, bundled] = await Promise.all([
  readFile('src/index.html', 'utf8'),
  readFile('src/court.css', 'utf8'),
  build({
    entryPoints: ['src/client.ts'],
    bundle: true,
    write: false,
    platform: 'browser',
    target: 'es2022',
    define: { TURN_PRO_FULL_PROTOTYPE: JSON.stringify(!launch) },
    minifySyntax: true,
  }),
])

const script = '\n' + bundled.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')
const hash = createHash('sha256').update(script).digest('base64')
const csp = `default-src 'none'; script-src 'sha256-${hash}'; style-src 'unsafe-inline'; base-uri 'none'; object-src 'none'`
const output = html
  .replace('<!-- prototype-sports -->', launch ? '' : `
        <option value="hockey">Ice hockey · 6-on-6</option>
        <option value="football">American football · 11-on-11</option>`)
  .replace('<!-- prototype-drills -->', launch ? '' : `
      <button type="button" data-learn="hockey">Practice a hockey one-timer</button>
      <button type="button" data-learn="football">Practice a football third down</button>
      <button type="button" id="playtest-nav">Playtest feedback</button>`)
  .replace('<!-- playtest-dialog -->', launch ? '' : `
  <dialog id="playtest-dialog" aria-labelledby="playtest-heading">
    <h2 id="playtest-heading">Playtest feedback</h2>
    <p>Try a coached play and a quick match in each sport. In Club season, make a training or lineup choice and play a fixture.</p>
    <p>Recording tracks match time, committed turns, and scores in this tab. Your report stays here until you download and share it.</p>
    <button type="button" id="playtest-record">Start recording</button>
    <p id="playtest-status" role="status"></p>
    <label for="playtest-notes">Where did you get stuck? What decided a turn? Which sport would you play again, and why? What shaped your club choice?</label>
    <textarea id="playtest-notes" rows="5" maxlength="8000"></textarea>
    <button type="button" id="playtest-download">Download feedback</button>
    <form method="dialog"><button>Close</button></form>
  </dialog>`)
  .replace('<!-- policy -->', () => `<meta http-equiv="Content-Security-Policy" content="${csp}">`)
  .replace('<!-- styles -->', () => `<style>\n${css}</style>`)
  .replace('<!-- game -->', () => `<script>${script}</script>`)
await mkdir('dist', { recursive: true })
await writeFile(launch ? 'dist/turn-pro-launch.html' : 'dist/turn-pro.html', output)
