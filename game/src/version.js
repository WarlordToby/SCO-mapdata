// Single source of truth for the game version. Bump VERSION and add a CHANGELOG entry with every release.
// Versioning: MAJOR.MINOR.PATCH — MINOR for new features/content, PATCH for fixes and balance.
export const VERSION = '0.16.0';
export const SAVE_FORMAT = 4; // bump when the save structure changes; add a step to migrate() below

export const CHANGELOG = [
  {
    v: '0.16.0', date: '2026-11-08', title: 'Buildings, cordons and helicopters',
    items: [
      'Buildings have interiors: every building is split into floors, and each floor into a few large sections (open-plan office floors, apartment corridors, shops, the stair core). Civilians, hostiles and squads inside each stand in a section, so fights there are physical: point-blank in the same section, medium range into the next one along the floor, stairs between the floors.',
      'Squads ordered to clear a building go in and sweep it section by section and floor by floor; the building panel shows each floor and section (hostiles, your squads, civilians, destroyed sections) and lets you send the squads to a floor or hold a stairwell.',
      'Close-up buildings are rebuilt with real facades: window openings with sills, reveals and lintels that stop well short of the ceiling, glass you can see through, mullions, balconies on flats, shopfronts on the ground floor, floor bands and parapets; inside are floor slabs, partitions with doorways, stairs and, when you look in, furniture. People inside are drawn on their floor.',
      'Windows are real: troops in the street shoot hostiles they can see through them (and vice versa), and glass shatters onto the pavement when fire goes through it. Vehicles support a clearing squad by firing in through the windows.',
      'Cutaway: select a building, or get close to one with a fight inside, and the floors above the action peel away; [ and ] (or Page Up / Down) cut the selected building floor by floor.',
      'Heavy damage knocks sections out and leaves real holes: helicopter crashes, tank fire, explosions, titans and charging crushers. A section whose support has gone can come down, and a building that has lost most of its sections collapses.',
      'Police cordons: police seal off the districts around the outbreak with a quarantine and park 20–30 patrol cars across every road out, reinforcements driving in on blue lights; their officers hold the line until your teams clear the area, and the cordon widens as the outbreak spreads. SCO units no longer get tied down on checkpoints the police already hold.',
      'Helicopters no longer run HVT errands on their own: they patrol tight circles over the hostiles and fire down (you can still order lifts). Choose Fly high (above the rooftops, safe, but buildings hide targets in the street canyons) or Fly low (between the buildings, clear shots, but a rotor strike is possible). Pilots steer clear of facades; a badly damaged helicopter can lose control.',
      'A helicopter that crashes into a building blows out the floors it hits and its wreck stays lodged in the hollow; otherwise it falls to the street.',
      'Fixed: vehicles could pass through buildings — shoves between vehicles slipped through walls, vehicles ignored the walls of the building they were sent to, and roads through building passages were treated as driveable. None of that happens now, for military vehicles or traffic.',
      'Windows on the simple buildings in the distance also stop below the ceiling now.',
    ],
  },
  {
    v: '0.15.0', date: '2026-11-08', title: 'Mutants, the hive, and national armies',
    items: [
      'Mutant outbreaks are made of different kinds, each with its own model, gait and attacks: brutes (the rank and file, one oversized club arm), slitherers (fast masses of limbs and tentacles that drag victims away), spitters (corrosive bile at range), bloaters (burst into a caustic cloud when they reach you or die) and titans (eight-metre hulks that stamp cars flat, walk through garden walls, tear through buildings in their way and wreck light armour).',
      'Mutants keep crawling out of the emergence site until it is cleared; a titan tears its way out a few minutes in, and more follow as the operation drags on.',
      'The swarm is now a caste-based hive. Drones grow resin over buildings and turn them into hives with egg-nests; hunters carry people off alive to be cocooned; warriors fight. Cocooned civilians can be cut free by clearing the hive before they are digested into biomass.',
      'Warriors spend the hive\'s biomass to moult into crushers (charge and crush, smashing vehicles), boilers (lob gas that eats through infantry without NRBC suits) and wardens (heavier warriors that guard the hives and Matriarchs).',
      'Each caste can raise one Matriarch, much larger and better at its work: her caste is stronger while she lives and falters for a while after she dies.',
      'Hives show resin nodules, spires, egg-nests and cocoons hanging on the walls; the HUD tracks hives, cocooned civilians, rescues, biomass and Matriarchs, and Matriarchs and titans carry labels with their health.',
      'Swarm and mutant hits splash ichor and bile instead of blood; corpses fold up and stay; moulting leaves a husk.',
      'The extraterrestrial threat has been withdrawn for now; running alien outbreaks in saved games become insectoid swarms.',
      'National armies: the US, UK, Germany, Russia, China, Japan, India, Italy, Spain, Turkey, South Korea and Brazil each field their own vehicles, helicopters and small arms, about a hundred new models in all, from the Abrams, Bradley, Stryker and Chinook to the T-90, BMP-3, Ka-52, ZTZ-99, Type 10, Arjun, Centauro and K2. Every other country fields its bloc\'s typical kit (ex-Soviet, Western export, Gulf, Latin American, Chinese export, francophone African).',
      'A new headquarters and its garrisons start with their own country\'s equipment and pre-formed units, and national troops in front-line battles carry their own rifles and carriers.',
      'Procurement terms: domestic kit is cheapest and fastest; an allied supplier costs 30% more and takes half as long again; the export market costs 70% more and takes twice as long; kit across the bloc divide is embargoed. The catalogue shows the supplier for each item.',
      'Fixed: the United States, Russia and other countries that cross the date line had no cities and could not be played.',
      'Fixed: national troops in front-line battles had no firepower (their rifles were not real catalogue items).',
    ],
  },
  {
    v: '0.14.1', date: '2026-11-08', title: 'Audit fixes',
    items: [
      'Light armoured cars and door-gun helicopters (VBL, P4, Puma and others with a weapon) now fire; before, anything below a set firepower never engaged.',
      'Vehicles no longer get stuck partway along a curving street: they join their route at the nearest point they can reach, and a unit that wanders into a courtyard or service lane retraces its tracks out.',
      'Path-finding starts and ends on the same connected piece of road network, so units parked by an isolated lane still find a way.',
      'Staging areas are placed on land near a road junction; coastal cities such as Mumbai no longer stage in the sea.',
      'The camera no longer clips into buildings at close zoom; it rises over roofs instead.',
      'Garrisoned units, their markers and picking now use correct roof heights.',
      'Police turnout is capped by city: Tokyo fielded over 400 patrol cars from its many kōban, now about 80 across all its stations.',
      'Fire engines turn out correctly (fixed a crash in the infested-building lookup).',
      'The prefect you are asked to evacuate is only a Préfet in France; elsewhere he is the Governor.',
      'Removed leftover placeholder markers and unused geometry from the renderer.',
    ],
  },
  {
    v: '0.14.0', date: '2026-11-08', title: 'Vehicles',
    items: [
      'Every vehicle now has a proper model, built from its real dimensions out of faceted hulls and turrets rather than boxes: Leclerc, Leopard 2A4, AMX-30B2, AMX-10RC, EBRC Jaguar, VAB, VBCI, Griffon, Serval, AMX-10P, M113A2, TRM 2000 and 10000, GBC 180, ACMAT VLRA, P4, VBL, Sherpa, Defender and Land Cruiser.',
      'Helicopters: Alouette III, Gazelle, Puma, Cougar, Caïman, Écureuil, H135 and Tigre, with turning rotors (and fenestrons), flying nose-down and settling lower when they hover.',
      'Turrets and weapon stations traverse onto their targets and elevate; main guns recoil with a muzzle flash and smoke every few seconds, machine guns flash with each burst.',
      'Wheels and road wheels roll at ground speed and tracks run; hulls pitch and roll over the terrain and bob when driving fast.',
      'Commanders ride head-out of their hatches when not fighting. A motorised squad’s carrier parks where they get out and opens its ramp or rear doors.',
      'Damage scorches the paint; destroyed vehicles explode, burn and stay as blackened wrecks, and tanks and IFVs can lose their turrets.',
      'National paint: vehicles wear the camouflage of the army operating them (French Centre-Europe, German NATO three-tone, Swedish splinter, Ukrainian digital, Gulf desert sand, …) with national markings; helicopters in their service colours.',
      'Traffic: a regional car mix (hatchbacks and vans in Europe, SUVs and pickups in North America, minibuses in Africa, tuk-tuks in South Asia, local taxi colours) in realistic colours, with headlights at night.',
      'Emergency services: police cars and vans in national liveries (white with blue band in France, blue-silver in Germany, Battenburg checks in Britain and the Nordics, black-and-white in the US and Japan, …) with flashing beacons on call; ambulances; fire engines now turn out from fire stations to damaged and burning buildings.',
      'Unit markers are sized to each vehicle and fade when zoomed in, so the models stay visible.',
    ],
  },
  {
    v: '0.13.0', date: '2026-11-08', title: 'Flesh and blood',
    items: [
      'Bites turn victims: anyone bitten on the street (civilians, police officers, soldiers) struggles, goes down, and gets back up as one of them 15–40 seconds later, in their own clothes. A blast near the body stops it rising.',
      'Dismemberment: machine guns, cannon, blasts and vehicles tear off arms, legs and heads; severed limbs fly and land, stumps show raw flesh and bone. Undead who lose their legs keep coming, crawling on their arms. Cannon and grenades can blow hostiles apart.',
      'Blood: spray on hits, pools that spread under the dead, bloodied clothes as wounds mount. Gore setting in the battle bar: Off, Reduced or Full (remembered).',
      'New animations: biting and being bitten, vampires lifting and feeding, lycans and vampires pouncing, flinching from heavy hits, crawling, the dead rising, undead feeding on bodies, civilians cowering, soldiers reloading and throwing grenades.',
      'Grenades: rifle squads lob a grenade at packs of hostiles 12–35 m away (one per soldier, every 20–30 s).',
      'Wounded: some soldiers hit by ranged attacks are wounded rather than killed; a comrade drags them back and they return to the unit after the operation.',
      'Collisions: people no longer walk through each other. Hostiles pile up, crowds jostle, squads keep their spacing, and vehicles shove through. Vehicles run down hostiles in their way (ramming works), and traffic hits hostiles on the road; fast, careless driving can kill civilians.',
    ],
  },
  {
    v: '0.12.0', date: '2026-11-08', title: 'People',
    items: [
      'Civilians, police, soldiers and humanoid threats are now animated low-poly figures instead of markers: walking, running and fleeing, aiming and firing, kneeling, shambling, clawing, loping and falling.',
      'Every soldier of a squad is shown: rifle squads move in formation, half kneel when they open fire, and men who fall stay where they fell.',
      'Uniforms by country: national police patrol dress (e.g. Police nationale navy, German Polizei blue, British black with hi-vis) and army camouflage (French BME, German Flecktarn, Swedish M90 splinter, Russian digital, desert patterns in the Gulf, …). Your units wear your nation’s uniform abroad; national troops wear their own.',
      'Civilian clothing follows region and season: winter coats in northern Europe in winter, thobes and ghutras and abayas in the Gulf, kurtas, salwar and saris in South Asia, bright prints and head wraps in West Africa.',
      'Police officers step out beside their stopped patrol cars and open fire with pistols when hostiles come close.',
      'Undead are ragged, grey-skinned and bloodied civilians (and the odd turned soldier); vampires are pale and dark-clad; lycans are hunched, clawed werewolves.',
      'The fallen (civilians, officers, soldiers and hostiles) stay on the ground for a while.',
      'The camera can now zoom in much closer (about 9 m) to watch the people.',
    ],
  },
  {
    v: '0.11.0', date: '2026-11-08', title: 'Countryside battles',
    items: [
      'When the outbreak presses hard on one of your front lines, you are offered command of the battle: take command in 3D or let the national forces hold on their own.',
      'Hold the line: a 6 × 6 km sector of generated countryside built from the real land cover at that spot (woods, fields, grassland, built-up share, arid regions), with villages sized by local population, farmsteads, roads, farm tracks, a river and regional hedgerows with field gates.',
      'National platoons and APCs hold a line across the sector under their own command and shift toward the pressure; they are shown in blue and cannot be ordered. Your units start just behind the line.',
      'Hostiles come in waves and surges along two or three axes that change during the battle. Hold for about four hours; too many breakthroughs behind the line and it breaks.',
      'Open-country movement: hostiles march across fields and around hedgerows, walls and buildings, using field gates.',
      'The result feeds back to the world map: a held line pushes the infestation back around the front, a broken one lets it surge. Losses carry over; survivors stay on the line.',
      'Event dialogs now queue instead of covering each other, and wait while you are commanding a battle.',
    ],
  },
  {
    v: '0.10.0', date: '2026-11-08', title: 'The global outbreak',
    items: [
      'One outbreak per campaign. It starts somewhere in the world, away from your country, and spreads: it grows where it finds people, moves through farmland and towns faster than through forest, desert or wetland, never across open sea, and jumps between big cities by air until flights are suspended. Each threat behaves differently: the undead and swarms spread fast, mutants and aliens slowly but are hard to push back, vampires stay hidden longer and travel, lycanthropes move through woods.',
      'City emergencies no longer appear at random: your cities call when the front reaches them. National armed forces hold the countryside; troops follow population, so large cities hold far longer than the rural areas around them. Countries detect the outbreak, mobilise over several weeks and close their borders; once twenty countries are hit, the rest of the world pre-mobilises.',
      'World map (button in the top bar, or M): satellite land cover of the whole planet (ESA WorldCover, 0.25° cells), the spreading infestation and overrun areas, outbreak hotspots, major cities and their state, requests for help, your front lines, bases and units in transit. The national map now shows land cover and the outbreak in and around your country.',
      'World tab: the global situation, requests for assistance, your front lines and the countries affected with their response organizations.',
      'Allied organizations: every country has one, and blocs of smaller neighbours share one (Nordic, Baltic, Benelux, Western Balkans, Central America, Caribbean, Guianas, Gulf, Sahel, West African coast, Central Africa, East Africa, Horn of Africa, Southern Africa, Central Asia, Mekong, Pacific Islands).',
      'Help abroad: when the front reaches a major foreign city its organization may ask for help. Accept and the city becomes an emergency you dispatch to by military airlift; if a detailed survey is on file you can command it in 3D. Declined or lapsed requests are fought by local forces, who hold or lose the city.',
      'Front lines: deploy units to any point of the front, at home or abroad, to strengthen the defence of the area around them (about 80 km across). They take losses while the threat presses there; withdraw them at any time.',
      'Emergencies you win push the threat back in their area; cities you lose fall on the world map. VIP names and titles follow the country of the city.',
      'Saves store the world state compactly; older saves start a new outbreak when loaded.',
    ],
  },
  {
    v: '0.9.0', date: '2026-11-08', title: 'Cities of the world look like themselves',
    items: [
      'Seas, bays, lagoons and rivers from satellite land cover (ESA WorldCover, 10 m). Coastal cities such as New York, Lagos, Istanbul and Tokyo now sit on real water instead of grass, and the map has no more holes over open water.',
      'Ground colours follow satellite land cover wherever the street map has no land use: woods, scrub, grass, fields, bare sand and rock, built-up ground, wetland. Trees are planted where the satellite sees tree cover.',
      'Arid cities (Cairo, Riyadh, Dubai, Lima, Karachi and others) get dry ground, dusty gardens and olive trees instead of lush lawns.',
      'Unmapped neighbourhoods are filled: where satellite land cover shows built-up land but OpenStreetMap has few or no buildings, buildings are generated along the streets in the local tradition (plot sizes, setbacks, rows, storeys). They are marked "estimated building" in the building panel.',
      'Regional building styles: wall colours, roof colours and how often roofs are pitched follow 14 regional traditions, from Nordic falu red to Mediterranean whitewash, flat desert roofs, corrugated metal in West Africa, grey tiles in Japan and asphalt shingles in North America.',
      'District and building names use the English or Latin-script name where the local name is in another script. VIP names fit the region.',
    ],
  },
  {
    v: '0.8.0', date: '2026-11-07', title: 'World cities, line of sight and cover',
    items: [
      '3D city maps for 64 of the world\'s largest cities (Shanghai, Istanbul, Mumbai, Mexico City, Tokyo, New York, London, Cairo, Paris, Strasbourg and more, in 46 countries). Any of them can host an outbreak you command in 3D; other cities resolve on the strategic map. Countries with no city map still get outbreaks in their largest cities.',
      'City maps now cover 8 × 8 km around the centre (was 12 × 12) and load as one compressed file.',
      'Line of sight: buildings, walls and hedges at eye height block shots, both ways. Units pick the nearest threat they can actually see.',
      'Cover: a target within a few metres behind a low wall takes less than half the damage (hard cover); behind a low hedge or board fence about a third less (soft cover). Mesh fences, railings and wire neither block nor cover.',
      'Squads firing from upper floors of a garrisoned building see over garden walls and hedges; helicopters fire from above. Alien ranged attacks need line of sight too.',
    ],
  },
  {
    v: '0.7.0', date: '2026-11-07', title: 'Fences, walls and hedges',
    items: [
      'Barriers are now on the map: every fence, wall, hedge, retaining wall, guard rail and city wall mapped in OpenStreetMap, opened where gates, paths and roads pass through.',
      'Property fences: house lots are fenced along their real boundaries from the French cadastre (plan cadastral, Etalab). Low fences, railings or low walls with a gate face the street; hedges, board fences, mesh fences or walls run between neighbours. In Strasbourg that is about 1,470 km of fencing around 33,500 lots, alongside 335 km of mapped barriers.',
      'Barriers are gameplay: away from roads and paths, soldiers and creatures cannot walk through fences, walls, hedges or buildings. Low barriers (up to 1.3 m) are vaulted, which takes a moment (slow for the undead, quick for vampires and lycans); tall ones force a way round through gates and gaps.',
      'Vehicles drive through fences and hedges, flattening a section that stays open for everyone. Trucks, APCs and tanks also push through masonry garden walls; jeeps and light cars cannot. Retaining walls and city walls stop everything.',
      'A unit that cannot reach its objective reports it ("fenced or walled off") instead of walking through walls. Creatures pick another target.',
      'Bollards, blocks and cycle barriers close streets to cars but not to people.',
      'Individually mapped trees and street lamps now appear (they were dropped when tiles loaded).',
    ],
  },
  {
    v: '0.6.2', date: '2026-11-07', title: 'Map polish',
    items: [
      'Gardens and lawns: residential land is now lawn with shrubs and patches of paving instead of grey; open ground gets grass, earth and scrub. Commercial and industrial land stays paved.',
      'Car parks: own lighter asphalt with bay markings laid out along each lot.',
      'Service roads, driveways and parking aisles are drawn narrow and lighter; farm tracks in earth tones. Pedestrian streets are wide light paving.',
      'Footpaths and cycleways are narrower, in gravel and red-brown tones, and fade out when zoomed out.',
      'Infested buildings keep their facade under the threat colour and pulse slowly; smoke rises from heavily infested and badly damaged buildings.',
      'Flat roofs: lighter gravel and membrane tones, parapets, and rooftop plant (air handlers, lift rooms) on larger roofs.',
      'Night: stronger moonlight and ambient light so streets and buildings stay readable between the lamps.',
      'Water: sky reflection by viewing angle, slow ripples and sun glints.',
      'Map labels no longer overlap: endangered HVTs, selected units, sites, HVTs and districts are placed in that order of priority.',
      'City top bar is one row with the key figures; the rest open from "More".',
      'Zebra crossings sit just behind the stop line of signalised approaches.',
    ],
  },
  {
    v: '0.6.1', date: '2026-11-07', title: 'Terrain fix',
    items: [
      'Bare-earth terrain: the Copernicus elevation model measures rooftops and tree canopy, which made the ground lumpy and let streets and land use sink under it. The map compiler now removes raised objects and smooths the result (up to 36 m removed in Strasbourg). Strasbourg recompiled.',
      'Streets, rails, tram tracks and rivers follow the ground with a vertex every 6 m; land-use edges every 12 m. Bridges rise smoothly from their ends.',
      'Junction patches match the width and surface of their roads instead of dark discs.',
      'Buildings reach down to the lowest ground under their footprint, so none float or sink on slopes.',
      'Natural ground: unpaved ground gets patches of grass, earth and paving instead of flat grey; land use and pavements get subtle variation.',
      'Very tall religious outlines (the cathedral) keep a nave-height body until building parts are supported.',
    ],
  },
  {
    v: '0.6.0', date: '2026-11-07', title: 'City look',
    items: [
      'Blended look: realistic at street level, fading smoothly into a clean, light tactical map as you zoom out.',
      'Sun and sky: real November sun path over Strasbourg, gradient sky with sun glow, haze matched to the horizon, golden hour, moonlit night; sun shadows that follow the view.',
      'Buildings: regional palette (old-town plaster and Vosges sandstone, modern concrete, industrial cladding), mapped OpenStreetMap colours where available, roof shapes from the map data (gabled, hipped, pyramidal…) or inferred for small residential blocks, Alsace tile and slate roofs.',
      'Facades: windows, floor bands, shopfronts on ground floors, curtain-wall offices and strip-windowed industrial halls, ground-contact darkening; windows light up at night.',
      'Streets: asphalt with pavements, dashed lane markings, zebra crossings at signalised junctions, rail and tram tracks.',
      'Trees: 93,000 individually mapped trees from OpenStreetMap plus planted parks and woods. Street lamps: 7,400 mapped lamps (procedural lighting where none are mapped), glowing at night with light pools on the street.',
      'Building use colours moved to a toggleable intel overlay (V or the Overlay button).',
      'Graphics quality: Low / Medium / High (shadows, shadow resolution, tree shadows, render resolution); remembered between sessions and lowered automatically if the frame rate drops.',
      'City map pack format 1.1: trees, street lamps, roof shapes, building and roof colours and materials. Strasbourg recompiled.',
    ],
  },
  {
    v: '0.5.0', date: '2026-11-07', title: 'Balance: bases, police, map view',
    items: [
      'Base modules now give 4× capacity: Barracks +160 personnel, Armory +1,200 items, Motor Pool +32 vehicle bays, Helipad +4 helicopters, Hangar +12 helicopters.',
      'Three charter bases at game start: place your Headquarters and two regional garrisons. Each garrison comes with its own stock and its own contingency group (Bravo, Charlie: rifle squad, response team, VAB, truck, Alouette).',
      'Dispatch pre-selects the contingency group of the base nearest to the incident.',
      'Complete map view in the city layer: no fog of war — every hostile and infested building is always visible.',
      'Greater local police presence: 10 cars per police station plus patrols across the whole operation area (about 4 per km²). Response cars drive towards hostile activity and open fire at close range; officers can be overrun. Police nearby double evacuation speed.',
      'Hostiles now go after police patrols that come close.',
    ],
  },
  {
    v: '0.4.0', date: '2026-11-07', title: 'First response',
    items: [
      'Version system: version shown on the main menu and in-game; this changelog opens automatically after an update; saves record the version they were made with and are migrated forward.',
      'Take command as soon as the first unit reaches the city. Units still en route stream in as reinforcements at their real ETA, shown in the forces list.',
      'Intelligence: hostiles are only visible while tracked by a sensor — helicopters (650 m), vehicles (260 m), infantry (200 m, reduced at night without night vision) and police patrols. Lost contacts leave last-known markers. Civilian emergency calls reveal infested buildings.',
      'Safe zones: the ground commander designates open ground (parks, squares, sports grounds) away from the outbreak as soon as the first unit arrives. Civilians on foot gather there and are bussed out; HVTs are flown there. Hostiles are drawn to crowded, unguarded zones.',
      'Helicopter AI: flies reconnaissance orbits over the outbreak and extracts reachable HVTs on its own. Contingency Group Alpha now starts with Alouette 1.',
      'Commander assigns the first available ground unit to secure each safe zone.',
      'Performance: pooled map labels updated at 10 Hz, building recolouring from a dirty list with partial GPU uploads, BVH-accelerated picking, ground-plane zooming, evacuation zone and statistics cached, HUD only redraws what changed, adaptive render resolution.',
      'Performance overlay (F3): frame rate, simulation / scene / render / label timings, draw calls, triangles, agents and resolution controls.',
      'New 16× speed (key 4).',
    ],
  },
  {
    v: '0.3.0', date: '2026-11-07', title: 'City layer',
    items: [
      '3D city operations on real Strasbourg data with a free RTS camera; play area unlocks in 1 km rings as the outbreak spreads.',
      'Civilians evacuate as cars and pedestrians on the real road network: lane-level following, traffic lights and right-of-way.',
      'Police and ambulances act on their own from real stations and hospitals. 14 named high value targets per operation.',
      'Threats move as individuals, take over buildings, convert or kill occupants, nest and collapse structures; distinct behaviour per threat type and a day/night cycle.',
      'Hybrid control with an AI ground commander: garrison, clear, extract, quarantine districts with checkpoints, supply outposts and forward camps, ammunition and resupply.',
      'Operation results feed back to the strategic layer: casualties, losses, HVTs, samples, city integrity, standing and trust.',
    ],
  },
  {
    v: '0.2.0', date: '2026-11-07', title: 'City map packs',
    items: [
      'Automatic pipeline (GitHub Actions, sco-mapdata): downloads OpenStreetMap extracts and Copernicus elevation for any city and compiles a tiled map pack.',
      'Pack format v1: buildings as entities, lane-level road network with junction connections and signal plans, districts, land use, rail/tram/water, service points, terrain.',
      'Strasbourg compiled: 97,760 buildings, 78,355 road segments, 2,109 signalised junctions, 34 districts.',
    ],
  },
  {
    v: '0.1.0', date: '2026-11-07', title: 'Strategic command',
    items: [
      'Main menu, country selection on a real world map, organisation founding with a badge builder.',
      'National map with real cities, integrity and panic; Organization, Equipment, Research and Bases tabs.',
      'XCOM-style bases with modules, recruitment, ~60 real equipment items, procurement and convoys, units and contingency groups.',
      'Incidents with news broadcasts and emergency calls, dispatch with transport planning, approach directions and ETAs.',
    ],
  },
];

// Bring an older save up to the current format.
export function migrate(s) {
  const from = s.saveFormat || 1;
  if (from < 2) {
    // 0.1–0.3 saves: record version info; nothing structural changed for the strategic state.
    s.saveFormat = 2;
  }
  if (from < 3) {
    // 0.10: the global outbreak replaces timed incidents; a world outbreak is started on load (see state.load)
    s.saveFormat = 3; s.fronts = s.fronts || []; s.foreign = s.foreign || [];
  }
  if (from < 4) {
    // 0.15: the extraterrestrial threat was withdrawn; running alien outbreaks become insectoid swarms
    s.saveFormat = 4; const fix = o => { if (o && o.threat === 'alien') o.threat = 'swarm'; };
    fix(s.world); for (const k of ['incidents', 'fronts', 'foreign']) for (const o of s[k] || []) fix(o);
  }
  s.gameVersion = VERSION;
  return { s, migratedFrom: from < SAVE_FORMAT ? from : null };
}
