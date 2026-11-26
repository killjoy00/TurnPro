# Four-sport playtest

Use one [four-sport build](https://github.com/killjoy00/TurnPro/actions/workflows/prototype.yml) per round so matches, controls, and career choices can be compared. Download the `turn-pro-playtest` artifact and open `turn-pro.html`, or use the Windows or Linux package. For the built-in report, open **How to play → Playtest feedback → Start recording**. The report records elapsed time, turns committed, and scores in the current tab. Download it to share. Include your build, device, and input method in the notes.

## Playtest route

Try the first coached play without hints beyond the game. Rotate the starting sport across testers to spread the learning effect. Take a break between sports if needed and mention breaks in your report.

| Activity | What to play | What to capture |
| --- | --- | --- |
| Basketball | Practice a kick-out, then play a quick match. | Watch the revealed plans, screen, ball flight, and result. Can you explain why the shooter got open? Try **Skip playback** during another turn and check that you can identify the outcome in the log. |
| Soccer | Beat the press or practice a cross, then play a quick match. | Can you tell how the receiver's run changes the pass, and why a pass went through or got intercepted? |
| Ice hockey | Practice a screened one-timer, then play a quick match. | Try the one-timer preview before and after queuing the screen. Explain what the screen adds and when to change lines. |
| American football | Practice third and five, then play a quick match. | Compare the queued pass with and without protection. Explain a fourth-down choice. |
| Club season | Start an **All four sports** season, make a lineup and training decision, and complete the first two fixtures. Open a fixture and reload partway through. | Which athlete did you rotate? Why did you choose sport XP, film, or recovery? Did the next lineup's stamina and replayed turn match what you expected? |

For each sport, note the first time you had to guess what to do, one result you can explain, and whether you would play another match. Reopen **Playtest feedback** and select **Download feedback** when done. If you already have a club, export its save before using a fresh test profile.

## Athlete builds

Give a basketball or soccer athlete three XP in that sport and three Finisher mastery through fixtures or general training. Use the available weekly session to learn **Cut and finish**. In a fixture, queue the cut and a teammate's pass. Check whether the order preview and the play-by-play explain why a shot happened or why the move stalled.

In a later week, switch the same athlete to Defender, build three Defender mastery, and learn **Jump the lane**. Equip it in place of Cut and finish. Leave the defender unassigned near the corridor to a likely receiver, then try another turn with an explicit defensive order. Check whether the reaction, stamina cost, and recovery tradeoff are clear. Compare the same athlete in both builds and record when you would choose each.

For a three-athlete combination, teach a Playmaker **One-touch relay** and pair a first pass with a relay to a trained Finisher. Compare this with a direct pass using the same lineup. Watch which lane the second pass opens and whether its extra turnover risk is clear.

Before the following fixture, compare a targeted skill drill with general training or recovery. Reach six mastery in a specialty, switch the athlete's active specialty, and try their former passive in a sport where they have six XP.

## Automated baseline and tuning

Run `npm run simulate:playtest -- 500 20` for 500 seeded computer matches per sport and 20 seeded four-sport regular seasons per lineup policy. The club policies use the same recruit, fixtures, and seeds. Rotation swaps in the freshest available athlete when a slot permits it. The third policy also spends the weekly session on recovery when an upcoming starter can use it. An AI result can expose a balance issue. Human playtests establish whether the choices are clear, fair, and worth repeating.

| Measure | Before | After |
| --- | ---: | ---: |
| Soccer 0–0 matches out of 500 | 233 | 213 |
| Soccer goals | 323 | 365 |
| Soccer turnover events | 2,300 | 2,111 |
| Default lineup starts at the fatigue cap | 26.0% | 9.7% |
| Mean starting stamina with the default lineup | 59.2 | 63.5 |
| Mean starting stamina with lineup rotation | 65.1 | 72.6 |
| Mean starting stamina with rotation and weekly recovery | 68.2 | 76.4 |

Soccer's opponent uses projected lanes and takes more viable shots. Football's opponent considers a late field goal when three points can tie the game or take the lead. Active saves keep the tactics that produced their earlier turns. A four-sport club now sheds 24 fatigue between weeks instead of 18. Fatigue still carries between fixtures in the same week.

Current match feedback updates queued estimates when a teammate adds support. Hockey previews the screen and pass required for a one-timer. Football reports sack risk and names the route, protection, and coverage involved after the snap. The club screen shows the next lineup's fitness before kickoff. Compare these details with tester explanations before further tuning.
