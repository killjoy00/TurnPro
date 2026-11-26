import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const browser = await chromium.launch()
try {
  const cases = [
    { sport: 'basketball', turns: 12, practice: /catches and shoots/, season: 'Basketball' },
    { sport: 'soccer', turns: 18, practice: /with a through ball/, season: 'Soccer' },
    { sport: 'hockey', turns: 18, practice: /Okafor screens Hart/, season: 'Ice hockey' },
    { sport: 'football', turns: 24, practice: /route matched.*pass protection/, season: 'American football' },
  ]
  for (const [index, { sport, turns, practice, season }] of cases.entries()) {
    const unit = sport === 'football' ? 'Snap' : 'Turn'
    const turnClock = number => new RegExp(`${unit} ${number}`, 'i')
    const page = await browser.newPage({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })
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
    await page.goto(new URL('../dist/turn-pro.html', import.meta.url).href)
    await page.evaluate(sport => {
      for (const key of ['turn-pro-club-v1', 'turn-pro-steam-preview-club-v1',
        'turn-pro-club-v1-guide-v1', 'turn-pro-controller-v1']) localStorage.removeItem(key)
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
    for (let step = 0; step < index; step++) await press(13)
    assert.match(await active(), new RegExp(`Practice a ${sport}`))
    await press(0)
    assert.equal(await page.locator('#sport').inputValue(), sport)
    await checkWidth()
    await press(3)
    assert.match(await page.locator('.turn-clock').innerText(), turnClock(1))
    const steps = await page.locator('#practice-checklist li').count()
    assert.ok(steps >= 2)
    for (let step = 0; step < steps; step++) {
      assert.equal(await active(), 'Find next order')
      await press(0)
      assert.equal(await page.locator('#actions [data-command]:focus').count(), 1)
      await press(0)
    }
    assert.match(await active(), new RegExp(`Commit ${unit}`, 'i'))
    await press(3)
    assert.match(await page.locator('.timeline').first().innerText(), practice)
    assert.equal(await active(), 'Play a full match')
    await press(0)
    assert.match(await page.locator('.turn-clock').innerText(), turnClock(1))
    await press(2)
    assert.equal(await page.locator('#actions [data-command]:focus').count(), 1)
    await press(0)
    assert.match(await page.locator('#budget').innerText(), /1 \/ 3/)
    await press(3)
    await page.evaluate(() => window.reconnectHoldingCommit())
    assert.match(await page.locator('.turn-clock').innerText(), turnClock(2))
    for (let turn = 1; turn < turns; turn++) await press(3)
    assert.match(await page.locator('.turn-clock').innerText(), /Final/i)
    assert.equal(await page.locator('.timeline').count(), turns)

    assert.equal(await active(), 'Open club season')
    await press(0)
    assert.equal(await active(), 'All four sports · 12 fixtures')
    for (let step = 0; step < index + 2; step++) await press(15)
    assert.equal(await active(), `${season} · 4 fixtures`)
    await press(0)
    assert.equal(await active(), 'Play fixture')
    await press(0)
    await checkWidth()
    await press(2)
    await press(0)
    assert.match(await page.locator('#budget').innerText(), /1 \/ 3/)
    await press(3)
    assert.match(await page.locator('.turn-clock').innerText(), turnClock(2))
    const firstPlay = await page.locator('.timeline').first().innerText()
    await page.reload()
    await page.bringToFront()
    await press(13)
    assert.equal(await active(), 'Continue saved fixture')
    await press(0)
    assert.match(await page.locator('.turn-clock').innerText(), turnClock(2))
    assert.equal(await page.locator('.timeline').first().innerText(), firstPlay)
    await press(3)
    assert.match(await page.locator('.turn-clock').innerText(), turnClock(3))
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
