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

  const sport = page.getByRole('combobox', { name: 'Sport', exact: true })
  await sport.selectOption('soccer')
  assert.equal(await page.locator('.marker').count(), 22)
  assert.equal(await page.locator('#lineup button').count(), 11)
  assert.match(await page.locator('.turn-clock').innerText(), /Turn 1 \/ 18/i)

  await page.getByRole('combobox', { name: 'Orders per side in the next soccer match' }).selectOption('4')
  assert.match(await page.locator('#budget').innerText(), /0 \/ 3/)
  await page.getByRole('button', { name: 'Practice a cross' }).click()
  assert.match(await page.locator('#budget').innerText(), /0 \/ 4/)
  await page.getByRole('button', { name: 'Cross to Adeyemi' }).click()
  await page.getByRole('button', { name: /Adeyemi, 100 stamina/ }).click()
  await page.getByRole('button', { name: 'Run into the middle' }).click()
  await page.getByRole('button', { name: 'Commit turn' }).click()
  const crossed = await page.locator('.timeline').innerText()
  assert.match(crossed, /Adeyemi runs/)
  assert.match(crossed, /Vale finds Adeyemi with a cross/)
  await page.getByRole('button', { name: 'New match' }).click()
  assert.match(await page.locator('.turn-clock').innerText(), /Turn 1 \/ 18/i)
  for (let turn = 1; turn <= 18; turn += 1) {
    await page.getByRole('button', { name: 'Commit turn' }).click()
    if (turn === 9) {
      assert.match(await page.locator('.turn-clock').innerText(), /2nd half · Attack left/i)
      assert.match(await page.locator('.timeline').first().innerText(), /Half-time/)
    }
  }
  assert.match(await page.locator('.turn-clock').innerText(), /Final/i)
  assert.equal(await page.locator('.turn').count(), 18)
  assert.equal(await page.locator('#commit').isDisabled(), true)

  await sport.selectOption('basketball')
  assert.equal(await page.locator('.marker').count(), 10)
  assert.equal(await page.locator('.turn').count(), 0)
  await page.getByRole('button', { name: 'Commit turn' }).click()
  assert.match(await page.locator('.turn-clock').innerText(), /Turn 2 \/ 12/i)
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
  await mobile.getByRole('combobox', { name: 'Sport', exact: true }).selectOption('soccer')
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth), 390)
  assert.match(await mobile.locator('.turn-clock').innerText(), /Attack up/i)
  await mobile.getByRole('button', { name: 'Carry forward' }).tap()
  await mobile.getByRole('button', { name: 'Commit turn' }).tap()
  assert.match(await mobile.locator('.turn-clock').innerText(), /Turn 2/i)
  console.log('Basketball and soccer matches, the crossing drill, keyboard, restart, and mobile touch passed.')
} finally {
  await browser.close()
}
