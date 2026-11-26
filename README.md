# Turn Pro

Turn Pro is a turn-based tactical sports RPG built around full teams, simultaneous plans, and athletes who develop across sports.

- [Game vision and release gates](docs/VISION.md)
- [Four-sport playtest and balance results](docs/PLAYTEST.md)
- [Build and test runs](https://github.com/killjoy00/TurnPro/actions/workflows/prototype.yml)
- [Steam depot preview](docs/STEAM-PREVIEW.md)

The four-sport prototype contains basketball, soccer, ice hockey, and American football in one game. Choose any sport at the top, give a few athletes orders, then commit to reveal and resolve both plans.

Download `turn-pro-playtest` from a successful build and open `turn-pro.html` in a browser. It includes all four sports and the solo club career.

- **Club season** offers a 12-fixture four-sport league, a six-fixture basketball-and-soccer league, and shorter single-sport seasons. Sign one prospect, set lineups, and spend one weekly session on sport XP, a shared attribute, or fatigue recovery. Athletes gain proficiency in roles they play. Train speed to unlock **Quick step** or strength to unlock **Anchor** in a sport after earning 3 XP there. Your roster, abilities, titles, and rival records carry forward. Saves keep the last committed turn and can be exported.
- **Basketball** plays 5-on-5 over 12 turns. Give Reed **Drive and kick out to Vale**, Okafor **Set screen**, and Vale **Catch and shoot** on the same turn.
- **Soccer** plays 11-on-11 over two nine-turn halves. Try **Beat the press** or **Practice a cross**. Read the pass preview after queuing a run.
- **Ice hockey** plays 6-on-6 over three six-turn periods. Start with **Practice a screened one-timer**. To change lines, select the goalie when the opponent has the puck.
- **American football** plays 11-on-11 over 24 snaps. Try **Practice third and five**. On offense, pick Balanced, Power, or Spread before calling the play and its supporting orders. Rivals adjust their defense to the visible formation. On fourth down, try for the first down, punt, or kick a field goal in range.

Select **Base assignments** during a match to inspect the jobs of teammates without a queued order and see projected movement on the court, pitch, or rink.

## Desktop playtest

Download `turn-pro-windows-x64` or `turn-pro-linux-x64` from a passing run for the four-sport prototype. Extract the entire archive, then launch `TurnPro.exe` on Windows or `TurnPro` on Linux. The Linux package uses a tar archive to preserve executable permissions. Use the standalone HTML on other platforms.

Start with **Choose a guided drill**. **Find next order** puts focus on the athlete's required order. After the drill, **Play a full match** starts a fresh match with a path into the club. A standard-mapped controller can move focus with its directional pad or left stick. **Controls** offers button remapping, adjustable text size, and a high-contrast option. **Continue saved fixture** reopens the last committed turn. Browser saves can move to the desktop version through the club screen’s export and import buttons.

## Development

Use Node.js 24 or later. On a 64-bit Windows or Linux host, `npm run desktop:package` builds the matching desktop folder in `release/`.

```sh
npm ci
npm run check
npm run build
```

The build writes `dist/turn-pro.html`. The Windows and Linux packages use that same game. The engine and opponent logic run headlessly under `npm test`. Run `npm run simulate -- 1000` for basketball and `npm run simulate:soccer -- 500` to compare the two soccer budgets on 500 seeds each. Browser CI checks all four quick matches, basketball playback, club saves, and touch controls. It also uses simulated gamepad input to complete the guided drill, a full match, and a club save and resume in all four sports at 1280×800. Desktop CI checks every sport and verifies a club fixture survives a full app restart.
