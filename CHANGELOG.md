# Changelog

Special Containment Organization — game versions (MAJOR.MINOR.PATCH). The same entries are shown on the main menu.

## v0.12.0 — People (2026-11-08)

- Civilians, police, soldiers and humanoid threats are now animated low-poly figures instead of markers: walking, running and fleeing, aiming and firing, kneeling, shambling, clawing, loping and falling.
- Every soldier of a squad is shown: rifle squads move in formation, half kneel when they open fire, and men who fall stay where they fell.
- Uniforms by country: national police patrol dress (e.g. Police nationale navy, German Polizei blue, British black with hi-vis) and army camouflage (French BME, German Flecktarn, Swedish M90 splinter, Russian digital, desert patterns in the Gulf, …). Your units wear your nation’s uniform abroad; national troops wear their own.
- Civilian clothing follows region and season: winter coats in northern Europe in winter, thobes and ghutras and abayas in the Gulf, kurtas, salwar and saris in South Asia, bright prints and head wraps in West Africa.
- Police officers step out beside their stopped patrol cars and open fire with pistols when hostiles come close.
- Undead are ragged, grey-skinned and bloodied civilians (and the odd turned soldier); vampires are pale and dark-clad; lycans are hunched, clawed werewolves.
- The fallen (civilians, officers, soldiers and hostiles) stay on the ground for a while.
- The camera can now zoom in much closer (about 9 m) to watch the people.

## v0.11.0 — Countryside battles (2026-11-08)

- When the outbreak presses hard on one of your front lines, you are offered command of the battle: take command in 3D or let the national forces hold on their own.
- Hold the line: a 6 × 6 km sector of generated countryside built from the real land cover at that spot (woods, fields, grassland, built-up share, arid regions), with villages sized by local population, farmsteads, roads, farm tracks, a river and regional hedgerows with field gates.
- National platoons and APCs hold a line across the sector under their own command and shift toward the pressure; they are shown in blue and cannot be ordered. Your units start just behind the line.
- Hostiles come in waves and surges along two or three axes that change during the battle. Hold for about four hours; too many breakthroughs behind the line and it breaks.
- Open-country movement: hostiles march across fields and around hedgerows, walls and buildings, using field gates.
- The result feeds back to the world map: a held line pushes the infestation back around the front, a broken one lets it surge. Losses carry over; survivors stay on the line.
- Event dialogs now queue instead of covering each other, and wait while you are commanding a battle.

## v0.10.0 — The global outbreak (2026-11-08)

- One outbreak per campaign. It starts somewhere in the world, away from your country, and spreads: it grows where it finds people, moves through farmland and towns faster than through forest, desert or wetland, never across open sea, and jumps between big cities by air until flights are suspended. Each threat behaves differently: the undead and swarms spread fast, mutants and aliens slowly but are hard to push back, vampires stay hidden longer and travel, lycanthropes move through woods.
- City emergencies no longer appear at random: your cities call when the front reaches them. National armed forces hold the countryside; troops follow population, so large cities hold far longer than the rural areas around them. Countries detect the outbreak, mobilise over several weeks and close their borders; once twenty countries are hit, the rest of the world pre-mobilises.
- World map (button in the top bar, or M): satellite land cover of the whole planet (ESA WorldCover, 0.25° cells), the spreading infestation and overrun areas, outbreak hotspots, major cities and their state, requests for help, your front lines, bases and units in transit. The national map now shows land cover and the outbreak in and around your country.
- World tab: the global situation, requests for assistance, your front lines and the countries affected with their response organizations.
- Allied organizations: every country has one, and blocs of smaller neighbours share one (Nordic, Baltic, Benelux, Western Balkans, Central America, Caribbean, Guianas, Gulf, Sahel, West African coast, Central Africa, East Africa, Horn of Africa, Southern Africa, Central Asia, Mekong, Pacific Islands).
- Help abroad: when the front reaches a major foreign city its organization may ask for help. Accept and the city becomes an emergency you dispatch to by military airlift; if a detailed survey is on file you can command it in 3D. Declined or lapsed requests are fought by local forces, who hold or lose the city.
- Front lines: deploy units to any point of the front, at home or abroad, to strengthen the defence of the area around them (about 80 km across). They take losses while the threat presses there; withdraw them at any time.
- Emergencies you win push the threat back in their area; cities you lose fall on the world map. VIP names and titles follow the country of the city.
- Saves store the world state compactly; older saves start a new outbreak when loaded.

## v0.9.0 — Cities of the world look like themselves (2026-11-08)

- Seas, bays, lagoons and rivers from satellite land cover (ESA WorldCover, 10 m). Coastal cities such as New York, Lagos, Istanbul and Tokyo now sit on real water instead of grass, and the map has no more holes over open water.
- Ground colours follow satellite land cover wherever the street map has no land use: woods, scrub, grass, fields, bare sand and rock, built-up ground, wetland. Trees are planted where the satellite sees tree cover.
- Arid cities (Cairo, Riyadh, Dubai, Lima, Karachi and others) get dry ground, dusty gardens and olive trees instead of lush lawns.
- Unmapped neighbourhoods are filled: where satellite land cover shows built-up land but OpenStreetMap has few or no buildings, buildings are generated along the streets in the local tradition (plot sizes, setbacks, rows, storeys). They are marked "estimated building" in the building panel.
- Regional building styles: wall colours, roof colours and how often roofs are pitched follow 14 regional traditions, from Nordic falu red to Mediterranean whitewash, flat desert roofs, corrugated metal in West Africa, grey tiles in Japan and asphalt shingles in North America.
- District and building names use the English or Latin-script name where the local name is in another script. VIP names fit the region.

## v0.8.0 — World cities, line of sight and cover (2026-11-07)

- 3D city maps for 64 of the world's largest cities (Shanghai, Istanbul, Mumbai, Mexico City, Tokyo, New York, London, Cairo, Paris, Strasbourg and more, in 46 countries). Any of them can host an outbreak you command in 3D; other cities resolve on the strategic map. Countries with no city map still get outbreaks in their largest cities.
- City maps now cover 8 × 8 km around the centre (was 12 × 12) and load as one compressed file.
- Line of sight: buildings, walls and hedges at eye height block shots, both ways. Units pick the nearest threat they can actually see.
- Cover: a target within a few metres behind a low wall takes less than half the damage (hard cover); behind a low hedge or board fence about a third less (soft cover). Mesh fences, railings and wire neither block nor cover.
- Squads firing from upper floors of a garrisoned building see over garden walls and hedges; helicopters fire from above. Alien ranged attacks need line of sight too.

## v0.7.0 — Fences, walls and hedges (2026-11-07)

- Barriers are now on the map: every fence, wall, hedge, retaining wall, guard rail and city wall mapped in OpenStreetMap, opened where gates, paths and roads pass through.
- Property fences: house lots are fenced along their real boundaries from the French cadastre (plan cadastral, Etalab). Low fences, railings or low walls with a gate face the street; hedges, board fences, mesh fences or walls run between neighbours. In Strasbourg that is about 1,470 km of fencing around 33,500 lots, alongside 335 km of mapped barriers.
- Barriers are gameplay: away from roads and paths, soldiers and creatures cannot walk through fences, walls, hedges or buildings. Low barriers (up to 1.3 m) are vaulted, which takes a moment (slow for the undead, quick for vampires and lycans); tall ones force a way round through gates and gaps.
- Vehicles drive through fences and hedges, flattening a section that stays open for everyone. Trucks, APCs and tanks also push through masonry garden walls; jeeps and light cars cannot. Retaining walls and city walls stop everything.
- A unit that cannot reach its objective reports it ("fenced or walled off") instead of walking through walls. Creatures pick another target.
- Bollards, blocks and cycle barriers close streets to cars but not to people.
- Individually mapped trees and street lamps now appear (they were dropped when tiles loaded).

## v0.6.2 — Map polish (2026-11-07)

- Gardens and lawns: residential land is now lawn with shrubs and patches of paving instead of grey; open ground gets grass, earth and scrub. Commercial and industrial land stays paved.
- Car parks: own lighter asphalt with bay markings laid out along each lot.
- Service roads, driveways and parking aisles are drawn narrow and lighter; farm tracks in earth tones. Pedestrian streets are wide light paving.
- Footpaths and cycleways are narrower, in gravel and red-brown tones, and fade out when zoomed out.
- Infested buildings keep their facade under the threat colour and pulse slowly; smoke rises from heavily infested and badly damaged buildings.
- Flat roofs: lighter gravel and membrane tones, parapets, and rooftop plant (air handlers, lift rooms) on larger roofs.
- Night: stronger moonlight and ambient light so streets and buildings stay readable between the lamps.
- Water: sky reflection by viewing angle, slow ripples and sun glints.
- Map labels no longer overlap: endangered HVTs, selected units, sites, HVTs and districts are placed in that order of priority.
- City top bar is one row with the key figures; the rest open from "More".
- Zebra crossings sit just behind the stop line of signalised approaches.

## v0.6.1 — Terrain fix (2026-11-07)

- Bare-earth terrain: the Copernicus elevation model measures rooftops and tree canopy, which made the ground lumpy and let streets and land use sink under it. The map compiler now removes raised objects and smooths the result (up to 36 m removed in Strasbourg). Strasbourg recompiled.
- Streets, rails, tram tracks and rivers follow the ground with a vertex every 6 m; land-use edges every 12 m. Bridges rise smoothly from their ends.
- Junction patches match the width and surface of their roads instead of dark discs.
- Buildings reach down to the lowest ground under their footprint, so none float or sink on slopes.
- Natural ground: unpaved ground gets patches of grass, earth and paving instead of flat grey; land use and pavements get subtle variation.
- Very tall religious outlines (the cathedral) keep a nave-height body until building parts are supported.

## v0.6.0 — City look (2026-11-07)

- Blended look: realistic at street level, fading smoothly into a clean, light tactical map as you zoom out.
- Sun and sky: real November sun path over Strasbourg, gradient sky with sun glow, haze matched to the horizon, golden hour, moonlit night; sun shadows that follow the view.
- Buildings: regional palette (old-town plaster and Vosges sandstone, modern concrete, industrial cladding), mapped OpenStreetMap colours where available, roof shapes from the map data (gabled, hipped, pyramidal…) or inferred for small residential blocks, Alsace tile and slate roofs.
- Facades: windows, floor bands, shopfronts on ground floors, curtain-wall offices and strip-windowed industrial halls, ground-contact darkening; windows light up at night.
- Streets: asphalt with pavements, dashed lane markings, zebra crossings at signalised junctions, rail and tram tracks.
- Trees: 93,000 individually mapped trees from OpenStreetMap plus planted parks and woods. Street lamps: 7,400 mapped lamps (procedural lighting where none are mapped), glowing at night with light pools on the street.
- Building use colours moved to a toggleable intel overlay (V or the Overlay button).
- Graphics quality: Low / Medium / High (shadows, shadow resolution, tree shadows, render resolution); remembered between sessions and lowered automatically if the frame rate drops.
- City map pack format 1.1: trees, street lamps, roof shapes, building and roof colours and materials. Strasbourg recompiled.

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
