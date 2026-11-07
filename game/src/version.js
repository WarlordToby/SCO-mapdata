// Single source of truth for the game version. Bump VERSION and add a CHANGELOG entry with every release.
// Versioning: MAJOR.MINOR.PATCH — MINOR for new features/content, PATCH for fixes and balance.
export const VERSION = '0.9.0';
export const SAVE_FORMAT = 2; // bump when the save structure changes; add a step to migrate() below

export const CHANGELOG = [
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
  s.gameVersion = VERSION;
  return { s, migratedFrom: from < SAVE_FORMAT ? from : null };
}
