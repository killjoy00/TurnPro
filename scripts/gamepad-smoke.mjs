import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false }))
    const pad = { connected: true, index: 0, mapping: 'standard', buttons, axes: [0, 0] }
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad] })
    window.pressTestButton = async button => {
      const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      await frame()
      buttons[button].pressed = true
      await frame()
      buttons[button].pressed = false
      await frame()
    }
  })
  await page.goto(new URL('../dist/turn-pro.html', import.meta.url).href)
  await page.bringToFront()
  const press = button => page.evaluate(index => window.pressTestButton(index), button)
  await press(9)
  await page.getByRole('dialog', { name: 'Controls' }).waitFor()
  await page.locator('[data-binding="select"]').focus()
  await press(0)
  assert.match(await page.locator('[data-binding="select"]').innerText(), /Press a button/)
  await press(4)
  assert.match(await page.locator('[data-binding="select"]').innerText(), /Left bumper/)
  await press(1)
  assert.equal(await page.getByRole('dialog', { name: 'Controls' }).isVisible(), false)

  await page.getByRole('combobox', { name: 'Sport', exact: true }).focus()
  await press(4)
  assert.equal(await page.locator('#sport.controller-choosing').count(), 1)
  await press(13)
  await press(4)
  assert.equal(await page.locator('.marker').count(), 22)
  await press(2)
  assert.match(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), /Reed/)
  await press(2)
  assert.match(await page.evaluate(() => document.activeElement.textContent), /Carry forward/)
  await press(4)
  assert.match(await page.locator('#budget').innerText(), /1 \/ 3/)
  await press(3)
  assert.match(await page.locator('.turn-clock').innerText(), /Turn 2/i)

  await page.getByRole('combobox', { name: 'Sport', exact: true }).focus()
  await press(4)
  await press(13)
  await press(13)
  await press(4)
  assert.equal(await page.locator('#sport').inputValue(), 'football')
  await press(2)
  assert.match(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), /Reed/)
  await press(2)
  assert.match(await page.evaluate(() => document.activeElement.textContent), /Inside handoff/)
  await press(4)
  await press(3)
  assert.match(await page.locator('.turn-clock').innerText(), /Snap 2/i)

  await page.reload()
  await press(9)
  assert.match(await page.locator('[data-binding="select"]').innerText(), /Left bumper/)
  await page.getByRole('button', { name: 'Restore defaults' }).click()
  assert.match(await page.locator('[data-binding="select"]').innerText(), /South face button/)
  await press(1)
  await page.getByRole('button', { name: 'Club season' }).focus()
  await press(0)
  const first = await page.evaluate(() => document.activeElement.textContent.trim())
  await press(13)
  assert.notEqual(await page.evaluate(() => document.activeElement.textContent.trim()), first)
  assert.deepEqual(errors, [])
  console.log('Controller navigation, button remapping, order selection, and turn commitment passed.')
} finally {
  await browser.close()
}
