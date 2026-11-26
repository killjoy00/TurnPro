import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const browser = await chromium.launch()
try {
  for (const [sport, turns] of [['basketball', 12], ['soccer', 18]]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => {
      const buttons = Array.from({ length: 17 }, () => ({ pressed: false }))
      const pad = { connected: true, mapping: 'standard', index: 0, buttons, axes: [0, 0] }
      const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      Object.defineProperty(navigator, 'getGamepads', { value: () => [pad] })
      window.pressTestButton = async index => {
        await frame()
        buttons[index].pressed = true
        await frame()
        buttons[index].pressed = false
        await frame()
      }
      window.reconnectHoldingCommit = async () => {
        pad.connected = false
        await frame()
        buttons[3].pressed = true
        pad.connected = true
        await frame()
        buttons[3].pressed = false
        await frame()
      }
    })
    await page.goto(new URL('../dist/turn-pro-launch.html', import.meta.url).href)
    await page.evaluate(sport => {
      for (const key of ['turn-pro-club-v1', 'turn-pro-steam-preview-club-v1',
        'turn-pro-steam-preview-club-v1-guide-v1', 'turn-pro-controller-v1']) localStorage.removeItem(key)
      localStorage.setItem('turn-pro-display-v1', JSON.stringify(sport === 'soccer'
        ? { text: 'extra', contrast: 'high' } : { text: 'default', contrast: 'standard' }))
    }, sport)
    await page.reload()
    await page.bringToFront()
    const press = button => page.evaluate(index => window.pressTestButton(index), button)
    const active = () => page.evaluate(() => document.activeElement.textContent.trim())
    const checkWidth = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 1280)

    // Exercise the player's entire route with gamepad input. Launch and reload stand in for starting the app.
    await press(13)
    assert.equal(await active(), 'Choose a guided drill')
    await press(0)
    if (sport === 'soccer') await press(13)
    assert.match(await active(), new RegExp(`Practice a ${sport}`))
    await press(0)
    assert.equal(await page.locator('#sport').inputValue(), sport)
    await checkWidth()
    await press(3)
    assert.match(await page.locator('.turn-clock').innerText(), /Turn 1/i)
    const steps = await page.locator('#practice-checklist li').count()
    assert.ok(steps >= 2)
    for (let step = 0; step < steps; step++) {
      assert.equal(await active(), 'Find next order')
      await press(0)
      assert.equal(await page.locator('#actions [data-command]:focus').count(), 1)
      await press(0)
    }
    assert.match(await active(), /Commit turn/)
    await press(3)
    assert.match(await page.locator('.timeline').first().innerText(), sport === 'soccer' ? /with a through ball/ : /catches and shoots/)
    assert.equal(await active(), 'Play a full match')
    await press(0)
    assert.match(await page.locator('.turn-clock').innerText(), /Turn 1/i)
    await press(2)
    assert.equal(await page.locator('#actions [data-command]:focus').count(), 1)
    await press(0)
    assert.match(await page.locator('#budget').innerText(), /1 \/ 3/)
    await press(3)
    await page.evaluate(() => window.reconnectHoldingCommit())
    assert.match(await page.locator('.turn-clock').innerText(), /Turn 2/i)
    for (let turn = 1; turn < turns; turn++) await press(3)
    assert.match(await page.locator('.turn-clock').innerText(), /Final/i)
    assert.equal(await page.locator('.timeline').count(), turns)

    assert.equal(await active(), 'Open club season')
    await press(0)
    assert.equal(await active(), 'Both sports · 6 fixtures')
    if (sport === 'soccer') {
      await press(15)
      assert.equal(await active(), 'Basketball · 4 fixtures')
      await press(15)
      assert.equal(await active(), 'Soccer · 4 fixtures')
    }
    await press(0)
    assert.equal(await active(), 'Play fixture')
    await press(0)
    await checkWidth()
    await press(2)
    await press(0)
    assert.match(await page.locator('#budget').innerText(), /1 \/ 3/)
    await press(3)
    assert.match(await page.locator('.turn-clock').innerText(), /Turn 2/i)
    const firstPlay = await page.locator('.timeline').first().innerText()
    await page.reload()
    await page.bringToFront()
    await press(13)
    assert.equal(await active(), 'Continue saved fixture')
    await press(0)
    assert.match(await page.locator('.turn-clock').innerText(), /Turn 2/i)
    assert.equal(await page.locator('.timeline').first().innerText(), firstPlay)
    await press(3)
    assert.match(await page.locator('.turn-clock').innerText(), /Turn 3/i)
    await checkWidth()
    if (sport === 'soccer') {
      assert.equal(await page.locator('html').getAttribute('data-text-size'), 'extra')
      assert.equal(await page.locator('html').getAttribute('data-contrast'), 'high')
    }
    assert.deepEqual(errors, [])
    console.log(`${sport}: controller-only drill, full match, club save and resume, and held-button reconnection passed.`)
  }
} finally {
  await browser.close()
}
