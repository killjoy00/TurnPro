import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createClub } from '../src/club.ts'
import { beginClubFixture, openClubFixture } from '../src/club-fixture.ts'

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(new URL('../dist/turn-pro.html', import.meta.url).href)
  assert.deepEqual(await page.locator('#sport option').evaluateAll(options => options.map(option => option.value)),
    ['basketball', 'soccer', 'hockey', 'football'])

  await page.getByRole('button', { name: 'Controls', exact: true }).click()
  await page.getByLabel('Text size').selectOption('extra')
  await page.getByLabel('Contrast').selectOption('high')
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), '20px')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 1280)
  const oldClub = beginClubFixture(createClub('both'))
  delete oldClub.pending.start
  delete oldClub.pending.opponentPlans
  const oldSession = openClubFixture(oldClub)
  const originalReply = oldSession.opponent(oldSession.match, 1)
  oldClub.pending.turns.push([])
  const legacy = JSON.stringify(oldClub)
  await page.evaluate(raw => localStorage.setItem('turn-pro-steam-preview-club-v1', raw), legacy)
  await page.reload()
  assert.equal(await page.locator('html').getAttribute('data-contrast'), 'high')
  assert.equal(await page.locator('html').getAttribute('data-text-size'), 'extra')
  await page.getByRole('button', { name: 'Continue saved fixture' }).click()
  assert.match(await page.locator('.turn-clock').innerText(), /Turn 2/i)
  const upgraded = await page.evaluate(() => JSON.parse(localStorage.getItem('turn-pro-club-v1')).pending)
  assert.equal(upgraded.start.version, 1)
  assert.deepEqual(upgraded.opponentPlans, [originalReply])
  await page.getByRole('button', { name: 'Commit turn' }).click()
  assert.match(await page.locator('.turn-clock').innerText(), /Turn 3/i)
  const saves = await page.evaluate(() => ({
    current: localStorage.getItem('turn-pro-club-v1'),
    previous: localStorage.getItem('turn-pro-steam-preview-club-v1'),
  }))
  assert.equal(saves.previous, legacy)
  const persisted = JSON.parse(saves.current).pending
  assert.equal(persisted.turns.length, 2)
  assert.deepEqual(persisted.start, upgraded.start)
  assert.deepEqual(persisted.opponentPlans[0], originalReply)

  await page.evaluate(raw => localStorage.setItem('turn-pro-club-v1', raw), JSON.stringify(createClub('football')))
  await page.reload()
  await page.getByRole('button', { name: 'Club season' }).click()
  assert.match(await page.locator('.club-hero').innerText(), /American football vs Forge/)
  assert.deepEqual(errors, [])
  console.log('Four-sport launch, existing-save recovery, save priority, and persistent display settings passed at 1280×800.')
} finally {
  await browser.close()
}
