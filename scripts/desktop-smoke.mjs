import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron as electron } from 'playwright'

const profile = await mkdtemp(join(tmpdir(), 'turn-pro-profile-'))
const launch = process.argv.includes('--launch')
const executablePath = resolve(launch ? 'release/launch' : 'release', `TurnPro-${process.platform}-x64`,
  process.platform === 'win32' ? 'TurnPro.exe' : 'TurnPro')
const args = [`--user-data-dir=${profile}`]
let app
try {
  app = await electron.launch({ executablePath, args })
  let page = await app.firstWindow()
  await page.waitForURL('turnpro://game/index.html')
  const sports = page.locator('#sport option')
  assert.deepEqual(await sports.evaluateAll(options => options.map(option => option.value)),
    launch ? ['basketball', 'soccer'] : ['basketball', 'soccer', 'hockey'])
  assert.equal(await page.evaluate(() => typeof globalThis.require), 'undefined')
  await page.getByRole('button', { name: 'Club season' }).click()
  await page.getByRole('button', { name: 'Both sports · 6 fixtures' }).click()
  await page.getByRole('button', { name: 'Play fixture' }).click()
  await page.getByRole('button', { name: 'Commit turn' }).click()
  assert.match(await page.locator('.turn-clock').innerText(), /Turn 2/i)
  await app.close()

  app = await electron.launch({ executablePath, args })
  page = await app.firstWindow()
  await page.getByRole('button', { name: 'Club season' }).click()
  await page.getByRole('button', { name: 'Resume fixture' }).click()
  assert.match(await page.locator('.turn-clock').innerText(), /Turn 2/i)
  assert.equal(await page.locator('.timeline').count(), 1)
  console.log('The packaged desktop app launched and restored a club fixture after restart.')
} finally {
  await app?.close()
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
