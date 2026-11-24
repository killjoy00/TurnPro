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
  }),
])

const output = html
  .replace('<!-- styles -->', () => `<style>\n${css}</style>`)
  .replace('<!-- game -->', () => `<script>\n${bundled.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script>`)
await mkdir('dist', { recursive: true })
await writeFile('dist/turn-pro.html', output)
