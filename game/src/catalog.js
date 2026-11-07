// Equipment catalogue, base modules, unit templates and threat types.
// Prices are rough EUR procurement/refurb figures; "standing" = minimum government standing to procure.

export const INF_SUBS = [
  ['surplus', 'Surplus rifles'], ['smg', 'SMGs'], ['rifle', 'Assault rifles'], ['dmr', 'Battle rifles & DMRs'],
  ['lmg', 'Light machine guns'], ['gpmg', 'General-purpose MGs'], ['hmg', 'Heavy machine guns'],
  ['at', 'Anti-armour'], ['gear', 'Protective & special gear'],
];

export const EQUIP_TABS = [
  ['infantry', 'Infantry'], ['light', 'Light vehicles'], ['truck', 'Trucks'],
  ['apc', 'APC / IFV'], ['tank', 'Tanks & fire support'], ['heli', 'Helicopters'],
];

const W = (id, name, sub, origin, cost, lead, standing, cal, range, power, desc) =>
  ({ id, name, cat: 'infantry', sub, origin, cost, lead, standing, cal, range, power, desc });
const V = (id, name, cat, origin, cost, lead, standing, crew, pax, armor, speed, arm, power, desc) =>
  ({ id, name, cat, origin, cost, lead, standing, crew, pax, armor, speed, arm, power, desc });

export const ITEMS = [
  // Surplus rifles
  W('mas36', 'MAS-36', 'surplus', 'France', 350, 2, 0, '7.5×54mm', 400, 3, 'Bolt-action service rifle from army reserve depots. Reliable, slow.'),
  W('mas4956', 'MAS-49/56', 'surplus', 'France', 450, 2, 0, '7.5×54mm', 500, 4, 'Semi-automatic rifle, long retired from front-line service.'),
  W('k98k', 'Mauser Kar98k', 'surplus', 'Germany', 400, 4, 0, '7.92×57mm', 500, 3, 'Bolt-action rifle bought from collectors\' surplus lots.'),
  W('enfield4', 'Lee-Enfield No.4', 'surplus', 'United Kingdom', 420, 4, 0, '.303 British', 500, 3, 'Fast-cycling bolt action, 10-round magazine.'),
  W('garand', 'M1 Garand', 'surplus', 'United States', 900, 6, 0, '.30-06', 450, 4, 'Semi-automatic, en-bloc clip fed.'),
  // SMGs
  W('mat49', 'MAT-49', 'smg', 'France', 500, 2, 0, '9×19mm', 100, 3, 'Folding-magazine SMG from gendarmerie reserve stocks.'),
  W('mp5', 'HK MP5A3', 'smg', 'Germany', 2400, 7, 10, '9×19mm', 150, 4, 'The standard for close-quarters police teams.'),
  W('ump45', 'HK UMP45', 'smg', 'Germany', 1900, 7, 10, '.45 ACP', 120, 4, 'Polymer SMG with heavier round.'),
  W('p90', 'FN P90', 'smg', 'Belgium', 2800, 10, 20, '5.7×28mm', 200, 5, 'PDW with 50-round magazine and light armour penetration.'),
  W('mp9', 'B&T MP9', 'smg', 'Switzerland', 2000, 8, 10, '9×19mm', 100, 3, 'Compact machine pistol for vehicle crews.'),
  // Assault rifles
  W('famas', 'FAMAS F1', 'rifle', 'France', 1200, 3, 0, '5.56×45mm', 450, 5, 'Bullpup rifle being retired by the army — available in quantity.'),
  W('hk416f', 'HK416F', 'rifle', 'Germany', 2700, 12, 30, '5.56×45mm', 500, 6, 'Current French Army service rifle.'),
  W('scarl', 'FN SCAR-L', 'rifle', 'Belgium', 3200, 12, 30, '5.56×45mm', 500, 6, 'Modular rifle used by special forces.'),
  W('aug', 'Steyr AUG A3', 'rifle', 'Austria', 2200, 10, 20, '5.56×45mm', 450, 5, 'Bullpup with integrated optic.'),
  W('m4a1', 'Colt M4A1', 'rifle', 'United States', 1500, 10, 20, '5.56×45mm', 450, 5, 'Carbine, common export model.'),
  // Battle rifles / DMR
  W('hk417', 'HK417', 'dmr', 'Germany', 4800, 14, 35, '7.62×51mm', 800, 6, 'Designated marksman rifle.'),
  W('scarh', 'FN SCAR-H', 'dmr', 'Belgium', 3800, 12, 30, '7.62×51mm', 700, 6, 'Battle rifle with heavier round.'),
  W('frf2', 'FR-F2', 'dmr', 'France', 6500, 6, 15, '7.62×51mm', 800, 6, 'Bolt-action sniper rifle, ex-army stocks.'),
  // MGs
  W('minimi', 'FN Minimi', 'lmg', 'Belgium', 6000, 10, 20, '5.56×45mm', 800, 7, 'Squad automatic weapon, belt or magazine fed.'),
  W('aa52', 'AA-52', 'gpmg', 'France', 2500, 3, 0, '7.5×54mm', 800, 7, 'French post-war GPMG, reserve stocks.'),
  W('mag', 'FN MAG', 'gpmg', 'Belgium', 8000, 12, 25, '7.62×51mm', 1000, 8, 'GPMG for vehicle mounts and fire teams.'),
  W('m2hb', 'Browning M2HB', 'hmg', 'United States', 14000, 10, 25, '12.7×99mm', 1800, 10, 'Heavy machine gun. Tripod or vehicle mount.'),
  // AT
  W('lracf1', 'LRAC F1', 'at', 'France', 1200, 3, 15, '89mm', 400, 8, 'Reusable 89mm rocket launcher from reserve stocks.'),
  W('at4', 'AT4', 'at', 'Sweden', 1800, 8, 25, '84mm', 300, 8, 'Single-shot disposable launcher.'),
  W('cg4', 'Carl-Gustaf M4', 'at', 'Sweden', 20000, 20, 40, '84mm', 1000, 11, 'Recoilless rifle; HE, HEAT, and illumination rounds.'),
  // Gear
  W('vest', 'Ballistic vest set', 'gear', 'France', 900, 3, 0, '—', 0, 0, 'Plate carrier + helmet. Cuts casualties.'),
  W('nrbc', 'NRBC protective suit', 'gear', 'France', 450, 4, 0, '—', 0, 0, 'Chemical/biological protection suit and mask.'),
  W('riot', 'Riot control kit', 'gear', 'France', 600, 3, 0, '—', 0, 0, 'Shield, baton, and helmet for crowd lines.'),
  W('nvg', 'Night-vision monocular', 'gear', 'United States', 4500, 12, 20, '—', 0, 0, 'Gen-3 image intensifier (PVS-14 class).'),

  // Light vehicles
  V('p4', 'Peugeot P4', 'light', 'France', 25000, 3, 0, 1, 3, 'None', 110, '—', 1, 'Army jeep, reserve stocks.'),
  V('defender', 'Land Rover Defender 110', 'light', 'United Kingdom', 60000, 8, 0, 1, 6, 'None', 130, '—', 1, 'Long-wheelbase utility 4×4.'),
  V('lc70', 'Toyota Land Cruiser 70', 'light', 'Japan', 55000, 6, 0, 1, 7, 'None', 140, '—', 1, 'Rugged pickup/troop carrier.'),
  V('vbl', 'Panhard VBL', 'light', 'France', 450000, 10, 20, 2, 1, 'Light', 95, '7.62mm MG', 3, 'Armoured scout car.'),
  V('sherpa', 'Renault Sherpa Light', 'light', 'France', 600000, 14, 30, 2, 2, 'Light', 110, '12.7mm HMG', 4, 'Protected patrol vehicle.'),
  // Trucks
  V('trm2000', 'Renault TRM 2000', 'truck', 'France', 70000, 3, 0, 1, 12, 'None', 89, '—', 0, '2-tonne tactical truck, reserve stocks.'),
  V('gbc180', 'Renault GBC 180', 'truck', 'France', 90000, 4, 0, 1, 20, 'None', 80, '—', 0, '4-tonne all-terrain truck.'),
  V('vlra', 'ACMAT VLRA', 'truck', 'France', 150000, 8, 0, 1, 12, 'None', 100, '—', 0, 'Long-range tactical truck.'),
  V('trm10000', 'Renault TRM 10000', 'truck', 'France', 180000, 8, 10, 1, 24, 'None', 89, '—', 0, '10-tonne heavy truck. Supply and troop lift.'),
  // APC / IFV
  V('vab', 'VAB', 'apc', 'France', 350000, 5, 10, 2, 10, 'Light', 92, '12.7mm HMG', 4, 'Wheeled APC, the old workhorse.'),
  V('m113', 'M113A2', 'apc', 'United States', 250000, 10, 10, 2, 11, 'Light', 64, '12.7mm HMG', 4, 'Tracked APC, ex-NATO surplus.'),
  V('amx10p', 'AMX-10P', 'apc', 'France', 400000, 8, 25, 3, 8, 'Light', 65, '20mm cannon', 6, 'Tracked IFV, retired from service.'),
  V('serval', 'Serval VBMR-L', 'apc', 'France', 1100000, 18, 35, 2, 8, 'Medium', 100, 'RWS 7.62mm', 5, 'Light multi-role armoured vehicle.'),
  V('griffon', 'Griffon VBMR', 'apc', 'France', 1800000, 20, 40, 2, 8, 'Medium', 90, 'RWS 12.7mm', 6, 'Modern 6×6 APC.'),
  V('vbci', 'VBCI', 'apc', 'France', 4500000, 25, 50, 3, 8, 'Medium', 100, '25mm cannon', 8, 'Wheeled infantry fighting vehicle.'),
  // Tanks & fire support
  V('amx30', 'AMX-30B2', 'tank', 'France', 600000, 12, 45, 4, 0, 'Heavy', 65, '105mm gun', 10, 'Cold War MBT from storage.'),
  V('amx10rc', 'AMX-10RC', 'tank', 'France', 900000, 12, 40, 4, 0, 'Light', 85, '105mm gun', 9, 'Wheeled fire-support vehicle.'),
  V('leo2a4', 'Leopard 2A4', 'tank', 'Germany', 2500000, 30, 55, 4, 0, 'Heavy', 68, '120mm gun', 13, 'Second-hand MBT, export market.'),
  V('jaguar', 'EBRC Jaguar', 'tank', 'France', 6000000, 30, 60, 3, 0, 'Medium', 90, '40mm CTA + ATGM', 12, 'Modern reconnaissance and combat vehicle.'),
  V('leclerc', 'Leclerc', 'tank', 'France', 9000000, 40, 65, 3, 0, 'Heavy', 71, '120mm gun', 15, 'French main battle tank.'),
  // Helicopters
  V('alouette3', 'Alouette III', 'heli', 'France', 900000, 6, 0, 2, 5, 'None', 210, '—', 1, 'Light utility helicopter, ex-navy.'),
  V('gazelle', 'SA342 Gazelle', 'heli', 'France', 1400000, 10, 30, 2, 3, 'None', 260, '20mm or HOT', 5, 'Light scout/attack helicopter.'),
  V('h125', 'H125 Écureuil', 'heli', 'France', 3000000, 20, 20, 1, 5, 'None', 245, '—', 1, 'Utility helicopter, police and medevac.'),
  V('puma', 'SA330 Puma', 'heli', 'France', 2500000, 12, 30, 3, 16, 'None', 260, '7.62mm door gun', 2, 'Medium transport helicopter.'),
  V('ec135', 'H135', 'heli', 'Germany', 5000000, 25, 25, 2, 6, 'None', 254, '—', 1, 'Twin-engine utility helicopter.'),
  V('cougar', 'AS532 Cougar', 'heli', 'France', 12000000, 30, 50, 3, 20, 'None', 260, '7.62mm door gun', 2, 'Tactical transport helicopter.'),
  V('nh90', 'NH90 Caïman', 'heli', 'Europe', 28000000, 45, 60, 3, 20, 'Light', 300, '7.62mm door guns', 3, 'Modern tactical transport.'),
  V('tigre', 'Tigre HAD', 'heli', 'Europe', 35000000, 60, 70, 2, 0, 'Light', 280, '30mm + rockets + ATGM', 14, 'Attack helicopter.'),
];
export const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]));
export const isVehicle = id => ITEM[id] && ITEM[id].cat !== 'infantry';
export const isHeli = id => ITEM[id] && ITEM[id].cat === 'heli';

export const STARTING_STOCK = {
  mas4956: 80, mat49: 40, famas: 60, aa52: 8, m2hb: 2, lracf1: 4, vest: 60, nrbc: 40, riot: 20,
  p4: 6, trm2000: 6, gbc180: 2, vab: 4, alouette3: 1,
};

export const BASE_SIZES = {
  outpost: { name: 'Outpost', cost: 6e6, slots: 3, upkeep: 150e3, days: 10 },
  garrison: { name: 'Garrison', cost: 18e6, slots: 5, upkeep: 350e3, days: 18 },
  hq: { name: 'Headquarters', cost: 40e6, slots: 8, upkeep: 700e3, days: 30 },
};

export const MODULES = {
  barracks: { name: 'Barracks', cost: 1.5e6, days: 6, upkeep: 40e3, desc: '+40 personnel capacity.' },
  armory: { name: 'Armory', cost: 1.2e6, days: 5, upkeep: 25e3, desc: '+300 infantry item storage.' },
  motorpool: { name: 'Motor Pool', cost: 2e6, days: 7, upkeep: 50e3, desc: '+8 ground vehicle bays.' },
  helipad: { name: 'Helipad', cost: 2.5e6, days: 8, upkeep: 40e3, desc: '+1 helicopter bay.' },
  hangar: { name: 'Hangar', cost: 8e6, days: 14, upkeep: 120e3, desc: '+3 helicopter bays.' },
  comms: { name: 'Comms Center', cost: 3e6, days: 10, upkeep: 60e3, desc: 'Halves mobilisation time for units based here.' },
  infirmary: { name: 'Infirmary', cost: 1.8e6, days: 7, upkeep: 45e3, desc: 'Wounded personnel recover twice as fast.' },
  depot: { name: 'Supply Depot', cost: 2.2e6, days: 8, upkeep: 40e3, desc: 'Stores field supply for camps and outposts (used in the city layer).' },
  lab: { name: 'Laboratory', cost: 6e6, days: 15, upkeep: 150e3, desc: 'Required for study projects (Research).' },
};

// slots: [label, accepted subs, count (number or 'pers')]
export const TEMPLATES = {
  rifle: { name: 'Rifle Squad', pers: 8, slots: [['Riflemen', ['rifle', 'surplus'], 6], ['Automatic rifleman', ['lmg', 'gpmg'], 1], ['Marksman', ['dmr', 'rifle', 'surplus'], 1]] },
  response: { name: 'Response Team', pers: 6, slots: [['Operators', ['smg', 'rifle'], 6]] },
  weapons: { name: 'Weapons Team', pers: 4, slots: [['Gunner', ['hmg', 'gpmg'], 1], ['Crew', ['rifle', 'surplus', 'smg'], 3]] },
  antiarmor: { name: 'Anti-Armour Team', pers: 3, slots: [['Launcher', ['at'], 1], ['Crew', ['rifle', 'surplus', 'smg'], 2]] },
  vehicle: { name: 'Vehicle', pers: 0, slots: [] },
};
export const GEAR_OPTS = [['vest', 'Ballistic vests'], ['nrbc', 'NRBC suits'], ['nvg', 'Night vision'], ['riot', 'Riot kits']];

export const THREATS = {
  undead: { name: 'Undead outbreak', short: 'UNDEAD', color: '#7fbf3f', spread: 1.6, strength: 1.0, gear: 'nrbc',
    news: 'Reports of violent mass attacks spreading through {district}. Hospitals overwhelmed; witnesses describe victims rising after death.',
    call: ['Préfecture operations, this is the duty officer for {city}.', 'We have multiple incidents of extreme violence starting in {district}. Bite wounds, all of them.', 'The first victims from the morgue at the hospital are… they are moving. They attacked the staff.', 'Police are pulling back to the ring road. We need your organization on site immediately.'] },
  mutant: { name: 'Mutant emergence', short: 'MUTANT', color: '#d48a2e', spread: 0.8, strength: 1.5, gear: 'nrbc',
    news: 'An industrial accident near {district} is followed by sightings of large, deformed creatures. Residents told to stay indoors.',
    call: ['This is the crisis cell at the {city} town hall.', 'After the chemical leak this morning, something came out of the treatment plant near {district}.', 'They are big. Two patrol cars were destroyed. Rifles barely slow them down.', 'We are requesting immediate intervention.'] },
  alien: { name: 'Extraterrestrial incursion', short: 'XENO', color: '#5fd3e0', spread: 0.7, strength: 1.8, gear: 'nvg',
    news: 'An object came down over {district} at 03:40. Power and communications are failing across the city. Air traffic grounded.',
    call: ['Air Defence Operations, relaying to you on orders of the Ministry.', 'Object impacted near {district}. Ground teams report… non-human individuals leaving the craft.', 'Our patrol lost contact twelve minutes ago. Their last word was "lights".', 'You have authority on site. Good luck.'] },
  vampire: { name: 'Vampiric infestation', short: 'NOCTURNE', color: '#c03a54', spread: 1.1, strength: 1.3, gear: 'nvg',
    news: 'A string of night-time disappearances in {district} leaves police baffled. Bodies found drained of blood.',
    call: ['Commissariat central, {city}.', 'Thirty-one missing in four nights, all around {district}. The ones we found had no blood left in them.', 'Last night one of my officers was taken off a rooftop. Witnesses swear she was carried up.', 'We cannot hold the night. We need you here before sunset.'] },
  lycan: { name: 'Lycanthrope attacks', short: 'LYCAN', color: '#a07a52', spread: 0.9, strength: 1.4, gear: 'vest',
    news: 'Animal attacks in {district} parks leave several dead. Hunting authorities deny any wolf population in the area.',
    call: ['Gendarmerie operations centre.', 'Six fatal attacks around {district} since the full moon. Tracks are wolf, but the size is wrong.', 'One suspect was shot four times and walked away.', 'Request immediate specialist response.'] },
  swarm: { name: 'Insectoid swarm', short: 'SWARM', color: '#d8c84a', spread: 1.4, strength: 1.1, gear: 'nrbc',
    news: 'Massive swarms of unidentified insects emerge from the sewers under {district}. Hundreds hospitalised.',
    call: ['Fire and rescue command, {city}.', 'The swarm came up from the drains in {district}. They strip a car in minutes.', 'There are nests forming in buildings. They are getting bigger.', 'We need containment now.'] },
};

// Real district names for surveyed cities, used in broadcasts.
export const DISTRICTS = {
  Strasbourg: ['Neudorf', 'Krutenau', 'Esplanade', 'Hautepierre', 'Cronenbourg', 'Robertsau', 'Koenigshoffen', 'Meinau', 'the Grande Île', 'the Port du Rhin'],
  Rennes: ['Villejean', 'Le Blosne', 'Maurepas', 'Bréquigny', 'Cleunay', 'Thabor', 'Sainte-Thérèse', 'the city centre'],
};
