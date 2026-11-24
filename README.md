# Turn Pro

Turn Pro is a turn-based tactical sports RPG built around full teams, simultaneous plans, and athletes who develop across sports.

- [Game vision and release gates](docs/VISION.md)
- [Build and test runs](https://github.com/killjoy00/TurnPro/actions/workflows/prototype.yml)

The offline build includes 5-on-5 half-court basketball and 11-on-11 soccer, each against the computer. Choose a sport at the top, give a few athletes orders, then commit to reveal and resolve both plans. Basketball runs for 12 turns. Soccer runs for two nine-turn halves.

Download the `turn-pro-playtest` artifact from a successful build and open `turn-pro.html` in a browser.

- **Club season** offers six mixed-sport fixtures or four in a single sport. Sign one prospect, set starters and specialties, and spend one training session each week. The save keeps the season record, athlete progress, and the last committed turn. Export a save to move it between browsers or copies of the HTML.
- **Soccer quick match** offers a high press and compact defense, with guided **Beat the press** and **Practice a cross** setups. Read the pass preview after adding a run. Set **Next match orders** to four to compare it with the default three.
- **Basketball quick match** offers three-order combinations. Give Reed **Drive and kick out to Vale**, Okafor **Set screen**, and Vale **Catch and shoot** on the same turn. Try a defense that helps in the paint or one that stays with shooters.

## Development

Use Node.js 24 or later.

```sh
npm ci
npm run check
npm run build
```

The build writes `dist/turn-pro.html`. The engine and opponent logic run headlessly under `npm test`. Run `npm run simulate -- 1000` for basketball and `npm run simulate:soccer -- 500` to compare the two soccer budgets on 500 seeds each. CI opens the offline HTML in Chromium and checks both quick matches, the soccer drills, a full mixed season, reload and import/export, and mobile touch controls.
