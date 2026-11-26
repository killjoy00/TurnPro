import { createHash } from 'node:crypto'
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { SPORTS } from '../src/league.ts'

function integerId(value, flag) {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,9}$/.test(value) || Number(value) > 0xffffffff) {
    throw new Error(`Supply a valid Steamworks ID for --${flag}.`)
  }
  return value
}

function vdfPath(value) {
  const path = resolve(value).replaceAll('\\', '/')
  if (/["\r\n]/.test(path)) throw new Error('SteamPipe paths cannot contain quotes or line breaks.')
  return path
}

export async function writeSteamPreview({
  appId, windowsDepot, linuxDepot, packages = 'release', output = 'release/steam-preview',
}) {
  const app = integerId(appId, 'app-id')
  const windows = integerId(windowsDepot, 'windows-depot')
  const linux = integerId(linuxDepot, 'linux-depot')
  if (windows === linux) throw new Error('Pass the separate Windows and Linux depot IDs.')

  const targets = [
    { id: windows, platform: 'win32', root: vdfPath(join(packages, 'TurnPro-win32-x64')), executable: 'TurnPro.exe' },
    { id: linux, platform: 'linux', root: vdfPath(join(packages, 'TurnPro-linux-x64')), executable: 'TurnPro' },
  ]
  const builds = new Set()
  for (const target of targets) {
    for (const file of [target.executable, 'resources/app.asar']) {
      const path = join(target.root, file)
      const info = await stat(path).catch(() => null)
      if (!info?.isFile() || info.size === 0) throw new Error(`Missing packaged file: ${path}`)
    }
    const manifest = await readFile(join(target.root, 'turn-pro-build.json'), 'utf8')
      .then(JSON.parse).catch(() => null)
    if (!Array.isArray(manifest?.sports) || manifest.sports.join() !== SPORTS.join() || manifest.platform !== target.platform || manifest.arch !== 'x64'
      || typeof manifest.version !== 'string' || !manifest.version || !/^[a-f0-9]{64}$/.test(manifest.gameSha256)) {
      throw new Error(`Use a 64-bit four-sport package for ${target.platform}.`)
    }
    const payload = await readFile(join(target.root, 'resources/app.asar'))
    if (manifest.payloadSha256 !== createHash('sha256').update(payload).digest('hex')) {
      throw new Error(`Packaged content does not match its manifest: ${target.platform}.`)
    }
    builds.add(JSON.stringify([manifest.version, manifest.gameSha256]))
    if (target.platform === 'linux' && process.platform !== 'win32') {
      await access(join(target.root, target.executable), constants.X_OK)
    }
  }
  if (builds.size !== 1) throw new Error('Use Windows and Linux packages from the same build.')

  const folder = vdfPath(output)
  const logFolder = vdfPath(join(folder, 'output'))
  await mkdir(logFolder, { recursive: true })
  for (const target of targets) {
    const depot = `"DepotBuild"
{
  "DepotID" "${target.id}"
  "ContentRoot" "${target.root}"
  "FileMapping"
  {
    "LocalPath" "*"
    "DepotPath" "."
    "recursive" "1"
  }
}
`
    await writeFile(join(folder, `depot_build_${target.id}.vdf`), depot)
  }
  const appBuild = join(folder, `app_build_${app}.vdf`)
  await writeFile(appBuild, `"AppBuild"
{
  "AppID" "${app}"
  "Desc" "Turn Pro four-sport preview"
  "BuildOutput" "${logFolder}"
  "Preview" "1"
  "Depots"
  {
${targets.map(target => `    "${target.id}" "${vdfPath(join(folder, `depot_build_${target.id}.vdf`))}"`).join('\n')}
  }
}
`)
  return appBuild
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const { values } = parseArgs({ options: {
    'app-id': { type: 'string' },
    'windows-depot': { type: 'string' },
    'linux-depot': { type: 'string' },
    packages: { type: 'string' },
    output: { type: 'string' },
  } })
  const path = await writeSteamPreview({
    appId: values['app-id'], windowsDepot: values['windows-depot'], linuxDepot: values['linux-depot'],
    packages: values.packages, output: values.output,
  })
  console.log(`SteamPipe preview written to ${path}`)
}
