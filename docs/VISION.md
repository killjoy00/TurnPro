# Turn Pro

Turn Pro is a turn-based tactical sports RPG. Build a club of fictional athletes, develop distinct specialties, and use them together in recognizable team sports. A match is the tactical encounter: spacing, assignments, stamina, and the opponent's decisions create the problems the team has to solve.

Steam and Steam Deck are the first commercial targets. The first paid release requires full-sided basketball and soccer. Ice hockey and American football are planned expansions of the same design. Mobile and web are later distribution options. The browser is the first playtest platform.

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

Resolution uses phases within one jointly planned turn. A screen can be set before movement, a defender can rotate during the drive, and a pass or shot can then resolve in the resulting space. Local pressure estimates describe the current state and can change after either side moves. Controlled, seeded randomness adds uncertainty to execution. Previews and the turn log explain the factors players can influence.

## Athlete and club progression

An athlete has an identity, physical profile, tendencies, strengths, fatigue, and development potential. Universal attributes such as speed, strength, endurance, awareness, and composure carry across sports. Technical skills, role proficiency, and experience are tracked for each sport. A fast athlete starting soccer can get to the ball quickly and still need to learn finishing and first touch.

Specialties offer distinct tools and tradeoffs. Start by testing Playmaker, Defender, and Finisher builds with active, passive, or reaction choices that change decisions on the court. Later candidates include Speedster, Technician, Enforcer, Strategist, Captain, Ironman, and All-Rounder. A player might combine a Playmaker's passing options with a Defender's off-ball reaction while giving up a second scoring ability. The first shared progression experiment should demonstrate one athlete bringing a useful universal trait into soccer with a lower independent soccer skill level.

The career grows from a modest roster through recruitment, training, lineups, recovery, competitions, and rival clubs. Distinct opponents should invite tactical adaptation. A possession-focused soccer rival demands a different plan from a transition-heavy one. Shared training resources and scheduling make specialists and generalists valuable in different situations. Multi-sport tournaments and overall club standings can follow once the two launch sports and career loop work individually.

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

## Engine and delivery

Use a headless TypeScript rules module and a browser client that renders the engine's state and submits commands. Keep state serializable and avoid hidden time or platform dependencies. Given the same starting state, rules version, seed, and plans, outcomes and event logs must match. UI estimates, AI, and validation read the same state and legal action rules. AI starts from the public snapshot captured before either plan is resolved.

The first module owns the basketball surface, basketball actions, constraints, scoring, control changes, and role defaults. The shared code starts with small math and randomness functions. Let soccer reveal which boundaries should become shared interfaces for rules, actions, events, and AI. Hockey and football can adopt proven interfaces while keeping line changes and snap-based plays in their own rules.

Keep an original 2D sporting presentation with clear athlete labels, control focus, visible possession, outcome feedback, and readable small-screen layouts. Mouse, keyboard, and touch are appropriate for early browser playtests. Gamepad navigation, remapping, and Steam Deck verification are commercial readiness gates. Offline single-player and versioned local saves should precede desktop packaging. Choose packaging after browser playtests and Steam Deck checks justify it.

Use CI to compile, run tests, and produce a downloadable browser build. Start with legal-action, resolution, scoring, possession, fatigue, and reproducibility coverage. Expand scenario tests, AI simulations, responsive and input checks, and versioned replay fixtures as those features mature.

## Roadmap and release gates

| Stage | Gate |
| --- | --- |
| 1. Playable basketball | Finish a 5-on-5 match against AI. Execute and understand a coordinated offensive plan and a defensive response. Repeat a scripted match exactly in headless CI. |
| 2. Soccer architecture test | Complete an 11-on-11 match scenario with goalkeeping, spatial buildup, and shape. Verify that both sports can use the shared planning and event contract. Compare command budgets before expanding the architecture. |
| 3. Tactical refinement | Demonstrate more than one effective attack and defensive response in each sport. Use playtests and simulations to tune plans, feedback, pacing, AI, and controls. |
| 4. Athlete and club RPG | Show an athlete carrying a transferable strength between basketball and soccer while improving each sport's skills independently. Run a short career with recruitment, training, rivals, and meaningful roster choices. |
| 5. Paid Steam release | Ship both basketball and soccer, a complete solo loop, readable onboarding, local saves, gamepad support, Steam Deck verification, and a release-quality build. |
| 6. Expansion | Sequence hockey, American football, online competitive play, and mobile delivery according to evidence and capacity. |

Turn Pro is planned as a premium game. Additional sports, campaigns, and cosmetics are possible later. Commercial decisions should protect the core play loop and the fairness of competitive modes.

## Design references

| Reference | Design lesson for Turn Pro | What to test here |
| --- | --- | --- |
| [Final Fantasy Tactics](https://www.square-enix-games.com/en_US/news/final-fantasy-tactics-the-ivalice-chronicles) | Jobs with transferable learned abilities make team compositions expressive. Classic Final Fantasy's contextual commands are a model for choosing an action quickly. | Keep initial builds narrow, then see whether swapping one ability creates a recognizable change in tactics. |
| [Football, Tactics & Glory](https://creoteam.com/football-tactics-glory/) | Turn-based soccer can connect tactical counter-moves to player classes and club development. The developer describes players missing important mechanics until it added teaching for them. | Put a coached buildup and crossing situation into the soccer prototype. [Creoteam's onboarding notes](https://creoteam.com/free-update-coaching-license/) |
| [Frozen Cortex](https://store.steampowered.com/app/237350/) | Simultaneous planning makes anticipation central. A review describes an initial comprehension barrier before the strategy clicked. | Reveal intent and decisive events in order. See whether a player can explain a failed plan after one replay. [PC Gamer review](https://www.pcgamer.com/frozen-cortex-review/) |
| [Hoop League Tactics](https://play.google.com/store/apps/details?id=com.koalitygame.hoopleaguetactics) | A mobile turn-based basketball game uses familiar sporting actions alongside player development and fatigue. | Test whether all ten athletes and contextual commands remain easy to read on a small screen. Treat the extra load of simultaneous plans as a Turn Pro design question. |

Use these references for design principles. Turn Pro uses original rules, fictional athletes, team identities, presentation, and assets.
