# Turn Pro

Turn Pro is a turn-based tactical sports RPG. Build a club of fictional athletes, develop distinct specialties, and use them together in recognizable team sports. Each match is a tactical encounter shaped by spacing, assignments, stamina, and the opponent's decisions.

The prototype is one offline game with four playable sports: basketball, soccer, ice hockey, and American football. The game should make it easy to move from a complete match in one sport to a complete match in another and see which tactical ideas carry over. The same prototype is available as an offline browser file and as Windows and Linux desktop packages.

## Prototype completion

The prototype is complete when the same packaged build meets these gates:

| Gate | Evidence |
| --- | --- |
| All four sports in one game | The sport menu opens basketball, soccer, ice hockey, and American football in the same running app. Each starts a full-sided match against the computer, accepts legal orders, reaches a final score, and can be replayed or switched to another sport. |
| One coached tactic per sport | Complete a basketball kick-out, a soccer through ball or cross, a screened hockey one-timer, and a football third-down conversion. Each turn log explains how the orders changed the play. |
| Club development and continuity | Use one roster across a four-sport season. Develop sport skills and shared awareness, manage fatigue, and reload an active fixture with its lineup, training, and committed turns. |
| Downloadable, testable builds | Automated checks complete all four sports from the same browser file. The Windows and Linux packages each expose all four sports, launch a four-sport match session, and restore a club save. Try the same builds with touch, keyboard, and a controller during playtesting. |

Use these builds for a round of four-sport human playtesting. Collect completion time, confusion about what an order will do, whether the player can explain a decisive play, and whether they choose to play another match. Ask players when they trained a specialist, rested a starter, or used the same athlete in a second sport. Use the results to prioritize tactical tuning and career pacing. [Playtest route and automated balance results](PLAYTEST.md)

## What players do

Read the court and current possession, anticipate the opponent, and give a few athletes specific instructions. Both teams commit their plans privately. The engine reveals the plans, plays out their interaction, and explains the resulting position, possession, or score. The next turn starts from that result.

The match should be worth replaying with a different plan before persistent progression is added. Between matches, recruit and train athletes, choose roles and abilities, manage recovery, and set lineups and team tactics. Players can specialize in one sport throughout a career. Multi-sport participation creates additional ways to compete and develop a club.

## Design pillars

- **A few consequential decisions.** Full teams participate while the player gives a limited number of direct orders. Off-ball instructions should be as valuable as some on-ball instructions.
- **Recognizable sports.** Preserve the sport's team size, scoring incentives, and tactical problems. Compress time and routine transitions to keep matches moving.
- **Readable counterplay.** Show possession, assignments, movement intent, and risk estimates based on public information. After a turn, show which movement, support, pressure, fatigue, and chance changed the outcome.
- **Athletes with distinct builds.** Let players solve the same tactical problem with different lineups, complementary strengths, and an opportunity cost for equipping abilities.
- **Depth across sports.** Preserve an athlete's identity, transferable strengths, and career across sports while tracking technical training separately.
- **Fair competition.** Protect private commands, equalize power in ranked competition, and keep paid content from buying an advantage.

## What each sport asks of the player

| Sport | Active athletes per side | Tactical identity |
| --- | --- | --- |
| Basketball | 5 | Space the floor, set screens, time drives and cuts, rotate on defense, and rebound. |
| Soccer | 11 | Build through lines, time runs, protect shape, press, and create chances over multiple turns. Goalkeepers handle routine saves. |
| Ice hockey | 6 including the goaltender | Manage rapid transitions, puck movement, pressure, and line changes. |
| American football | 11 | Pick formations and base plays, then spend commands adjusting assignments. A snap is the planning and resolution unit. |

Three direct commands per side, each assigned to a distinct athlete, is the starting hypothesis. Uncommanded athletes fill visible assignments such as spacing, marking, rotating, blocking, or rebounding. Movement, role, fatigue, and nearby threats influence those assignments. Future trials can compare free commands, primary/support/flexible slots, action points, and simple conditions such as a pass when double-teamed.

Resolution uses phases within one jointly planned turn. A screen can be set before movement, a defender can rotate during the drive, and a pass or shot can then resolve in the resulting space. Local pressure estimates describe the current state and can change after either side moves. Controlled, seeded randomness adds uncertainty to execution. Previews and the turn log explain the factors players can influence. Basketball now reveals both plans and uses resolved events to show movement, screens, and ball flight on the court. A player can skip the sequence, and the game follows the system’s reduced-motion setting.

## Athlete and club progression

An athlete has an identity, physical profile, tendencies, strengths, fatigue, and development potential. Universal attributes such as speed, strength, endurance, awareness, and composure carry across sports. Technical skills, role proficiency, and experience are tracked for each sport. A fast athlete starting soccer can get to the ball quickly and still need to learn finishing and first touch.

Specialties offer distinct tools and tradeoffs. Start by testing Playmaker, Defender, and Finisher builds with active, passive, or reaction choices that change decisions on the court. Later candidates include Speedster, Technician, Enforcer, Strategist, Captain, Ironman, and All-Rounder. A player might combine a Playmaker's passing options with a Defender's off-ball reaction while giving up a second scoring ability. The first shared progression experiment should demonstrate one athlete bringing a useful universal trait into soccer with a lower independent soccer skill level.

The shared skill choices now include speed for movement and routes, strength for contact, endurance for unassigned recovery, and composure for accuracy under fatigue. Spend a weekly session to raise one attribute by one point, up to two points in each. Quick step extends ordered movement at 50 stamina or higher, and Anchor improves contact. Each unlock requires one point in its matching attribute and three XP in the sport. Equipping either uses the athlete's one ability slot in that sport.

Role proficiency tracks where an athlete actually plays. Three appearances in a role earn +1 to its associated rating, and six earn +2. A basketball point guard improves passing, a hockey goalie improves keeping, and football retains proficiency for each paired role. A reserve skater earns proficiency after taking the ice. Lineup choices show any bonus for that position.

The career grows from a modest roster through recruitment, training, lineups, recovery, competitions, and rival clubs. Distinct opponents should invite tactical adaptation. A possession-focused soccer rival demands a different plan from a transition-heavy one. Shared training resources and scheduling make specialists and generalists valuable in different situations.

## Competitive play and pacing

Solo quick matches should aim for 5–10 minutes, standard competitive matches for 10–15 minutes, and live competitive planning windows for 15–25 seconds. These are playtest targets. Compressed halves, quarters, or periods and adjustable playback speed support different session lengths.

Career allows full progression. A future Club League can put persistent rosters under equivalent budgets or divisions. Ranked play should standardize power and give players the same roster-building budget. Online play follows a viable solo game. A future server owns game state and resolution, validates legal commands against the current rules version, reveals plans after both lock, and supports recovery from timeout or disconnect. Replay inputs include the initial state, rule version, seed, and both committed plans. Casual and private matches, asynchronous play, leagues, spectating, and tournaments can follow in sequence.

## Basketball prototype

The first playable build uses two fixed 5-player lineups, one half court, short matches, and one AI opponent. The half-court format resets the two lineups when possession changes and plays out offensive rebounds in place. That keeps tactical decisions concentrated while we test spacing and counterplay. Switching ends, regulation clocks, fouls, free throws, and substitutions belong to later basketball work.

| Area | First build | Next design test |
| --- | --- | --- |
| Planning | Up to three independent orders. Pass, drive, shoot, cut, screen, mark, deny the lane, and protect the paint. | Compare free commands with role-based slots. Test a safe fallback condition if pass and drive options need one. |
| Court | Continuous coordinates, three landmark targets for movement, spacing and automatic defensive matchups. | Test cuts against defensive switches and more varied lineups before adding more waypoints. |
| Resolution | Screens, movement, ball action, rebound or reset. End the match after 12 turns with draws allowed. | Instrument points and turnovers per possession. Test a compressed shot clock and tied-match format if pacing warrants it. |
| Resources | Visible stamina costs and recovery, basic speed, strength, passing, and shooting ratings. | Measure repeated use of a star. Add substitutions and position-specific skills once fatigue changes choices. |
| Feedback | Current position and holder, selectable legal commands, public-state shot estimate, revealed orders, and a plain-language turn history. | Ask players to predict a screen, coverage, or stamina effect before and explain it after. |
| AI | Rule-based selection from public state. It follows the same action budget and validation. | Compare two measurable opponent styles and check that each can be countered. |

A first playtest should include these situations:

1. Start a match with a screen and drive, then read who gained or lost space.
2. Use a cut and pass to create a different scoring opportunity. Explain the effects of defensive coverage on the pass or shot.
3. Defend a live possession, observe an automatic contest or rebound, and finish the match without help.
4. Replay with a different plan and record the completion time, rule confusion, outcome explanations, and whether the player wants another match.

Measure first-turn completion, match completion time, scoring and turnover rates, command use, opening-possession bias, and how often a player can explain the last outcome. Simulation can flag likely balance problems. Human playtests determine whether choices are clear and interesting.

## Soccer prototype

The first soccer build puts two 4-3-3 lineups on a full pitch. Each side commits up to three orders from the same public state. The attack can carry, pass, play a through ball, cross, shoot, or send a teammate into a channel. The defense can press or hold its line. Uncommanded players shift with the ball, and goalkeepers track it and attempt saves automatically. Turnovers preserve the on-field positions. Goals restart at midfield, and teams switch ends after nine turns.

Offside uses the positions at the start of the turn as the release snapshot. A runner who starts onside can move into space before the pass arrives. **Practice a cross** sets up a winger and striker to demonstrate this timing. Try it before a full match to learn how the turn log reports movement and ball outcomes.

| Commands per side | Matches | Goals | Shots | Scoreless |
| --- | ---: | ---: | ---: | ---: |
| 3 | 500 | 308 | 1,311 | 242 |
| 4 | 500 | 265 | 1,134 | 265 |

The seeded AI comparison uses the same 500 starting seeds for both budgets. Three commands remain the default for playtesting. In this prototype, the fourth command gave both teams more off-ball coverage and produced fewer shots. Goal creation and pacing still need human playtests. Both options are available in the browser build.

## First club season playtest

A club can play four fixtures in one sport or six fixtures over three weeks across basketball and soccer. Recruit one prospect, change starters and specialties, and spend one training session per week. Results and training add experience for the sport played. Awareness influences passing in basketball and soccer. Playing a second fixture in a week carries fatigue into the next starting lineup, so one athlete's value depends on who can cover for them. A completed season preserves results and points. The browser saves at each committed turn, and an exported file can restore the club and its current fixture. The save records plans with the rules version so the active match can be reconstructed.

Quick matches and club rivals test explicit tactical responses. High-press soccer opponents commit players forward. Compact opponents keep their shape and narrow the middle. The two soccer drills exercise a through ball with a timed run and a cross to a central runner. The pass preview uses public positions, base defensive shape, and your queued run. The turn log reports the defenders that actually closed the lane after both plans were revealed. Basketball can resolve a finish at the rim or a kick-out with a queued catch-and-shoot. The defense can switch a screen, help on a drive, or stay with a shooter.

The club season playtest succeeds when a player can change an attacking plan against a different defense, sign and develop an athlete, and finish and reload a season. Human tests can now compare whether fatigue, player specialties, and rival tactics lead to different lineup and match decisions.

## Ice hockey prototype

Two teams of five skaters and a goalie play three six-turn periods. Each team carries a second line that recovers on the bench. Build a rush with puck movement and screens, defend with a forecheck or slot coverage, and spend an order to change lines. **Practice a screened one-timer** coordinates a pass, a screen, and a shot. Watch for how often rushes create useful shot options and how clearly the game communicates tiring lines and turnovers.

## American football prototype

Two 11-player units take the field for each snap. The quarterback calls a handoff, sweep, quick pass, or deep pass. Use the remaining orders on blocking, protection, or a receiver's route. Defenders can blitz, fill a run gap, jump short routes, or drop deep. Four downs, yardage and field position drive the choices. On fourth down, go for the first down, punt, or try a field goal in range.

On offense, choose Balanced, Power, or Spread before committing the snap. Power compresses the formation and helps inside runs. Spread widens the receivers and improves pass odds. The opponent can respond to the public formation before orders reveal, so running from Spread or throwing from Power can exploit a predictable defense. The formation appears in the turn log and is saved with committed orders in club fixtures.

The quick match compresses four quarters into 24 snaps. Teams swap ends at halftime and use separate offensive and defensive units. Touchdowns include the extra point and post-score drives start from a fixed spot. **Practice third and five** gives the player a pass, a receiver's slant, and protection to line up on one snap. Test whether players recognize when a route or protection changes the odds and when to trade possession for field position.

## Career and desktop playtest

The four-sport season has 12 regular fixtures over six weeks. Each rival plays the club in all four sports. Each week, choose one athlete to practice a sport for three XP, study film for one permanent awareness point, or recover up to 28 fatigue. Film training adds up to two awareness points per athlete and helps passing in each sport. Individual sport XP improves technical ratings in that sport. One recruit can fill different roles across sports. Shorter single-sport and basketball-and-soccer seasons are also available.

Hockey starts five skaters and a goalie, with a named reserve line. Reserve skaters earn match XP after taking the ice. Football assigns 11 players to paired offensive and defensive roles, so a quarterback who spends stamina on a drive brings the same energy into the next defensive snap. XP, fatigue, and equipped abilities carry between seasons. Each athlete can equip one ability per sport. Specialty abilities require six XP and the relevant specialty in that sport. Second wind unlocks at five total XP across sports and improves in-match recovery on unassigned turns. Saves from versions 1 through 3 migrate with their existing results and in-progress fixtures.

The same solo build runs as offline HTML and as a packaged Windows or Linux desktop app. The desktop build uses a stable local origin for saves. Guided practice gives players a checklist for coordinated turns, and controller settings let players remap the game’s action buttons. The base assignment overlay explains what an uncommanded athlete will try to do and previews default movement where the engine models it.

Before the paid release, play a full match in each sport and resume a club save on a physical Steam Deck in Gaming Mode. Check controller-only navigation, on-screen instructions, text readability, and suspend and resume there. Use the verified Windows and Linux executables as launch options when setting up the corresponding Steam depots. Steam’s store page and build review follow once the commercial build and store materials are ready. [Valve’s hardware review](https://partner.steamgames.com/doc/steamhardware/compat) · [SteamPipe upload](https://partner.steamgames.com/doc/sdk/uploading) · [Steam review process](https://partner.steamgames.com/doc/store/review_process)

## Club league and final

Each regular fixture advances a four-club table. The two clubs on the other side of the schedule play a deterministic AI match in the same sport, and that score is saved with the round. The top two reach the final. Play one final leg per sport in the season and combine match points. A win earns three points and a draw earns one. A tied final goes to the higher league seed. The four-sport final runs over two weeks.

Scout the opponent before choosing starters and calling plays. Forge forechecks aggressively in hockey and sends extra blitzers in football. The Breakers guard the slot and use deeper coverage. The Rovers play a more balanced defense. The career uses these tendencies for your matches and the other league fixtures.

A season records the final outcome and results against each rival. The next season starts a fresh table with a different match seed, and the club retains its roster, training, titles, and rival records. Earlier completed saves retain their original results and remain complete. Older in-progress saves preserve their match and join the league at their current round.

## Engine and delivery

Use a headless TypeScript rules module and a browser client that renders the engine's state and submits commands. Keep state serializable and avoid hidden time or platform dependencies. Given the same starting state, rules version, seed, and plans, outcomes and event logs must match. UI estimates, AI, and validation read the same state and legal action rules. AI starts from the public snapshot captured before either plan is resolved.

All four sports share command validation, plan reveal, event formatting, browser planning controls, geometry helpers, and seeded randomness. Each sport owns its legal actions, formations, default movement, resolution, AI, match timing, and playing surface. Hockey keeps line changes in its own rules. Football keeps snaps, field position, and drive progression in its rules.

Keep an original 2D sporting presentation with clear athlete labels, control focus, visible possession, outcome feedback, and readable small-screen layouts. Mouse, keyboard, and touch are appropriate for early browser playtests. Gamepad navigation, remapping, and Steam Deck verification are commercial readiness gates. Offline single-player and versioned local saves should precede desktop packaging. Choose packaging after browser playtests and Steam Deck checks justify it.

Use CI to compile, run tests, and produce a downloadable browser build. Start with legal-action, resolution, scoring, possession, fatigue, and reproducibility coverage. Expand scenario tests, AI simulations, responsive and input checks, and versioned replay fixtures as those features mature.

## Roadmap and release gates

| Stage | Gate |
| --- | --- |
| 1. Playable basketball | Finish a 5-on-5 match against AI. Execute and understand a coordinated offensive plan and a defensive response. Repeat a scripted match exactly in headless CI. |
| 2. Soccer architecture test | Complete an 11-on-11 match scenario with goalkeeping, spatial buildup, and shape. Verify that basketball and soccer can use the shared planning and event contract. Compare command budgets before expanding the architecture. |
| 3. Tactical refinement | Demonstrate more than one effective attack and defensive response in each sport. Use playtests and simulations to tune plans, feedback, pacing, AI, and controls. |
| 4. Athlete and club RPG | Show an athlete carrying a transferable strength between basketball and soccer while improving each sport's skills independently. Run a short career with recruitment, training, rivals, and meaningful roster choices. |
| 5. Four-sport prototype | Deliver the combined build and meet the prototype completion gates above. |
| 6. Four-sport playtest | Observe players completing coached plays and full matches. Test lineup rotation, league pacing, and whether film, recovery, and technical practice each create viable choices across a four-sport season. |
| 7. Steam release | Ship full-sided basketball, soccer, ice hockey, and American football together, with a complete solo loop, readable onboarding, local saves, gamepad support, Steam Deck verification, and a release-quality build. |
| 8. Continued development | Sequence deeper careers, online competitive play, and mobile delivery according to evidence and capacity. |

Steam and Steam Deck remain the first commercial targets. The [Steam packaging preview](STEAM-PREVIEW.md) uses the same four-sport Windows and Linux packages as the playtest. Physical Steam Deck testing and Steamworks review belong to the commercial release stage.

Turn Pro is planned as a premium game. Additional sports, campaigns, and cosmetics are possible later. Commercial decisions should protect the core play loop and the fairness of competitive modes.

## Design references

| Reference | Design lesson for Turn Pro | What to test here |
| --- | --- | --- |
| [Final Fantasy Tactics](https://www.square-enix-games.com/en_US/news/final-fantasy-tactics-the-ivalice-chronicles) | Jobs with transferable learned abilities make team compositions expressive. Classic Final Fantasy's contextual commands are a model for choosing an action quickly. | Keep initial builds narrow, then see whether swapping one ability creates a recognizable change in tactics. |
| [Football, Tactics & Glory](https://creoteam.com/football-tactics-glory/) | Turn-based soccer can connect tactical counter-moves to player classes and club development. The developer describes players missing important mechanics until it added teaching for them. | Put a coached buildup and crossing situation into the soccer prototype. [Creoteam's onboarding notes](https://creoteam.com/free-update-coaching-license/) |
| [Frozen Cortex](https://store.steampowered.com/app/237350/) | Simultaneous planning makes anticipation central. A review describes an initial comprehension barrier before the strategy clicked. | Reveal intent and decisive events in order. See whether a player can explain a failed plan after one replay. [PC Gamer review](https://www.pcgamer.com/frozen-cortex-review/) |
| [Hoop League Tactics](https://play.google.com/store/apps/details?id=com.koalitygame.hoopleaguetactics) | A mobile turn-based basketball game uses familiar sporting actions alongside player development and fatigue. | Test whether all ten athletes and contextual commands remain easy to read on a small screen. Treat the extra load of simultaneous plans as a Turn Pro design question. |

Use these references for design principles. Turn Pro uses original rules, fictional athletes, team identities, presentation, and assets.
