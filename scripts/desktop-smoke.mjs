import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron as electron } from 'playwright'

const profile = await mkdtemp(join(tmpdir(), 'turn-pro-profile-'))
const executablePath = resolve('release', `TurnPro-${process.platform}-x64`,
  process.platform === 'win32' ? 'TurnPro.exe' : 'TurnPro')
const args = [`--user-data-dir=${profile}`]
let app
try {
  app = await electron.launch({ executablePath, args })
  let page = await app.firstWindow()
  await page.waitForURL('turnpro://game/index.html')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const sports = page.locator('#sport option')
  const expected = ['basketball', 'soccer', 'hockey', 'football']
  assert.deepEqual(await sports.evaluateAll(options => options.map(option => option.value)),
    expected)
  assert.equal(await page.evaluate(() => typeof globalThis.require), 'undefined')
  for (const sport of expected) {
    await page.getByRole('combobox', { name: 'Sport', exact: true }).selectOption(sport)
    assert.equal(await page.locator('.marker').count(), { basketball: 10, soccer: 22, hockey: 12, football: 22 }[sport])
    const unit = sport === 'football' ? 'snap' : 'turn'
    await page.getByRole('button', { name: `Commit ${unit}` }).click()
    assert.match(await page.locator('.turn-clock').innerText(), new RegExp(`${unit} 2`, 'i'))
  }
  await page.getByRole('button', { name: 'Club season' }).click()
  await page.getByRole('button', { name: 'All four sports · 12 league + 4 cups' }).click()
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
