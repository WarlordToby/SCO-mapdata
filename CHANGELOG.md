# Changelog

Special Containment Organization — game versions (MAJOR.MINOR.PATCH). The same entries are shown on the main menu.

## v0.5.0 — Balance: bases, police, map view (2026-11-07)

- Base modules now give 4× capacity: Barracks +160 personnel, Armory +1,200 items, Motor Pool +32 vehicle bays, Helipad +4 helicopters, Hangar +12 helicopters.
- Three charter bases at game start: place your Headquarters and two regional garrisons. Each garrison comes with its own stock and its own contingency group (Bravo, Charlie: rifle squad, response team, VAB, truck, Alouette).
- Dispatch pre-selects the contingency group of the base nearest to the incident.
- Complete map view in the city layer: no fog of war — every hostile and infested building is always visible.
- Greater local police presence: 10 cars per police station plus patrols across the whole operation area (about 4 per km²). Response cars drive towards hostile activity and open fire at close range; officers can be overrun. Police nearby double evacuation speed.
- Hostiles now go after police patrols that come close.

## v0.4.0 — First response (2026-11-07)

- Version system: version shown on the main menu and in-game; this changelog opens automatically after an update; saves record the version they were made with and are migrated forward.
- Take command as soon as the first unit reaches the city. Units still en route stream in as reinforcements at their real ETA, shown in the forces list.
- Intelligence: hostiles are only visible while tracked by a sensor — helicopters (650 m), vehicles (260 m), infantry (200 m, reduced at night without night vision) and police patrols. Lost contacts leave last-known markers. Civilian emergency calls reveal infested buildings.
- Safe zones: the ground commander designates open ground (parks, squares, sports grounds) away from the outbreak as soon as the first unit arrives. Civilians on foot gather there and are bussed out; HVTs are flown there. Hostiles are drawn to crowded, unguarded zones.
- Helicopter AI: flies reconnaissance orbits over the outbreak and extracts reachable HVTs on its own. Contingency Group Alpha now starts with Alouette 1.
- Commander assigns the first available ground unit to secure each safe zone.
- Performance: pooled map labels updated at 10 Hz, building recolouring from a dirty list with partial GPU uploads, BVH-accelerated picking, ground-plane zooming, evacuation zone and statistics cached, HUD only redraws what changed, adaptive render resolution.
- Performance overlay (F3): frame rate, simulation / scene / render / label timings, draw calls, triangles, agents and resolution controls.
- New 16× speed (key 4).

## v0.3.0 — City layer (2026-11-07)

- 3D city operations on real Strasbourg data with a free RTS camera; play area unlocks in 1 km rings as the outbreak spreads.
- Civilians evacuate as cars and pedestrians on the real road network: lane-level following, traffic lights and right-of-way.
- Police and ambulances act on their own from real stations and hospitals. 14 named high value targets per operation.
- Threats move as individuals, take over buildings, convert or kill occupants, nest and collapse structures; distinct behaviour per threat type and a day/night cycle.
- Hybrid control with an AI ground commander: garrison, clear, extract, quarantine districts with checkpoints, supply outposts and forward camps, ammunition and resupply.
- Operation results feed back to the strategic layer: casualties, losses, HVTs, samples, city integrity, standing and trust.

## v0.2.0 — City map packs (2026-11-07)

- Automatic pipeline (GitHub Actions, sco-mapdata): downloads OpenStreetMap extracts and Copernicus elevation for any city and compiles a tiled map pack.
- Pack format v1: buildings as entities, lane-level road network with junction connections and signal plans, districts, land use, rail/tram/water, service points, terrain.
- Strasbourg compiled: 97,760 buildings, 78,355 road segments, 2,109 signalised junctions, 34 districts.

## v0.1.0 — Strategic command (2026-11-07)

- Main menu, country selection on a real world map, organisation founding with a badge builder.
- National map with real cities, integrity and panic; Organization, Equipment, Research and Bases tabs.
- XCOM-style bases with modules, recruitment, ~60 real equipment items, procurement and convoys, units and contingency groups.
- Incidents with news broadcasts and emergency calls, dispatch with transport planning, approach directions and ETAs.
