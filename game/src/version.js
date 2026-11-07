// Single source of truth for the game version. Bump VERSION and add a CHANGELOG entry with every release.
// Versioning: MAJOR.MINOR.PATCH — MINOR for new features/content, PATCH for fixes and balance.
export const VERSION = '0.4.0';
export const SAVE_FORMAT = 2; // bump when the save structure changes; add a step to migrate() below

export const CHANGELOG = [
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
