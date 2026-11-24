import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createClub, schedule } from '../src/club.ts'

const browser = await chromium.launch()
const game = new URL('../dist/turn-pro.html', import.meta.url).href

try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 950 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(game)
  assert.equal(await page.locator('.marker').count(), 10)
  await page.getByRole('button', { name: /^Drive −14 STA$/ }).focus()
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

  await page.getByRole('button', { name: 'How to play' }).click()
  await page.getByRole('button', { name: 'Practice a basketball combination' }).click()
  assert.equal(await page.getByRole('button', { name: 'Commit turn' }).isDisabled(), true)
  assert.match(await page.locator('#practice-checklist').innerText(), /Reed · Drive and kick out/)

  await page.getByRole('button', { name: /Drive and kick out to Vale/ }).click()
  await page.getByRole('button', { name: /Okafor, 100 stamina/ }).click()
  await page.getByRole('button', { name: 'Set screen' }).click()
  await page.getByRole('button', { name: /Vale, 100 stamina/ }).click()
  await page.getByRole('button', { name: 'Catch and shoot' }).click()
  await page.getByRole('button', { name: 'Commit turn' }).click()
  assert.match(await page.locator('.timeline').first().innerText(), /Vale catches and shoots/)
  assert.match(await page.locator('#practice-checklist').innerText(), /Practice play resolved/)

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
  await page.getByRole('button', { name: 'Beat the press' }).click()
  const through = page.getByRole('button', { name: /Through ball to Adeyemi/ })
  assert.match(await through.innerText(), /Clear|Guarded|Crowded/)
  await through.click()
  await page.getByRole('button', { name: /Adeyemi, 100 stamina/ }).click()
  await page.getByRole('button', { name: 'Run into the middle' }).click()
  await page.getByRole('button', { name: 'Commit turn' }).click()
  assert.match(await page.locator('.timeline').innerText(), /Reed finds Adeyemi with a through ball/)
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

  await page.getByRole('button', { name: 'Club season' }).click()
  await page.getByRole('button', { name: 'Both sports · 6 fixtures' }).click()
  await page.getByRole('button', { name: 'Train Basketball' }).click()
  assert.match(await page.locator('.sport-stats').innerText(), /Basketball · 3 XP/)
  assert.match(await page.locator('.sport-stats').innerText(), /Soccer · 0 XP/)
  await page.getByRole('button', { name: 'Sign Imani' }).click()
  await page.getByRole('button', { name: 'Soccer', exact: true }).click()
  await page.getByRole('combobox', { name: 'GK starter, slot 1' }).selectOption('imani')

  for (let fixture = 0; fixture < 6; fixture += 1) {
    await page.getByRole('button', { name: 'Play fixture' }).click()
    const limit = fixture % 2 === 0 ? 12 : 18
    assert.equal(await page.locator('.marker').count(), limit === 12 ? 10 : 22)
    if (fixture === 1) {
      assert.match(await page.getByRole('button', { name: /Imani, \d+ stamina/ }).innerText(), /Imani/)
      const reed = await page.getByRole('button', { name: /Reed, \d+ stamina/ }).getAttribute('aria-label')
      assert.ok(Number(reed.match(/(\d+) stamina/)[1]) < 100)
    }
    for (let turn = 1; turn <= limit; turn += 1) {
      if (fixture === 0 && turn === 1) await page.getByRole('button', { name: /^Drive −14 STA$/ }).click()
      await page.getByRole('button', { name: 'Commit turn' }).click()
      if (fixture === 0 && turn === 1) {
        const first = await page.locator('.timeline').first().innerText()
        await page.reload()
        await page.getByRole('button', { name: 'Club season' }).click()
        await page.getByRole('button', { name: 'Resume fixture' }).click()
        assert.match(await page.locator('.turn-clock').innerText(), /Turn 2 \/ 12/i)
        assert.equal(await page.locator('.timeline').first().innerText(), first)
      }
    }
    assert.match(await page.locator('.turn-clock').innerText(), /Final/i)
    await page.getByRole('button', { name: 'Back to club' }).click()
  }
  assert.match(await page.locator('.club-hero').innerText(), /Season complete/)
  assert.equal(await page.locator('.fixture-schedule tbody tr').filter({ hasText: /Win|Draw|Loss/ }).count(), 6)
  const exportEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export save' }).click()
  const exported = await exportEvent
  assert.equal(exported.suggestedFilename(), 'turn-pro-club.json')
  const localSave = await exported.path()
  await page.locator('#club-import').setInputFiles({
    name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"version":999}'),
  })
  await page.getByRole('status').filter({ hasText: /change could not be applied/ }).waitFor()
  assert.match(await page.locator('.club-hero').innerText(), /Season complete/)
  await page.locator('#club-import').setInputFiles(localSave)
  await page.getByRole('status').filter({ hasText: /Club save loaded/ }).waitFor()
  assert.equal(await page.locator('.fixture-schedule tbody tr').filter({ hasText: /Win|Draw|Loss/ }).count(), 6)
  assert.deepEqual(errors, [])

  await page.getByRole('button', { name: 'Start another season' }).click()
  await page.getByRole('button', { name: 'Basketball · 4 fixtures' }).click()
  assert.match(await page.locator('.club-hero').innerText(), /Season 2/)
  await page.getByText('Past seasons', { exact: true }).click()
  assert.match(await page.locator('.past-seasons').innerText(), /Season 1 · Both sports/)
  await page.getByRole('combobox', { name: 'Basketball ability for Reed' }).selectOption('thread-pass')
  await page.getByRole('combobox', { name: 'Soccer ability for Reed' }).selectOption('second-wind')
  await page.getByRole('button', { name: 'Play fixture' }).click()
  assert.match(await page.locator('.practice-ability').innerText(), /Thread the pass/)
  assert.deepEqual(errors, [])

  await page.getByRole('button', { name: 'Back to club' }).click()
  const qualifier = createClub('both')
  qualifier.results = schedule('both').map(() => [2, 0])
  qualifier.league.otherResults = schedule('both').map(() => [0, 0])
  await page.locator('#club-import').setInputFiles({
    name: 'qualified-club.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(qualifier)),
  })
  await page.getByRole('status').filter({ hasText: /Club save loaded/ }).waitFor()
  assert.match(await page.locator('.league-table .own-club').innerText(), /Comets/)
  assert.match(await page.locator('.club-hero').innerText(), /Club final · Basketball/)
  await page.getByText('Around the league', { exact: true }).click()
  assert.equal(await page.locator('.other-fixtures li').count(), 6)
  for (const limit of [12, 18]) {
    await page.getByRole('button', { name: 'Play fixture' }).click()
    for (let turn = 1; turn <= limit; turn++) await page.getByRole('button', { name: 'Commit turn' }).click()
    await page.getByRole('button', { name: 'Back to club' }).click()
  }
  assert.match(await page.locator('.league-outcome').innerText(), /Champion|Runner-up/)
  assert.equal(await page.locator('.fixture-schedule tbody tr').count(), 8)
  await page.getByText('Rival records', { exact: true }).click()
  assert.match(await page.locator('.rival-records[open]').innerText(), /Forge/)
  assert.deepEqual(errors, [])

  await page.getByRole('button', { name: 'Quick match' }).click()
  await sport.selectOption('hockey')
  assert.equal(await page.locator('.marker').count(), 12)
  assert.match(await page.locator('#possession').innerText(), /Puck/)
  assert.match(await page.locator('#lineup-detail').innerText(), /Line 1/)
  await page.getByRole('button', { name: 'Practice a screened one-timer' }).click()
  await page.getByRole('button', { name: /Pass to Vale/ }).click()
  await page.getByRole('button', { name: /Vale, 100 stamina/ }).click()
  await page.getByRole('button', { name: /Ready one-timer/ }).click()
  await page.getByRole('button', { name: /Okafor, 100 stamina/ }).click()
  await page.getByRole('button', { name: /Screen the goalie/ }).click()
  await page.getByRole('button', { name: 'Commit turn' }).click()
  assert.match(await page.locator('.timeline').first().innerText(), /Reed finds Vale/)
  assert.match(await page.locator('.timeline').first().innerText(), /Okafor screens Hart/)
  await page.getByRole('button', { name: 'New match' }).click()
  for (let turn = 1; turn <= 18; turn++) {
    await page.getByRole('button', { name: 'Commit turn' }).click()
    if (turn === 6 || turn === 12) assert.match(await page.locator('.timeline').first().innerText(), /switch ends/)
  }
  assert.match(await page.locator('.turn-clock').innerText(), /Final/i)

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
  })
  await mobile.goto(game)
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth), 390)
  await mobile.getByRole('button', { name: /^Drive −14 STA$/ }).tap()
  assert.match(await mobile.locator('#budget').innerText(), /1 \/ 3/)
  await mobile.getByRole('button', { name: 'Commit turn' }).tap()
  assert.match(await mobile.locator('.turn-clock').innerText(), /Turn 2/i)
  await mobile.getByRole('combobox', { name: 'Sport', exact: true }).selectOption('soccer')
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth), 390)
  assert.match(await mobile.locator('.turn-clock').innerText(), /Attack up/i)
  await mobile.getByRole('button', { name: 'Carry forward' }).tap()
  await mobile.getByRole('button', { name: 'Commit turn' }).tap()
  assert.match(await mobile.locator('.turn-clock').innerText(), /Turn 2/i)
  await mobile.evaluate(() => localStorage.removeItem('turn-pro-club-v1'))
  await mobile.reload()
  await mobile.getByRole('button', { name: 'Club season' }).tap()
  await mobile.getByRole('button', { name: 'Soccer · 4 fixtures' }).tap()
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth), 390)
  assert.match(await mobile.locator('.club-hero').innerText(), /Soccer vs Forge/)
  await mobile.getByRole('button', { name: 'Quick match' }).tap()
  await mobile.getByRole('combobox', { name: 'Sport', exact: true }).selectOption('hockey')
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth), 390)
  assert.match(await mobile.locator('.turn-clock').innerText(), /Attack up/i)
  console.log('Basketball, soccer, hockey, the club final, save restoration, and mobile touch passed.')
} finally {
  await browser.close()
}
