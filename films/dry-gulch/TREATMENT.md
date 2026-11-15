# DRY GULCH — treatment

(Working title was "High Noon"; renamed to avoid an existing film's title.)

Style: 16-bit Pixel RPG (`pixel-rpg`). Length 47.5 s, 1920×1080, 24 fps. No voice: characters speak only through typed dialog boxes with text blips (STYLE §7 allows this). On-screen language: English game text (short lines), so the original pixel font can carry it.

## 1. Three candidate structures

1. **Duel as a turn-based battle.** Title → walk into town → encounter swirl → battle screen; the command menu is the stare-down; DRAW resolves in one turn. Clear, plays the game system as the language of the duel.
2. **Battle already in progress.** Open on HP 1 / HP 1, last turn; flashback by mosaic into how it began; back to the last shot. Stronger hook, but 36 s is too short for a flashback round-trip.
3. **Overworld tour of a frontier town.** Saloon, bank, jail as doors; the duel is the last door. Too many locations for a "simple" film.

**Chosen: 1**, with a hook in the first 3 s (a gunshot blasts the title card in). The turn: the hero's cursor *hesitates* (STYLE §5: the cursor stops when the character hesitates) — he tries TALK first, it fails, then FIGHT. Ending: not a kill — the bandit's gun is shot out of his hand and he RUNS; the palette steps from noon to sunset while the Kid walks away (back view at a threshold).

## 2. Logline and arc

A young gunslinger with a red bandana is stopped on main street at noon by the bandit Black Hat; he tries to talk, then has to draw.
Setup (town, noon) → turn (talk fails, bell strikes twelve, silence, DRAW) → ending (bandit flees, sunset, walk-off).

## 3. Benchmark

Mid-90s console RPG battle screens and classic spaghetti-western stand-offs (extreme close-ups of eyes, long silence, a bell, a sudden shot).
- Learn: the long hold before the shot; cutting between faces; the battle side view as staging; the item-get fanfare as punctuation.
- Don't take: any game's UI frames, fonts, characters, melodies; any film's melody or shots.

## 4. Shot list

| # | Time | Shot | Framing / move | Why |
|---|---|---|---|---|
| 1 | 0.0–4.0 | Title: "HIGH NOON" over desert, sun high | wide, locked; title blasts in on a gunshot (screen shake), PRESS START blinks | hook in 3 s |
| 2 | 4.0–11.0 | Main street of Dry Gulch, Kid walks right | full, side-scroll with 3 parallax layers (mesas / town / boardwalk), integer px | journey into the town; establish the hero silhouette (hat + red bandana) |
| 3 | 11.0–12.5 | Black Hat steps out at street end; music cuts | camera stops, then 1-px shake; encounter swirl | crash into danger |
| 4 | 12.5–22.0 | Battle side view: Kid left, Black Hat right; menu FIGHT / TALK / ITEM / RUN | locked frame, UI on the lower third; cursor on TALK, Talk dialog, cursor hesitates on FIGHT | a choice; a system speaking |
| 5 | 22.0–25.0 | Stand-off: two portraits, eyes only, split screen; bell tolls | close; slow integer push (portraits scale ×2→×3 via mosaic step) | the long hold, silence before the peak |
| 6 | 25.0–27.5 | DRAW! white flash, shot, gun flies from bandit's hand | back to battle view, shake 3-2-1 px | the peak |
| 7 | 27.5–31.0 | "BLACK HAT ran away!" — he runs off right; item-get "QUICK DRAW Lv 2" | locked | release, fanfare punctuation |
| 8 | 40.5–47.5 | Kid walks off right under a sunset sky; palette steps darken toward night; THE END | wide, locked; hold while the palette changes | ending echoes the opening sun; change without motion |

At least four camera moves: parallax track (2), shake (1,3,6), mosaic push (5), locked hold with palette change (8), swirl transition (3).

## 5. Beat sheet (as built; 120 bpm, 1 beat = 0.5 s)

- 0.00 black → 0.15 gunshot slams the title DRY GULCH in (white flash, shake, bullet hole); 0.55 second shot + ricochet; motif from 0.75.
- 3.9 select blip; 4.1–4.8 mosaic cross to the street.
- 4.8–10.8 Kid walks (8 fps steps), camera tracks with 3 parallax layers; 5.4–9.0 "MAIN STREET · 11:59 AM"; tumbleweed 7.0–9.6.
- 11.4 music stops; hotel door bangs; Black Hat steps out (boot steps, 1-px shakes) and turns.
- 12.6–13.4 encounter swirl → white.
- 13.4 battle view (characters at 2×). 13.7–17.4 "BLACK HAT blocks the road!"; battle ostinato.
- 17.6 cursor → TALK, 18.2 select. 18.3–21.9 KID: "Nobody has to die today." 22.0–24.95 BLACK HAT: "Then draw, kid." (music ducked).
- 24.95 menu returns, TALK greyed. 25.4 cursor → FIGHT and stops bobbing (hesitation) until 26.6 select; music out.
- 26.8–30.4 stand-off: Kid's eyes (sweat bead), Black Hat's eyes (narrowing), both; heartbeats, two noon bells; true silence 29.8–30.4.
- 30.4 shot (biggest sound), white flash, shake; Black Hat's gun flies, lands 31.5 (clatter). 31.0 "CRITICAL HIT!" 999.
- 33.0 holster spin. 33.9 "BLACK HAT ran away!" — he runs off right.
- 37.1 item get: Kid raises the gun, sparkles, fanfare; "KID learned QUICK DRAW!"
- 40.3–40.7 mosaic to sunset. Kid walks off to the right; palette steps 41.9 / 43.3 (night falls, the red bandana keeps its colour); 43.5 THE END; 46.8 fade.

## 6. Cue map

| Section | Time | Bars | Music |
|---|---|---|---|
| Title | 0–4 | 2 | pulse 25 % lead motif (A minor, "whistle" wavetable), triangle bass, echo |
| Street | 4–11 | 3.5 | walking bass (triangle), pulse 12.5 % guitar-like plucks, lead motif repeated |
| Encounter | 11–12.5 | – | cut to silence, then noise sweep |
| Battle | 12.5–22 | 4.75 | triangle ostinato on A, noise hats, low pulse stabs; ducks under dialog blips |
| Stand-off | 22–25 | – | no music: wind bed, heartbeat, bell |
| Draw | 25–27.5 | – | gunshot, ricochet, clatter |
| Victory | 27.5–31 | – | short fanfare at 29.0 (pulse arpeggio, A major) |
| Sunset | 31–36 | 2.5 | motif in A major, slower, echo tail to zero at 36 |

## 7. Sound design table

| Section | Ambience | Foley | Music |
|---|---|---|---|
| Title | desert wind (low) | gunshot slam, select blip | intro motif |
| Street | wind | footsteps, tumbleweed rustle, text blips | walking theme |
| Encounter | wind | boot step, swirl sweep | stop |
| Battle | wind (low) | window slide, cursor blips, select, text blips (two pitches) | battle ostinato |
| Stand-off | wind (up) | heartbeat ×2, bell ×2 | silent |
| Draw | – | gunshot, ricochet, gun clatter | silent |
| Victory | wind | run blips, item jingle | fanfare |
| Sunset | wind fading | footsteps fading | motif, A major |

## 8. Subtitles and titles

Dialog boxes are the subtitles (bottom quarter, 32×32 portrait left, original pixel font, typed ~38 chars/s, ▼ blinks). System/battle messages in a thin top window. Title "HIGH NOON" at 2× with ink outline and row gradient. `.srt` exported from the same cue array.

Protected colour: the Kid's red bandana — unchanged through the sunset palette steps.

## 9. Compared with the library demo (after the treatment)

Structure (single duel vs. memory/save-file journey), opening (gunshot title vs. corridor), signature shot (eye close-ups + gun shot away vs. palette collapse), camera path, score shape (stops dead before the duel, silent stand-off) and ending (sunset walk-off vs. door/end card) all differ.
