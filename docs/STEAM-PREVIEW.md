# Steam launch candidate

This packaging preview contains basketball, soccer, and the solo club career. The [four-sport prototype](VISION.md#prototype-completion) is the build to use for prototype testing. Commercial release planning follows that playtest.

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
- Record the physical Steam Deck results below for the exact candidate build. [Steam Deck compatibility](https://partner.steamgames.com/doc/steamhardware/compat)
- Prepare the store materials and submit the store page and build for Steamworks review. Publish both sports on the paid release together once the reviews and hardware checks are complete. [Steamworks review process](https://partner.steamgames.com/doc/store/review_process)

## Physical Steam Deck test

Record the package or Steam build ID, the SteamOS version, and whether the game ran as the Linux build or the Windows build through Proton. Start in Gaming Mode with the built-in controller. CI runs the [onboarding and save path](../scripts/controller-flow.mjs) with a simulated gamepad at 1280×800. The rows below require the physical device.

| Case | Pass condition |
| --- | --- |
| First run in basketball and soccer | Open **Choose a guided drill**, queue each prompted order, commit, select **Play a full match**, and finish both matches using only the built-in controls. |
| Readability and prompts | Score, order list, active focus, and play-by-play can be read at 1280×800. Text size and high contrast apply to both sports, and the control labels match the inputs. |
| Quit and resume | Open a club season, commit a turn, quit the game, and reopen it. **Continue saved fixture** restores the same score, turn, and play-by-play. Commit another turn. |
| Suspend and resume | Suspend with orders queued during a club fixture. After waking, the queued orders and focus remain usable. The turn advances only when you commit. |
