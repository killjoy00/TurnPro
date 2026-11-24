import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { writeSteamPreview } from '../scripts/steampipe-preview.mjs'

test('SteamPipe preparation maps each complete desktop package and always sets preview mode', async () => {
  const root = await mkdtemp(join(tmpdir(), 'turn-pro-steam-test-'))
  try {
    const args = { appId: '12000', windowsDepot: '12001', linuxDepot: '12002',
      packages: join(root, 'packages'), output: join(root, 'scripts') }
    await assert.rejects(() => writeSteamPreview({ ...args, windowsDepot: 'wrong' }), /windows-depot/)
    await assert.rejects(() => writeSteamPreview({ ...args, linuxDepot: '12001' }), /separate/)
    await assert.rejects(() => writeSteamPreview(args), /Missing packaged file/)
    for (const [dir, executable] of [['TurnPro-win32-x64', 'TurnPro.exe'], ['TurnPro-linux-x64', 'TurnPro']]) {
      const target = join(args.packages, dir)
      await mkdir(join(target, 'resources'), { recursive: true })
      await writeFile(join(target, executable), 'test executable', { mode: 0o755 })
      await writeFile(join(target, 'resources/app.asar'), 'test payload')
      await writeFile(join(target, 'turn-pro-build.json'), JSON.stringify({
        edition: 'launch', platform: dir.includes('win32') ? 'win32' : 'linux', arch: 'x64', version: '0.1.0',
        gameSha256: createHash('sha256').update('test game').digest('hex'),
        payloadSha256: createHash('sha256').update('test payload').digest('hex'),
      }))
    }
    const path = await writeSteamPreview(args)
    const app = await readFile(path, 'utf8')
    assert.match(app, /"AppID" "12000"/)
    assert.match(app, /"Preview" "1"/)
    assert.doesNotMatch(app, /SetLive|password/)
    for (const [id, platform] of [['12001', 'win32'], ['12002', 'linux']]) {
      assert.match(app, new RegExp(`"${id}" [^\n]+/depot_build_${id}.vdf`))
      const depot = await readFile(join(args.output, `depot_build_${id}.vdf`), 'utf8')
      assert.match(depot, /^"DepotBuild"/)
      assert.match(depot, new RegExp(`"ContentRoot" "[^\n]+/TurnPro-${platform}-x64"`))
      assert.match(depot, /"recursive" "1"/)
    }
    const linuxManifestPath = join(args.packages, 'TurnPro-linux-x64/turn-pro-build.json')
    const linuxManifest = JSON.parse(await readFile(linuxManifestPath, 'utf8'))
    await writeFile(linuxManifestPath, JSON.stringify({ ...linuxManifest, gameSha256: '0'.repeat(64) }))
    await assert.rejects(() => writeSteamPreview(args), /from the same build/)
    await writeFile(linuxManifestPath, JSON.stringify(linuxManifest))
    await writeFile(join(args.packages, 'TurnPro-linux-x64/resources/app.asar'), 'wrong payload')
    await assert.rejects(() => writeSteamPreview(args), /Packaged content does not match/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
