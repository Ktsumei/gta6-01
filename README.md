[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Ktsumei/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Ktsumei/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# SOLMAR — Neon Streets

An original open-world crime game made for make.fun's **Make GTA 6** bounty. It owes nothing to Rockstar: no borrowed names, characters, places or art. The setting is Port Solmar, a fictional sun-soaked harbour city, and the story is a new one — a courier who steps off the night ferry with $40, a dead phone, and a debt of gratitude to Mama Delia, who runs the docks and remembers his father's name.

## What the game is

A top-down open world, 3200×2400 pixels, built on a road grid with blocks of buildings, parks and parking lots, and a beach, water and a pier along the south edge — plus a lighthouse watching over the marina. Traffic follows the lanes and brakes for whatever is ahead; pedestrians stroll the sidewalks and run when a car bears down on them. The in-game clock runs from morning into the night, and the light changes with it: bright day, orange dusk, dark streets.

Everything is drawn in code and every sound is synthesized with WebAudio. There are no libraries, no network requests and no build step — just static files a desktop browser loads offline.

## Playing it

**On foot** — WASD or arrows to walk, Shift to sprint, the mouse to aim, click to punch or fire.

**In a car** — walk up to any parked, traffic or police car and press **E** (or **F**) to take it; WASD drives, **E** steps out again. Stealing a car is a crime, and the city notices.

**Wanted** — one to five stars. Steal a car, run someone over, fire a shot a cop sees, or wreck a police car, and the stars climb. Stay quiet and out of sight and they fall again. Police cars chase and ram; foot cops run you down and try to arrest you; from three stars up they shoot.

**Six jobs for Mama Delia** — a package for the marina, the yellow Comet GT lifted from Veloce Motors, a shootout with the dock gang, a getaway, three cash drops around town, and a final checkpoint run down the pier. Each job pays, each shows its objective on screen and on the minimap, and a failed job can be retried.

**Combat and survival** — a pistol with mouse aim (12-round magazine, **R** reloads, ammo pickups), fists with real knockback, gang members who shoot back, health and armour bars with pickups, particles, screen shake and skid marks.

**Around the edges** — a title screen with the story and the controls, **P** or Esc to pause, **M** to mute, and an automatic save (money, mission, position) that the title screen offers back to you with **C**. Leaving the tab pauses the game and saves it first.

## Controls

| Key | Does |
| --- | --- |
| WASD / arrows | Walk, or drive |
| Mouse | Aim |
| Click | Shoot / punch |
| E or F | Take a car, or step out of one |
| R | Reload the pistol |
| Shift | Sprint |
| P / Esc | Pause |
| M | Mute |
| C | Continue a saved game |
| Space / click | Start from the title screen |

## Running it

```sh
node serve.ts
# open http://localhost:8080
```

`main.ts` (Node 22, standard library only) is the entrypoint: it copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json`, the summary the judge reads. It refuses to hand in a screenshot set the scorer would refuse (fewer than three or more than four).

## The code

```
main.ts               entrypoint: copies the game, writes dossier.json
game/
  index.html          one canvas, one module script
  src/
    config.js         every tuning number and colour, in one place
    random.js         seeded random (mulberry32) and small helpers
    input.js          keyboard and pointer, as one frame of intent
    audio.js          synthesized sound: engine, sirens, shots, pickups
    city.js           the seeded city, roads, collision, named places
    traffic.js        traffic cars, pedestrians, parked cars
    police.js         wanted level, pursuit, arrests, decay
    combat.js         pistol and fists, enemies, bullets, pickups
    missions.js       the six-job story chain
    world.js          the world step: player, driving, collisions, save
    render.js         the paint: city, cars, people, HUD, minimap
    shots.js          the four screenshot scenes (?shot=…&seed=7)
    main.js           boot, fixed-step loop, the five screens
screenshots/         four real renders of the game, 1280×720
```

## The four screenshots

1. `1-start.jpg` — the title screen over the living city.
2. `2-drive.jpg` — driving through Solmar, one star, a police car closing in.
3. `3-chase.jpg` — five stars, police cars converging on the player's car.
4. `4-mission.jpg` — the getaway job: lose the cops, pistol in hand, $340 earned.

Entered on make.fun.
