# Turn Pro

Turn Pro is a turn-based tactical sports RPG built around full teams, simultaneous plans, and athletes who develop across sports.

- [Game vision and release gates](docs/VISION.md)
- [Build and test runs](https://github.com/killjoy00/TurnPro/actions/workflows/prototype.yml)

The offline build includes 5-on-5 half-court basketball and 11-on-11 soccer, each against the computer. Choose a sport at the top, give a few athletes orders, then commit to reveal and resolve both plans. Basketball runs for 12 turns. Soccer runs for two nine-turn halves.

Download the `turn-pro-prototypes` artifact from a successful build and open `turn-pro.html` in a browser. In Soccer, **Practice a cross** starts an attacking scenario. Set **Next match orders** to four and start a new match to compare it with the default three.

## Development

Use Node.js 24 or later.

```sh
npm ci
npm run check
npm run build
```

The build writes `dist/turn-pro.html`. The engine and opponent logic run headlessly under `npm test`. Run `npm run simulate -- 1000` for basketball and `npm run simulate:soccer -- 500` to compare the two soccer budgets on 500 seeds each. CI opens the offline HTML in Chromium, plays both matches, checks the soccer crossing scenario, and exercises mobile touch controls.
