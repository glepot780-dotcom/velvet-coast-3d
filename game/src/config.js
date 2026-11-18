// AZURE TIDE — every tuning number, colour and piece of story data in one place.
// The game is a 3D open-world crime game in the original island-city Meridian Bay.
// Coordinates: x east, z south, y up, metres. The island is x in [-260, 260],
// z in [-210, 210]; the ocean is everything outside it.

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Island bounds (land), and where the sand and the water start. */
export const WORLD = {
  minX: -260, maxX: 260, minZ: -210, maxZ: 210,
  beachX: -225, // west of this is sand
  beachZ: 175, // south of this is sand
  waterY: -0.6,
};

/** North-south streets (x) and east-west streets (z); the city grid. */
export const STREETS_X = [-200, -120, -40, 40, 120, 180];
export const STREETS_Z = [-160, -80, 0, 80, 160];
export const STREET_HALF = 7; // half-width of a road

/** Named districts, each with a centre, a colour for the map and a one-line flavour. */
export const DISTRICTS = [
  { name: 'Driftwood Beach', cx: -238, cz: 0, color: '#e8c98a', blurb: 'Sun, sand and fast cars on the strip' },
  { name: 'Neon Row', cx: 0, cz: 0, color: '#ff5fa2', blurb: 'Glass towers, neon and noise' },
  { name: 'Old Town', cx: -40, cz: 145, color: '#c9a25e', blurb: 'Narrow lanes, old money, old grudges' },
  { name: 'Crestview', cx: -40, cz: -145, color: '#7fb069', blurb: 'Quiet streets above the bay' },
  { name: 'Harbor Lights', cx: -200, cz: 145, color: '#4fc3f7', blurb: 'Marina, docks and boats that leave at night' },
  { name: 'Meridian Airfield', cx: 222, cz: 0, color: '#9b8cf2', blurb: 'Runway, hangar and one very fast plane' },
];

/** Key places (x, z). */
export const PLACES = {
  garage: { x: 140, z: 96, name: "Ivy's Garage" },
  garageDoor: { x: 120, z: 96, name: "Ivy's Garage — forecourt" },
  safehouse: { x: -60, z: -178, name: 'Safehouse' },
  hospital: { x: 60, z: -96, name: 'Meridian General' },
  marina: { x: -252, z: 140, name: 'Harbor Lights Marina' },
  airfield: { x: 222, z: 30, name: 'Meridian Airfield' },
  beachHut: { x: -242, z: 0, name: 'Lifeguard Hut' },
  casino: { x: 0, z: -40, name: 'The Azure Tide Casino' },
  bank: { x: 80, z: -40, name: 'Meridian Bay Bank' },
  policeHQ: { x: 150, z: 120, name: 'VCPD Headquarters' },
  yacht: { x: -288, z: 140, name: 'Yacht "High Water"' },
};

export const PLAYER = {
  walkSpeed: 6, sprintSpeed: 10, radius: 0.6, health: 100,
  enterDistance: 4.5,
};

export const CAR = {
  accel: 22, brake: 34, reverse: 10, maxSpeed: 42, maxReverse: 12,
  steer: 1.9, grip: 6, radius: 2.2, health: 100,
};

export const WANTED = {
  maxStars: 5, perStar: 2, maxCars: 10, sight: 60,
  heatSteal: 1, heatHitPed: 1, heatShoot: 1, heatKill: 2,
  decaySeconds: 14, // unseen this long, lose one star
  heliAtStars: 3, roadblockAtStars: 4,
};

/** Weapon slots: 1 fists, 2 pistol, 3 SMG, 4 shotgun. */
export const WEAPONS = [
  { key: 'fists', name: 'FISTS', short: 'FISTS', mag: Infinity, reserve: Infinity, damage: 25, rate: 0.45, range: 2.2, icon: 'fist' },
  { key: 'pistol', name: 'PISTOL', short: 'PISTOL', mag: 12, reserve: 48, damage: 34, rate: 0.28, range: 55, icon: 'pistol' },
  { key: 'smg', name: 'WASP SMG', short: 'SMG', mag: 32, reserve: 128, damage: 20, rate: 0.09, range: 48, icon: 'smg' },
  { key: 'shotgun', name: 'BOOMSTICK', short: 'SHOTGUN', mag: 6, reserve: 18, damage: 90, rate: 0.9, range: 22, icon: 'shotgun' },
];

/** Car models the city drives. */
export const CAR_MODELS = [
  { key: 'coral-gt', name: 'CORAL GT', color: '#e5484d', top: 46, price: 0 },
  { key: 'vela-coupe', name: 'VELA COUPE', color: '#f2c94c', top: 42, price: 1200 },
  { key: 'harbor-sedan', name: 'HARBOR SEDAN', color: '#4fc3f7', top: 36, price: 600 },
  { key: 'bay-pickup', name: 'BAY PICKUP', color: '#7fb069', top: 34, price: 800 },
  { key: 'sunset-taxi', name: 'SUNSET TAXI', color: '#f5a623', top: 36, price: 0 },
];

/** The crew. Portraits are drawn in 2D (initial + face), never images. */
export const CHARACTERS = {
  jax: { name: 'JAX CORSO', role: 'YOU · WHEELMAN', color: '#e5484d', initial: 'JX', line: 'Three years out. One last tide to ride.' },
  ivy: { name: 'IVY SLOANE', role: 'FIXER', color: '#ff5fa2', initial: 'IV', line: 'Jobs pay. Cops chase. You drive. Simple.' },
  dante: { name: 'DANTE FOX', role: 'WHEELMAN', color: '#f2c94c', initial: 'DF', line: 'If it has wheels, I can steal it twice.' },
  priya: { name: 'PRIYA NAIR', role: 'HACKER', color: '#4fc3f7', initial: 'PN', line: 'Cameras, alarms, vaults — all just doors.' },
  marcus: { name: 'MARCUS HALE', role: 'MUSCLE', color: '#7fb069', initial: 'MH', line: 'Talk soft. Carry something loud.' },
  voss: { name: 'CHIEF ELENA VOSS', role: 'MERIDIAN PD', color: '#8b93a3', initial: 'EV', line: 'All units: box that car in. Now.' },
  officer: { name: 'OFFICER DANA REYES', role: 'VCPD · FOOT PATROL', color: '#1d4ed8', initial: 'DR', line: 'On foot now. You are not walking away from this.' },
};

/** Radio stations (procedural WebAudio, no files). */
export const RADIO = [
  { name: 'WAVE 88.1', show: 'Neon Drive', desc: 'SYNTHWAVE · COASTAL NIGHTS', tempo: 112, scale: [0, 3, 5, 7, 10] },
  { name: 'CORAL 104', show: 'Sunset Synth', desc: 'PALM STATIC · CORAL GHOSTS', tempo: 96, scale: [0, 2, 4, 7, 9] },
  { name: 'HARBOR FM', show: 'Dock Talk', desc: 'NEWS · TIDE TIMES · TRAFFIC', tempo: 80, scale: [0, 5, 7, 12] },
];

/**
 * The story: 7 jobs across 3 days. A stage is one of:
 *  goto    — reach (x, z) within r
 *  timed   — goto with a countdown
 *  collect — visit every point in points (on foot or by car)
 *  combat  — defeat `count` hostiles spawned near (x, z)
 *  escape  — bring wanted down to 0
 * `spawnWanted` sets the wanted level when the stage starts.
 */
export const MISSIONS = [
  {
    id: 1, day: 1, title: 'FIRST WHEELS', giver: 'ivy', pay: 400,
    brief: 'You need wheels before you need anything. Take any car on Neon Row and bring it to my garage.',
    stages: [
      { kind: 'goto', label: 'Get in a car and reach Neon Row', x: 0, z: 0, r: 30, needsCar: true },
      { kind: 'goto', label: 'Bring the car to Ivy\'s Garage', x: 120, z: 96, r: 8, needsCar: true },
    ],
    done: 'Clean. You drive like you mean it. More work where that came from.',
  },
  {
    id: 2, day: 1, title: 'COAST RUN', giver: 'ivy', pay: 700,
    brief: 'A package for the lifeguard hut on Driftwood Beach. Ninety seconds, coast road, no cops. Go.',
    stages: [
      { kind: 'timed', label: 'Deliver the package to the Lifeguard Hut', x: -242, z: 0, r: 8, seconds: 90 },
    ],
    done: 'Ninety seconds and the tide did not even notice you.',
  },
  {
    id: 3, day: 1, title: 'DOCKSIDE', giver: 'dante', pay: 900,
    brief: 'Meet me at Harbor Lights Marina. Bring the boat papers. Cops will be curious — lose them after.',
    stages: [
      { kind: 'goto', label: 'Meet Dante at Harbor Lights Marina', x: -252, z: 140, r: 10 },
      { kind: 'escape', label: 'Lose the cops — get your wanted level to zero', spawnWanted: 2 },
    ],
    done: 'They never look at the water. Remember that.',
  },
  {
    id: 4, day: 2, title: 'PAPER TRAIL', giver: 'priya', pay: 1200,
    brief: 'Three ledgers in Old Town. The men guarding them are not friendly. On foot, quiet — or loud, your call.',
    stages: [
      { kind: 'collect', label: 'Collect the ledgers in Old Town (0/3)', points: [[-80, 120], [-20, 170], [-120, 100]], r: 4 },
      { kind: 'goto', label: 'Bring the ledgers to Priya', x: -40, z: 120, r: 8 },
    ],
    done: 'Three ledgers, zero alarms I could not silence. Nice.',
  },
  {
    id: 5, day: 2, title: 'RUNWAY LIGHTS', giver: 'dante', pay: 1800,
    brief: 'A cargo plane lands at Meridian Airfield at dusk. Take its cargo. The runway is long — use all of it.',
    stages: [
      { kind: 'goto', label: 'Reach the cargo plane at Meridian Airfield', x: 222, z: 30, r: 12 },
      { kind: 'combat', label: 'Take out the airfield guards (0/4)', x: 222, z: 30, r: 40, count: 4 },
      { kind: 'goto', label: 'Get the cargo to Ivy\'s Garage', x: 120, z: 96, r: 8, needsCar: true },
    ],
    done: 'You stole from a plane. On a runway. In front of everyone. Legend.',
  },
  {
    id: 6, day: 2, title: 'HEAT WAVE', giver: 'ivy', pay: 2200,
    brief: 'Four stars, a helicopter, the whole department. Get to the safehouse in Crestview — or make them lose you.',
    stages: [
      { kind: 'escape', label: 'Lose the cops — helicopter and all', spawnWanted: 4 },
      { kind: 'goto', label: 'Reach the safehouse in Crestview', x: -60, z: -178, r: 10 },
    ],
    done: 'Four stars and a chopper, and you walked away. The city is talking.',
  },
  {
    id: 7, day: 3, title: 'THE BIG TIDE', giver: 'ivy', pay: 5000,
    brief: 'The Azure Tide Casino vault. Take the loot, lose the city, and deliver it to the yacht at Harbor Lights. Then we are done.',
    stages: [
      { kind: 'goto', label: 'Hit the Azure Tide Casino vault', x: 0, z: -40, r: 22 },
      { kind: 'combat', label: 'Hold the casino floor — take out the guards (0/5)', x: 0, z: -40, r: 45, count: 5 },
      { kind: 'timed', label: 'Deliver the loot to the yacht at Harbor Lights', x: -252, z: 140, r: 10, seconds: 150 },
    ],
    done: 'The tide came in, and it brought us home. Meridian Bay is yours now.',
  },
];

/** Dusk look: sun low in the west, warm light, purple sky. */
export const DUSK = {
  timeOfDay: 18.6, // hours
  sunDir: [-0.85, 0.22, -0.35], // from the west, low
  sunColor: [1.0, 0.58, 0.28],
  ambient: [0.42, 0.36, 0.5],
  skyTop: [0.16, 0.12, 0.32],
  skyHorizon: [1.0, 0.55, 0.3],
  fogColor: [0.85, 0.5, 0.38],
  fogNear: 150, fogFar: 850,
};

export const PALETTE = {
  asphalt: '#33363d', roadLine: '#d8c25a', sidewalk: '#6b6f78',
  grass: '#4d7a45', sand: '#e8c98a', water: '#1d6f8e', waterDeep: '#0f4a68',
  building: ['#7d6a8a', '#5e7d8a', '#8a6a5e', '#6a7d5e', '#8a5e6a', '#5e6a8a', '#a08a5e'],
  roof: ['#3a3340', '#2f3a40', '#40342f', '#33402f'],
  windowLit: '#ffd27a', windowDark: '#2a2f3a',
  palmTrunk: '#6b4a2f', palmLeaf: '#3f7a3a',
  police: '#e8e8e8', policeTrim: '#1d4ed8',
  heli: '#2f3542',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save is kept between visits (this browser only). */
export const SAVE_KEY = 'azure-tide.save.v1';

export const GARAGE_ITEMS = [
  { key: 'armor', name: 'ARMOUR PLATING', desc: '+50 max armour', price: 400 },
  { key: 'engine', name: 'ENGINE TUNE', desc: '+15% top speed', price: 900 },
  { key: 'tires', name: 'GRIP TIRES', desc: 'Sharper steering', price: 600 },
  { key: 'respray', name: 'RESPRAY + NEW PLATES', desc: 'Clears your wanted level', price: 250 },
  { key: 'ammo', name: 'AMMO CRATE', desc: 'Refills every weapon', price: 150 },
  { key: 'vela', name: 'BUY: VELA COUPE', desc: 'Quick, light, yellow', price: 1200 },
  { key: 'pickup', name: 'BUY: BAY PICKUP', desc: 'Heavy, slow, unstoppable', price: 800 },
];
