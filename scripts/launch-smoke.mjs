import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(new URL('../dist/turn-pro-launch.html', import.meta.url).href)
  assert.deepEqual(await page.locator('#sport option').evaluateAll(options => options.map(option => option.value)),
    ['basketball', 'soccer'])
  await page.getByRole('button', { name: 'Controls', exact: true }).click()
  await page.getByLabel('Text size').selectOption('extra')
  await page.getByLabel('Contrast').selectOption('high')
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), '20px')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 1280)
  await page.reload()
  assert.equal(await page.locator('html').getAttribute('data-contrast'), 'high')
  assert.equal(await page.locator('html').getAttribute('data-text-size'), 'extra')
  await page.getByRole('button', { name: 'Club season' }).click()
  await page.getByRole('button', { name: 'Both sports · 6 fixtures' }).click()
  assert.match(await page.locator('.club-hero').innerText(), /Season 1/)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 1280)
  await page.getByRole('button', { name: 'Play fixture' }).click()
  await page.getByRole('button', { name: 'Commit turn' }).click()
  assert.match(await page.locator('.turn-clock').innerText(), /Turn 2/i)
  assert.deepEqual(errors, [])
  console.log('Two-sport launch, club play and persistent display settings passed at 1280×800.')
} finally {
  await browser.close()
}
