# Turn Pro

Turn Pro is a turn-based tactical sports RPG built around full teams, simultaneous plans, and athletes who develop across sports.

- [Game vision and release gates](docs/VISION.md)
- [Build and test runs](https://github.com/killjoy00/TurnPro/actions/workflows/prototype.yml)
- [Steam launch candidate and depot preview](docs/STEAM-PREVIEW.md)

The four-sport prototype contains basketball, soccer, ice hockey, and American football in one game. Choose any sport at the top, give a few athletes orders, then commit to reveal and resolve both plans.

Download `turn-pro-playtest` from a successful build and open `turn-pro.html` in a browser. The separate `turn-pro-launch-browser` artifact is the basketball-and-soccer Steam packaging preview.

- **Club season** offers six mixed-sport fixtures or four in a single sport. Sign one prospect, set starters and specialties, unlock and equip a sport ability, and spend one training session each week. Climb the four-club table and qualify for a final. A mixed final has one basketball and one soccer fixture. Take the same club, titles, and rival records into another season. The save keeps the season record, athlete progress, and the last committed turn. Export a save to move it between browsers or copies of the HTML.
- **Basketball** plays 5-on-5 over 12 turns. Give Reed **Drive and kick out to Vale**, Okafor **Set screen**, and Vale **Catch and shoot** on the same turn.
- **Soccer** plays 11-on-11 over two nine-turn halves. Try **Beat the press** or **Practice a cross**. Read the pass preview after queuing a run.
- **Ice hockey** plays 6-on-6 over three six-turn periods. Start with **Practice a screened one-timer**. To change lines, select the goalie when the opponent has the puck.
- **American football** plays 11-on-11 over 24 snaps. Try **Practice third and five**. Call a play with the quarterback and support it with two assignments. On fourth down, try for the first down, punt, or kick a field goal in range.

## Desktop playtest

Download `turn-pro-windows-x64` or `turn-pro-linux-x64` from a passing run for the four-sport prototype. Extract the entire archive, then launch `TurnPro.exe` on Windows or `TurnPro` on Linux. The Linux package uses a tar archive to preserve executable permissions. Use the standalone HTML on other platforms.

Open **How to play** for guided combinations. A standard-mapped controller can move focus with its directional pad or left stick. **Controls** offers button remapping, adjustable text size, and a high-contrast option. Browser saves can move to the desktop version through the club screen’s export and import buttons.

## Development

Use Node.js 24 or later. On a 64-bit Windows or Linux host, `npm run desktop:package` builds the matching desktop folder in `release/`.

```sh
npm ci
npm run check
npm run build
npm run build:launch
```

The builds write `dist/turn-pro.html` and `dist/turn-pro-launch.html`. The engine and opponent logic run headlessly under `npm test`. Run `npm run simulate -- 1000` for basketball and `npm run simulate:soccer -- 500` to compare the two soccer budgets on 500 seeds each. Browser CI completes all four quick matches from the same file and checks club saves, controller navigation, and touch controls. Desktop CI plays a snap or turn in every sport and verifies a club fixture survives a full app restart.
