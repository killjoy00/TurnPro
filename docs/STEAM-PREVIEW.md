# Steam launch candidate

The launch candidate contains basketball, soccer, and the solo club career. Hockey is available in the separate playtest edition.

## Prepare the Windows and Linux builds

1. Use the two `turn-pro-launch-*-x64` artifacts from the same successful [build run](https://github.com/killjoy00/TurnPro/actions/workflows/prototype.yml). Extract both inner archives into `release/launch`, retaining the `TurnPro-win32-x64` and `TurnPro-linux-x64` directories.
2. Launch `TurnPro.exe` on Windows and `TurnPro` on Linux. Start a fixture, commit a turn, close the game, and reopen it to check that the fixture resumes. The build workflow runs these checks on both platforms.
3. With the real Steamworks app ID and the two platform depot IDs in the shell variables below, generate the preview scripts.

```sh
npm run steam:preview -- \
  --app-id "$TURN_PRO_STEAM_APP_ID" \
  --windows-depot "$TURN_PRO_STEAM_WINDOWS_DEPOT" \
  --linux-depot "$TURN_PRO_STEAM_LINUX_DEPOT"
```

The generator verifies that the packages are launch candidates from the same build and that each packaged game matches its checksum. Use `--packages` for a different extraction folder and `--output` for a different script destination. The generated app and depot scripts in `release/steam-preview` use absolute local paths. Regenerate them after moving the packages.

Run the generated app script with the Steamworks SDK's SteamPipe builder. Preview mode produces build logs and a file manifest locally. Check that each depot contains its own executable, `resources/app.asar`, and the runtime files beside them. [SteamPipe build script reference](https://partner.steamgames.com/doc/sdk/uploading)

## Confirm release readiness

- Configure the Windows and Linux launch options with their corresponding executables and install the build through a private Steam branch for testing.
- On a physical Steam Deck in Gaming Mode, complete both a basketball and a soccer match using only the controller. Check 1280×800 readability, button prompts, name entry, save recovery after restart, and suspend and resume. Record the package or Steam build ID and SteamOS version with the results. [Steam Deck compatibility](https://partner.steamgames.com/doc/steamhardware/compat)
- Prepare the store materials and submit the store page and build for Steamworks review. Publish both sports on the paid release together once the reviews and hardware checks are complete. [Steamworks review process](https://partner.steamgames.com/doc/store/review_process)
