# 53 — The road to ship

What "finished" means for UNDERWATCH, in what order it gets built, and the
first piece of it: a playtest build that closes the gate every other step
waits on.

## What "finished" means here

Not AAA in the literal sense. That is a studio of hundreds, motion capture,
recorded orchestras and years. Chasing that look would also break the thing
the game is built on: `docs/14` keeps every visual and sound generated from
the same records the simulation reads, so when the veneer peels, the labels
are the objects' real fields. A pipeline of meshes and textures would cut
that link.

So the target is a complete, polished, sellable game at the scope the design
record already describes: three acts, the whole of Bellhaven including
Northgate, an ending that lands, and the finish a paying player expects.
Dense and hand-made, never bigger.

## Where it stands

A vertical slice (`docs/13`): the skating, the sling, the full surveillance
simulation, jobs, the Devon incident, the afternoon investigation and five
endings. Roughly between Phase 7 and Phase 8 of `docs/16`.

The Phase 7 gate is six things a stranger has to do or say. `docs/31`
recorded that none of them had been observed, and nothing since has changed
that. Every milestone below assumes the skating is fun on its own. Until a
person who has never seen the game says so, that is a hope.

## Milestones

Each is a set of PR-sized changes, each one checkable on the live link.

| # | Milestone | Done when |
|---|---|---|
| **M1** | **The playtest build.** An instrument a tester can run alone. | Five to ten strangers have sent a report, and what they hit is fixed. *(This pass ships the instrument.)* |
| M2 | **Act II: comprehension.** The investigation chain from the match to the camera, the feed and the decision, ending on Devon's score never going back down. | A tester explains the pipeline back in their own words. |
| M3 | **Consequence that carries.** Saves across acts; an INTERVENTION raises the risk floor for the next hour (`docs/01` §9); Mara's shop as side progression; the job board as side content. | Getting caught changes the next twenty minutes. |
| M4 | **Northgate, visited.** The older, denser district made a full place, plus Relay 12's infiltration. | It reads as a different town from Maple Court at a glance. |
| M5 | **Act III: prediction.** The route forecast drawn on the road, patrols sent to where you *will be*, the player scored. | A tester beats the forecast on purpose. |
| M6 | **The ending.** Night, the second and third false positives (one of them the player's), the full cast, the advertisement replayed unchanged. | The reprise gets a reaction (`docs/13` §4). |
| M7 | **Sound.** Keep synthesis for the system; add a recorded layer for the score, the wheels, grinds and landings, and the advertisement's voice (already allowed by `docs/14` §4). | Played with the screen covered, it still reads. |
| M8 | **Presentation.** Staged shots for the story's beats, rider animation and landing polish, screen transitions. | Nobody asks what just happened. |
| M9 | **Ship.** Frame time on a mid-range phone, `main.ts` split, real-device passes (the cloud has no WebKit), gamepad, offline play, translation from `copy.ts`, crash reporting. | A week of reports with no new crash. |
| M10 | **Platforms.** Steam (Electron or Tauri), iOS and Android (Capacitor), achievements, a trailer and store art. | It is for sale. |

Not on the list, on purpose: an engine change, an open world, combat,
multiplayer. `docs/01` §10 rules each of them out, and it is right.

## M1: the playtest build

Open the game with `?playtest=1` on the end of the link. That browser stays a
playtest build until `?playtest=0`. A normal visitor sees nothing different.

**What the game writes down for itself.** `src/ui/playtest.ts` listens to the
simulation's own events and never writes to it, so a playtest session plays
exactly the same game.

| Criterion (`docs/13` §4) | What is recorded |
|---|---|
| 1. A clean line inside four minutes | The first fifteen unbroken seconds above 4 m/s, and every bail |
| 2. The sling into a camera without stopping | Every camera hit, and which of them were thrown at 2.5 m/s or faster |
| 3. "How did it know?" | Asked: *Did the town ever seem to know where you were going?* |
| 4. A route from memory | Asked: *Did you ever pick a way through because you remembered the cameras?* |
| 5. The peel | When VISION unlocked, how many times the veneer cracked, and asked |
| 6. The reprise | Whether and when it was reached, which ending, and asked |

Plus plans committed, held and blown, the highest escalation, interventions,
and each story beat with its time. A fifth question asks where the tester was
stuck, lost or bored.

**How a tester sends it.** **Playtest report** appears at the foot of the
pause menu and on the ending card. The sheet has the five questions and a
**Copy report** button that puts one block of plain text on the clipboard.
Where the clipboard is refused, the text is shown and selected instead. Typing
in the sheet never reaches the game's keys.

**How to run a round.** Send the `?playtest=1` link to someone who has never
seen the game. Ask them to play until the afternoon ends or they stop wanting
to, then open the menu and send the report. Read five reports before changing
anything.

**Checks.** `tests/playtest.test.ts` feeds the recorder real bus events.
`e2e/playtest.spec.ts` checks that a normal player has no button, and that
typing reaches the report and not the game. `e2e/a11y.spec.ts` scans the
sheet on all three devices.
