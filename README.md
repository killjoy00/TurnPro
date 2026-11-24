# Turn Pro

Turn Pro is a turn-based tactical sports RPG built around full teams, simultaneous plans, and athletes who develop across sports.

- [Game vision and release gates](docs/VISION.md)
- [Build and test runs](https://github.com/killjoy00/TurnPro/actions/workflows/prototype.yml)

The first playable build is 5-on-5 half-court basketball against a computer opponent. Give up to three athletes orders, then commit both teams' plans. A match ends after 12 turns.

Download the `turn-pro-basketball` artifact from a successful build and open `turn-pro.html` in a browser. The file runs offline.

## Development

Use Node.js 24 or later.

```sh
npm ci
npm run check
npm run build
```

The build writes `dist/turn-pro.html`. The engine and opponent logic run headlessly under `npm test`.
