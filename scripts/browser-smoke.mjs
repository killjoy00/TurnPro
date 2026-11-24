import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const browser = await chromium.launch()
const game = new URL('../dist/turn-pro.html', import.meta.url).href

try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 950 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(game)
  assert.equal(await page.locator('.marker').count(), 10)
  await page.getByRole('button', { name: 'Drive' }).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: /Okafor, 100 stamina/ }).click()
  await page.getByRole('button', { name: 'Set screen' }).click()
  await page.getByRole('button', { name: /Vale, 100 stamina/ }).click()
  await page.getByRole('button', { name: /Cut to Left wing/ }).click()
  assert.match(await page.locator('#budget').innerText(), /3 \/ 3/)
  await page.getByRole('button', { name: "Remove Vale's command" }).click()
  assert.equal(await page.locator('.timeline').count(), 0)
  await page.getByRole('button', { name: 'Commit turn' }).click()
  const firstTurn = await page.locator('.timeline').innerText()
  assert.match(firstTurn, /Okafor screens Quinn/)
  assert.match(firstTurn, /Reed drives/)
  assert.match(firstTurn, /Forge:/)
  await page.getByRole('button', { name: /Reed, 86 stamina/ }).click()
  await page.getByRole('button', { name: 'Shoot' }).click()
  for (let remaining = 0; remaining < 11; remaining += 1) {
    await page.getByRole('button', { name: 'Commit turn' }).click()
  }
  assert.match(await page.locator('.turn-clock').innerText(), /Final/i)
  assert.equal(await page.locator('#commit').isDisabled(), true)
  assert.equal(await page.locator('.turn').count(), 12)
  await page.getByRole('button', { name: 'New match' }).click()
  assert.match(await page.locator('.turn-clock').innerText(), /Turn 1 \/ 12/i)
  assert.equal(await page.locator('.turn').count(), 0)
  assert.deepEqual(errors, [])

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
  })
  await mobile.goto(game)
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth), 390)
  await mobile.getByRole('button', { name: 'Drive' }).tap()
  assert.match(await mobile.locator('#budget').innerText(), /1 \/ 3/)
  await mobile.getByRole('button', { name: 'Commit turn' }).tap()
  assert.match(await mobile.locator('.turn-clock').innerText(), /Turn 2/i)
  console.log('Desktop match, keyboard, restart, mobile touch, and responsive layout passed.')
} finally {
  await browser.close()
}
