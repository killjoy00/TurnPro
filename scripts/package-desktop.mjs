import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { packager } from '@electron/packager'

if (!['linux', 'win32'].includes(process.platform) || process.arch !== 'x64') {
  throw new Error('Build the desktop playtest on 64-bit Windows or Linux.')
}

const { version } = JSON.parse(await readFile('package.json', 'utf8'))
const staging = await mkdtemp(join(tmpdir(), 'turn-pro-desktop-'))
try {
  await Promise.all([
    copyFile('desktop/main.cjs', join(staging, 'main.cjs')),
    copyFile('dist/turn-pro.html', join(staging, 'index.html')),
    writeFile(join(staging, 'package.json'), JSON.stringify({ name: 'TurnPro', version, main: 'main.cjs' })),
  ])
  const outputs = await packager({
    dir: staging,
    out: 'release',
    name: 'TurnPro',
    platform: process.platform,
    arch: process.arch,
    electronVersion: '45.4.1',
    asar: true,
    overwrite: true,
  })
  console.log(outputs.join('\n'))
} finally {
  await rm(staging, { recursive: true, force: true })
}
