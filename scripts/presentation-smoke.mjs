import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import * as basketball from '../src/basketball.ts'
import * as soccer from '../src/soccer.ts'
import * as hockey from '../src/hockey.ts'
import * as football from '../src/football.ts'
import { createClub } from '../src/club.ts'
import { beginClubFixture, openClubFixture } from '../src/club-fixture.ts'

const game = new URL('../dist/turn-pro.html', import.meta.url).href
const sports = [
  { engine: basketball, sport: 'basketball', at: { x: 25, y: 6 }, choice: 'Shoot', label: /Bucket/i },
  { engine: soccer, sport: 'soccer', at: { x: 94, y: 34 }, choice: 'Shoot', label: /Goal/i },
  { engine: hockey, sport: 'hockey', at: { x: 90, y: 24 }, choice: 'Wrist shot', label: /Goal/i },
  { engine: football, sport: 'football', choice: 'Inside handoff', label: /Touchdown/i },
]

function scoringFixture({ engine, sport, at }) {
  for (let offset = 0; offset < 50; offset++) {
    const club = createClub(sport)
    club.league.seedOffset = offset * 257
    const fixture = beginClubFixture(club)
    const start = fixture.pending.start
    if (at) engine.athleteById(start.match, start.match.holder).position = at
    else start.match = football.setFormation({ ...start.match, yard: 98, sticks: 100 }, 'power')
    const { match, opponent } = openClubFixture(fixture)
    const action = at ? 'shoot' : 'inside'
    const resolve = engine.resolveTurn(match, [[{ athlete: match.holder, kind: action }], opponent(match, 1)])
    if (resolve.match.score[0]) return { fixture, score: resolve.match.score[0] }
  }
  throw new Error(`No scoring fixture found for ${sport}.`)
}

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    globalThis.soundOscillators = 0
    globalThis.ballTrails = 0
    const watch = new MutationObserver(changes => {
      for (const change of changes) {
        globalThis.ballTrails += [...change.addedNodes].filter(node => node instanceof Element && node.matches('.ball-trail')).length
      }
    })
    watch.observe(document, { childList: true, subtree: true })
    const create = AudioContext.prototype.createOscillator
    AudioContext.prototype.createOscillator = function () {
      globalThis.soundOscillators++
      return create.call(this)
    }
  })
  await page.goto(game)
  for (const sport of sports) {
    const { fixture, score } = scoringFixture(sport)
    await page.evaluate(state => localStorage.setItem('turn-pro-club-v1', JSON.stringify(state)), fixture)
    await page.reload()
    await page.getByRole('button', { name: 'Continue saved fixture' }).click()
    await page.getByRole('button', { name: new RegExp(`^${sport.choice}`) }).first().click()
    await page.getByRole('button', { name: /^Commit (turn|snap)/ }).click()
    await page.waitForFunction(() => globalThis.ballTrails > 0)
    const impact = page.locator('#match-impact strong')
    await impact.waitFor({ state: 'visible' })
    assert.match(await impact.innerText(), sport.label)
    assert.equal(await page.locator('.team-score.home .points').innerText(), String(score))
    assert.ok(await page.evaluate(() => globalThis.soundOscillators >= 6))
    await page.locator('#skip-playback').waitFor({ state: 'hidden' })
    assert.equal(await page.locator('.resolved-ball, .ball-trail, .markers.playing').count(), 0)
  }
  await page.getByRole('button', { name: 'Controls', exact: true }).click()
  await page.getByLabel('Match sound').selectOption('off')
  const { fixture, score } = scoringFixture(sports[0])
  await page.evaluate(state => localStorage.setItem('turn-pro-club-v1', JSON.stringify(state)), fixture)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await page.getByRole('button', { name: 'Continue saved fixture' }).click()
  await page.getByRole('button', { name: /^Shoot/ }).first().click()
  await page.getByRole('button', { name: /^Commit turn/ }).click()
  assert.equal(await page.locator('#skip-playback').isVisible(), false)
  assert.match(await page.locator('#match-impact strong').innerText(), /Bucket/i)
  assert.equal(await page.locator('.team-score.home .points').innerText(), String(score))
  assert.equal(await page.locator('.resolved-ball, .ball-trail').count(), 0)
  assert.equal(await page.evaluate(() => globalThis.soundOscillators), 0)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390)
  assert.deepEqual(errors, [])
  console.log('All four scoring sequences, sound, persistent mute, reduced motion, and phone layout passed.')
} finally {
  await browser.close()
}
