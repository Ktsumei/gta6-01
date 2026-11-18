[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Ktsumei/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Ktsumei/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# SOLMAR — Neon Streets

An original open-world crime game in the spirit of GTA 6, built for make.fun's **Make GTA 6** bounty. No Rockstar names, characters, maps or assets: the city is Port Solmar, a sun-soaked coastal town of your own, and the story is yours.

You come off the night ferry with $40 and a dead phone. Mama Delia runs the docks — and she remembers your father's name. Do her jobs. Don't get caught. Make the city yours.

## The city

Port Solmar is a 3200×2400 open world on a road grid: avenues and streets, blocks of buildings, parks and parking lots, a beach, water and a pier at the south edge. Traffic cars drive the lanes and brake for each other; pedestrians walk the sidewalks and scatter when a car bears down on them. The clock runs from morning to night and the palette shifts with it — bright day, orange sunset, dark streets.

## What you can do

- **On foot** — WASD or arrows to move, Shift to sprint, mouse to aim, click to punch or shoot.
- **Cars** — walk up to any car and press **E** to steal it and drive (WASD, speed and collisions included), **E** again to step out. Parked cars, traffic cars and police cars are all fair game, and stealing one is a crime.
- **Wanted level** — 1 to 5 stars. Stealing a car, hitting a pedestrian, shooting where a cop can see, or wrecking a police car raises it; staying quiet and out of sight lets it decay. Police cars chase and ram; foot cops chase and try to arrest you (busted screen); at 3 stars and up they open fire.
- **Six story missions for Mama Delia** — a delivery to the marina, stealing the yellow Comet GT from Veloce Motors, a dock shootout, a getaway, three cash drops, and a final run down the pier. Each pays cash; failing one lets you retry it. Objectives show as text and as a marker on the map and the minimap.
- **Combat** — a pistol with mouse aim (12-round magazine, **R** to reload, ammo pickups), fists, gang members who shoot back, health and armor bars, health pickups, particles, screen shake and skid marks.
- **HUD** — health and armor, money, wanted stars, clock, the current objective, weapon and ammo, speed when driving, and a live minimap with the player, police and mission markers.
- **Start screen, pause, save** — title screen with the story and controls, **P**/Esc to pause, **M** to mute, and an automatic save (money, mission progress, position) that you can continue with **C** on the title screen.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive |
| Mouse | Aim |
| Click | Shoot / punch |
| E | Enter or steal a car, exit a car |
| R | Reload |
| Shift | Sprint |
| P / Esc | Pause |
| M | Mute |
| C | Continue a saved game (title screen) |
| Space / click | Start (title screen) |

## How to play

Serve the game folder and open it in a desktop browser:

```sh
node serve.ts
# open http://localhost:8080
```

Or open `game/index.html` directly from a static server. The game is plain static files — no build step, no network request, no library: all art is drawn in code and all sound is synthesized with WebAudio.

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json`, the summary the judge reads.

## Layout

```
main.ts                  entrypoint: copies the game and writes dossier.json
game/
  index.html             the page: one canvas, one module script
  src/
    config.js            tuning numbers, palette, save keys
    random.js            seeded random (mulberry32)
    input.js             keyboard and mouse → one frame of intent
    audio.js             synthesized WebAudio: engine, sirens, shots, pickups
    city.js              the seeded grid city, roads, collision, places
    traffic.js           traffic cars, pedestrians, parked cars
    police.js            wanted level, police cars, foot cops, decay
    combat.js            pistol and fists, enemies, bullets, pickups, damage
    missions.js          the six-mission story chain
    world.js             the world: player, driving, collisions, camera, save
    render.js            everything painted: city, cars, people, HUD, minimap
    shots.js             the four screenshot scenes (?shot=start|drive|chase|mission)
    main.js              boot, the fixed-step loop, screens
screenshots/            four real renders of the game (1280×720)
```

## Screenshots

1. `1-start.jpg` — the title screen over the city.
2. `2-drive.jpg` — driving through Solmar with traffic and a police car closing in.
3. `3-chase.jpg` — four stars, police cars converging on the player's car.
4. `4-mission.jpg` — the getaway mission: lose the cops, get the wanted level to zero.

Entered on make.fun.
