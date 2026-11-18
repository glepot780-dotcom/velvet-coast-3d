# Azure Tide — 7 Jobs in Meridian Bay

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/glepot780-dotcom/velvet-coast-3d/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/glepot780-dotcom/velvet-coast-3d/reward.svg)](https://make.fun/bounty/gta6-01)

A 3D open-world crime game in the spirit of GTA 6, built for [make.fun's Make GTA 6 bounty](https://make.fun/bounty/gta6-01) — $1,666 in USDC, top 100 paid. Raw WebGL2, procedural low-poly art, no libraries, no network requests, no assets: everything is drawn in code.

## The game

Jax Corso is back in Meridian Bay after three years away, and the city owes him. Across **7 story jobs in 3 days** — from stealing his first car on Neon Row to the casino vault and the yacht at Harbor Lights — he works for the fixer Ivy Sloane, with wheelman Dante Fox, hacker Priya Nair and muscle Marcus Hale, while Chief Elena Voss's department hunts him.

**Meridian Bay** is a sun-soaked island city: Neon Row's glass towers, the Old Town lanes, Crestview above the bay, Driftwood Beach, the Harbor Lights marina with its boats, and Meridian Airfield with its runway, hangar and cargo plane. The ocean is always there — animated water, a beach, a pier, moored boats and two sailing the open water, and a plane crossing the sky.

## Systems

- **On foot and by car** — walk, sprint, steal any parked or traffic car, drive with handbrake drifts
- **Wanted 0–5 stars** — crimes add heat; pursuit cars chase and ram, roadblocks at 4 stars, a **police helicopter** with a searchlight at 3 stars; hide to cool down, or pay for a respray
- **Combat** — fists, pistol, SMG and shotgun on a weapon wheel (Q), with ammo to manage
- **Missions + story** — 7 jobs with objectives, timers, stages, dialogue and character portraits
- **Economy + garage** — earn cash, buy armour, engine and tyre upgrades, ammo, resprays and new cars
- **HUD + map** — minimap with police dots and the objective arrow, a full city map (M) with the story jobs and a legend, radio stations, dispatch chatter
- **Day/dusk/night lighting** — the whole game plays at a long dusk, with lit windows and headlights
- **Save** — progress is kept in localStorage; CONTINUE picks the story back up

## Controls

| Key | Action |
| --- | --- |
| W A S D | Walk / drive |
| Mouse | Aim · Click to shoot |
| Shift | Sprint |
| Space | Handbrake drift |
| F | Enter / steal a vehicle |
| Q | Weapon wheel (1–4 to choose) |
| R | Radio station |
| G | Garage (near Ivy's Garage) |
| M / Esc | City map / pause |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

## Build

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the vendored make.fun library. The four screenshots in `screenshots/` are real renders of the game's own code, staged by `?shot=menu|chase|weapons|map` with a fixed seed.

## License

MIT — see [LICENSE](LICENSE). The city, characters, vehicles, names, story, art and sound are all original.
