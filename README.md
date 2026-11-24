# Turn Pro

Turn Pro is a turn-based tactical sports RPG built around full teams, simultaneous plans, and athletes who develop across sports.

- [Game vision and release gates](docs/VISION.md)
- [Build and test runs](https://github.com/killjoy00/TurnPro/actions/workflows/prototype.yml)
- [Steam launch candidate and depot preview](docs/STEAM-PREVIEW.md)

Choose a sport at the top, give a few athletes orders, then commit to reveal and resolve both plans. Play 5-on-5 half-court basketball over 12 turns and 11-on-11 soccer over two nine-turn halves. The playtest edition also offers 6-on-6 ice hockey over three six-turn periods.

Download `turn-pro-playtest` from a successful build and open `turn-pro.html` in a browser. For the two-sport launch candidate, use `turn-pro-launch-browser` and open `turn-pro-launch.html`.

- **Club season** offers six mixed-sport fixtures or four in a single sport. Sign one prospect, set starters and specialties, unlock and equip a sport ability, and spend one training session each week. Climb the four-club table and qualify for a final. A mixed final has one basketball and one soccer fixture. Take the same club, titles, and rival records into another season. The save keeps the season record, athlete progress, and the last committed turn. Export a save to move it between browsers or copies of the HTML.
- **Soccer quick match** offers a high press and compact defense, with guided **Beat the press** and **Practice a cross** setups. Read the pass preview after adding a run. Set **Next match orders** to four to compare it with the default three.
- **Basketball quick match** offers three-order combinations. Give Reed **Drive and kick out to Vale**, Okafor **Set screen**, and Vale **Catch and shoot** on the same turn. Try a defense that helps in the paint or one that stays with shooters.
- **Ice hockey quick match** lets you carry the puck, forecheck, manage stamina with line changes, and test screens and one-timers. Start with **Practice a screened one-timer**. To change lines, select the goalie when the opponent has the puck. The change uses an order and brings on five rested skaters. Hockey is currently an exhibition against the AI. Club seasons use basketball and soccer.

## Desktop playtest

Download `turn-pro-windows-x64` or `turn-pro-linux-x64` from a passing run for the full playtest. The two-sport candidate artifacts are `turn-pro-launch-windows-x64` and `turn-pro-launch-linux-x64`. Extract the entire archive, then launch `TurnPro.exe` on Windows or `TurnPro` on Linux. The Linux package uses a tar archive to preserve executable permissions. Use the standalone HTML on other platforms.

Open **How to play** for guided combinations. A standard-mapped controller can move focus with its directional pad or left stick. **Controls** offers button remapping, adjustable text size, and a high-contrast option. Browser saves can move to the desktop version through the club screen’s export and import buttons.

## Development

Use Node.js 24 or later. On a 64-bit Windows or Linux host, `npm run desktop:package` builds the matching desktop folder in `release/`.

```sh
npm ci
npm run check
npm run build
npm run build:launch
```

The builds write `dist/turn-pro.html` and `dist/turn-pro-launch.html`. The engine and opponent logic run headlessly under `npm test`. Run `npm run simulate -- 1000` for basketball and `npm run simulate:soccer -- 500` to compare the two soccer budgets on 500 seeds each. Browser CI checks quick matches, guided plays, a full mixed season, save restoration, controller navigation, mobile touch controls, and launch display settings at 1280×800. Desktop CI launches both editions on Windows and Linux and verifies a club fixture survives a full app restart.
