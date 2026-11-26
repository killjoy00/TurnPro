import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { build } from 'esbuild'

const [html, css, bundled] = await Promise.all([
  readFile('src/index.html', 'utf8'),
  readFile('src/court.css', 'utf8'),
  build({
    entryPoints: ['src/client.ts'],
    bundle: true,
    write: false,
    platform: 'browser',
    target: 'es2022',
    minifySyntax: true,
  }),
])

const script = '\n' + bundled.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')
const hash = createHash('sha256').update(script).digest('base64')
const csp = `default-src 'none'; script-src 'sha256-${hash}'; style-src 'unsafe-inline'; base-uri 'none'; object-src 'none'`
const output = html
  .replace('<!-- policy -->', () => `<meta http-equiv="Content-Security-Policy" content="${csp}">`)
  .replace('<!-- styles -->', () => `<style>\n${css}</style>`)
  .replace('<!-- game -->', () => `<script>${script}</script>`)
await mkdir('dist', { recursive: true })
await writeFile('dist/turn-pro.html', output)
