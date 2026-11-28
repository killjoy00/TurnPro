# Vale build and counterplay audit

Basketball and soccer now have a signature-aware AI policy. On offense it can feed a finisher directly, route a pass through a Playmaker relay, or choose a safer delivery against a lane reader. On defense it can leave its own lane reader free to react and use a spare defender to deny the pass or hold the defensive line. The planner uses public match state and estimates. New club fixtures scout the Breakers’ Cut and finish and the Rovers’ Jump the lane. Earlier saved fixtures keep their recorded opponent policy.

## Build investment

| Investment | Transition Finisher | Two-way Defender |
| --- | --- | --- |
| Shared starting point | Vale’s natural Speed, same lineup spot, 6 sport XP, 3 active specialty mastery | Same |
| Signature and passive | Cut and finish, Quick step | Jump the lane, Second wind |
| One sport drill | Shooting or finishing | Shot contests or tackling |
| One athletic session | Speed | Endurance |
| Match role | Spend an order on the cut and coordinate delivery | Leave Vale free to react, with another athlete assigned to pressure or coverage |

Reed has the same One-touch relay loadout in both clubs. Each row below compares two full matches at each of 240 matched seeds, for 4,320 matches across nine scenarios. Both builds used the signature-aware planner against the same opponent policy in each pair. The pass-first basketball rival prefers a pass and immediate catch-and-shoot under pressure. The other rivals use their named style and either the earlier or signature-aware policy. The seed bands and scripted teams model specific matchups. Human playtests are listed in issue #13.

Run `npm run simulate:vale` to reproduce the full JSON, including losses, points or goals, shot counts and mean shot probability, turnovers, signature activations, turns left unassigned, passive use, and remaining stamina. The win-rate intervals are approximate 95% paired intervals over the seeded samples for each scenario.

## Results

| Sport and matchup | Finisher wins | Defender wins | Finisher win-rate lead, points (95% interval) | Finisher first-time shots | Defender lane reads (with turnover) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Basketball, switch, earlier AI | 192 | 107 | +35.4 (27.0 to 43.8) | 1,279 | 0 (0) |
| Basketball, switch, signature-aware AI | 171 | 107 | +26.7 (17.7 to 35.7) | 1,243 | 0 (0) |
| Basketball, pass denial, signature-aware AI | 179 | 128 | +21.3 (12.6 to 29.9) | 1,269 | 0 (0) |
| Basketball, pass-first rival, Vale at small forward | 200 | 163 | +15.4 (8.3 to 22.5) | 1,362 | 897 (409) |
| Soccer, high press, earlier AI | 67 | 52 | +6.3 (−1.3 to 13.8) | 100 | 11 (1) |
| Soccer, high press, signature-aware AI | 68 | 52 | +6.7 (−0.8 to 14.1) | 104 | 0 (0) |
| Soccer, compact, signature-aware AI | 127 | 118 | +3.8 (−1.6 to 9.1) | 119 | 0 (0) |
| Soccer, high press, earlier AI, Vale at attacking midfield | 79 | 62 | +7.1 (−0.3 to 14.5) | 266 | 346 (155) |
| Soccer, high press, signature-aware AI, Vale at attacking midfield | 95 | 69 | +10.8 (3.2 to 18.5) | 304 | 0 (0) |

In basketball, signature-aware switch defense reduced Finisher wins from 192 to 171, and average scoring fell from 8.95 to 7.97. The Finisher still won substantially more often in every tested matchup. The Defender’s reaction mattered when opponents passed frequently into a central lane. In that matchup, the Defender finished with 81.6 stamina on average, compared with 15.1 for the Finisher.

In soccer, moving Vale in from the wing gave the reaction more opportunities against the earlier AI. The signature-aware opponent rerouted passes around Vale and produced zero recorded lane jumps in the tested soccer matchups. Case tests show that a safe delivery can prevent a reaction that the earlier AI would have triggered. Those tests also verify a three-athlete pass, relay, and shot in both sports. Soccer produced 35 relay-to-Vale shots in the full audit. Basketball needs further lineup and delivery testing for that combination under full-match conditions.

The results support distinct play patterns and show where the Defender pays off. The basketball scoring gap and the value of rerouted soccer possessions need further testing before adding advanced mastery bonuses.

Related coverage and remaining work are tracked in [issue #13](https://github.com/killjoy00/TurnPro/issues/13).
