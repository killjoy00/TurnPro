import { createHash } from 'node:crypto'
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { packager } from '@electron/packager'

const { values } = parseArgs({ options: { launch: { type: 'boolean' }, platform: { type: 'string' } } })
const platform = values.platform ?? process.platform
if (!['linux', 'win32'].includes(platform) || process.arch !== 'x64') {
  throw new Error('Build the desktop playtest on 64-bit Windows or Linux.')
}

const launch = values.launch === true
const htmlPath = launch ? 'dist/turn-pro-launch.html' : 'dist/turn-pro.html'
const { version } = JSON.parse(await readFile('package.json', 'utf8'))
const [html, main] = await Promise.all([readFile(htmlPath, 'utf8'), readFile('desktop/main.cjs', 'utf8')])
const gameSha256 = createHash('sha256')
  .update(JSON.stringify([html.replaceAll('\r\n', '\n'), main.replaceAll('\r\n', '\n')]))
  .digest('hex')
const staging = await mkdtemp(join(tmpdir(), 'turn-pro-desktop-'))
try {
  await Promise.all([
    copyFile('desktop/main.cjs', join(staging, 'main.cjs')),
    copyFile(htmlPath, join(staging, 'index.html')),
    writeFile(join(staging, 'package.json'), JSON.stringify({ name: 'TurnPro', version, main: 'main.cjs' })),
  ])
  const outputs = await packager({
    dir: staging,
    out: launch ? 'release/launch' : 'release',
    name: 'TurnPro',
    platform,
    arch: process.arch,
    electronVersion: '45.4.1',
    asar: true,
    overwrite: true,
  })
  for (const output of outputs) {
    const payload = await readFile(join(output, 'resources', 'app.asar'))
    await writeFile(join(output, 'turn-pro-build.json'), JSON.stringify({
      edition: launch ? 'launch' : 'playtest', platform, arch: 'x64', version, gameSha256,
      payloadSha256: createHash('sha256').update(payload).digest('hex'),
    }, null, 2) + '\n')
  }
  console.log(outputs.join('\n'))
} finally {
  await rm(staging, { recursive: true, force: true })
}
