// The world: one state object and one step. The player drives or walks Meridian
// Bay, steals cars, earns wanted stars, shoots, runs missions, buys upgrades and
// saves. Everything the renderer and the HUD draw comes from here.
import {
  CAR, CAR_MODELS, DUSK, GARAGE_ITEMS, PLACES, PLAYER, SAVE_KEY, WEAPONS, WORLD,
} from './config.js';
import { createRandom, pick } from './random.js';
import { buildCity } from './city.js';
import { buildWaterMesh } from './sea.js';
import {
  createTraffic, insideBuilding, nearestCar, resolveBuildings, scarePeds,
  spawnParkedCar, stepTraffic,
} from './traffic.js';
import { addHeat, createPolice, dispatchLine, dropWanted, stepOfficers, stepPolice } from './police.js';
import {
  createMissionState, currentMission, loadProgress, saveProgress, startMission,
  stepHostiles, updateMissions,
} from './missions.js';

/** The player's starting car, parked by the safehouse. */
const STARTER_CAR = 'coral-gt';

export function createWorld(seed) {
  const rng = createRandom(seed);
  const city = buildCity(rng);
  const water = buildWaterMesh();
  const traffic = createTraffic(rng);

  const state = {
    rng,
    seed,
    time: 0,
    timeOfDay: DUSK.timeOfDay,
    day: 1,
    money: 250,
    respect: 1,
    heat: 0,
    wanted: 0,
    screen: 'title',
    saveKey: SAVE_KEY,
    city,
    water,
    buildings: city.buildings,
    cars: traffic.cars,
    peds: traffic.peds,
    player: {
      x: -44, z: -150, angle: Math.PI / 2, speed: 0,
      onFoot: true, hp: PLAYER.health, armor: 0,
      car: null, weapon: 1, // pistol
      ammo: [Infinity, 12, 32, 6],
      reserve: [Infinity, 48, 128, 18],
      muzzle: 0, aimX: 0, aimZ: 0,
    },
    missions: createMissionState(),
    police: createPolice(),
    boats: [],
    planeParked: { x: 222, y: 0, z: 52, angle: -Math.PI / 2 },
    planeFlying: { orbit: 0.6, radius: 430, y: 130, speed: 0.045 },
    camera: { x: 0, y: 8, z: -20, lx: 0, ly: 2, lz: 0, mode: 'title' },
    radio: { station: 0 },
    radioLine: 'WAVE 88.1 · Neon Drive — Pink Horizon, Lumen Kids.',
    dialogue: null,
    wheelOpen: false,
    wheelSelected: 2,
    flashRed: 0,
    ownedCars: [STARTER_CAR],
    upgrades: { engine: 0, tires: 0 },
    stats: { shots: 0, hits: 0, stolen: 0 },
    parkedTimer: 0,
    bustedFine: 200,
    message: null, // {text, until} — small toast line
  };

  // The starter car waits by the safehouse.
  const starter = CAR_MODELS.find((m) => m.key === STARTER_CAR);
  const car = {
    id: 9001, kind: 'parked', model: starter.key, name: starter.name, top: starter.top,
    x: -40, z: -150, angle: Math.PI / 2, speed: 0, color: starter.color, hp: 100, police: false,
    axis: 'x', line: 0, dir: 1, lane: 0, cruise: 0, owned: true,
  };
  state.cars.push(car);
  state.starterCar = car;

  // Boats: three moored at the marina piers, one yacht at the end of pier 2,
  // two sailing the open water.
  const boatCols = ['#e8e2d2', '#4fc3f7', '#e5484d', '#f2c94c'];
  state.boats.push({ x: -272, y: -0.4, z: 118, angle: Math.PI / 2, moored: true, color: boatCols[0], size: 1 });
  state.boats.push({ x: -272, y: -0.4, z: 140, angle: Math.PI / 2, moored: true, color: boatCols[1], size: 1.1 });
  state.boats.push({ x: -272, y: -0.4, z: 162, angle: Math.PI / 2, moored: true, color: boatCols[2], size: 0.9 });
  state.boats.push({ x: -292, y: -0.4, z: 140, angle: 0, moored: true, color: '#f2f0e6', size: 1.5, yacht: true });
  state.boats.push({ x: -320, y: -0.4, z: -60, angle: 0.6, moored: false, color: boatCols[3], size: 1, orbit: 0.6, orbitR: 90, cx: -330, cz: -40 });
  state.boats.push({ x: 60, y: -0.4, z: 320, angle: 2.4, moored: false, color: boatCols[1], size: 1, orbit: 2.4, orbitR: 120, cx: 40, cz: 300 });

  return state;
}

/** A fresh game (new game from the title screen). */
export function resetWorld(state) {
  const fresh = createWorld(state.seed);
  // Keep the save key and the seed; everything else starts over.
  for (const key of Object.keys(fresh)) state[key] = fresh[key];
  state.screen = 'play';
  startMission(state, 0);
}

/** Continue from a save: money, missions, owned cars. */
export function applySave(state, save) {
  if (!save) return;
  state.money = save.money ?? state.money;
  state.respect = save.respect ?? 1;
  state.ownedCars = save.owned ?? state.ownedCars;
  state.upgrades = save.upgrades ?? state.upgrades;
  state.screen = 'play';
  startMission(state, Math.min(save.missionIndex ?? 0, 6));
}

export function playerCar(state) {
  return state.player.car;
}

/** Enter the nearest car, or step out of the one you are in. */
export function toggleEnterCar(state) {
  const p = state.player;
  if (!p.onFoot) {
    // Step out beside the car.
    const car = p.car;
    p.onFoot = true;
    p.x = car.x - Math.sin(car.angle) * 3;
    p.z = car.z + Math.cos(car.angle) * 3;
    p.angle = car.angle;
    p.speed = 0;
    p.car = null;
    car.speed = 0;
    return;
  }
  const car = nearestCar(state.cars, p.x, p.z, PLAYER.enterDistance);
  if (!car || car.police) return;
  if (car.kind === 'traffic' || (car.kind === 'parked' && !car.owned)) {
    // Stealing is a crime.
    addHeat(state, 1);
    state.radioLine = 'Dispatch: vehicle theft reported on Neon Row.';
    state.stats.stolen += 1;
    scarePeds(state, p.x, p.z, 20);
  }
  if (p.car) p.car.kind = 'parked';
  car.kind = 'player';
  p.car = car;
  p.onFoot = false;
  p.angle = car.angle;
  p.speed = car.speed;
}

/** Fire the current weapon toward the aim point. */
export function shoot(state) {
  const p = state.player;
  const w = WEAPONS[p.weapon];
  if (w.key === 'fists') {
    // A swing: hit the nearest hostile or pedestrian in reach.
    const targets = [...state.missions.hostiles.filter((h) => h.hp > 0), ...state.peds.filter((d) => !d.down)];
    let best = null, bestD = w.range;
    for (const t of targets) {
      const d = Math.hypot(t.x - p.x, t.z - p.z);
      if (d < bestD) { bestD = d; best = t; }
    }
    if (best) damageTarget(state, best, w.damage);
    p.muzzle = 0.12;
    return;
  }
  if (p.ammo[p.weapon] <= 0) {
    state.message = { text: 'Click — empty. Buy ammo at the garage.', until: state.time + 2 };
    return;
  }
  p.ammo[p.weapon] -= 1;
  p.muzzle = 0.08;
  state.stats.shots += 1;
  const aim = Math.atan2(p.aimZ - p.z, p.aimX - p.x);
  // The nearest hostile, pedestrian or police car inside the cone.
  const targets = [
    ...state.missions.hostiles.filter((h) => h.hp > 0),
    ...state.peds.filter((d) => !d.down),
    ...state.cars.filter((c) => c.police),
  ];
  let best = null, bestD = w.range;
  for (const t of targets) {
    const d = Math.hypot(t.x - p.x, t.z - p.z);
    if (d > w.range) continue;
    let diff = Math.atan2(t.z - p.z, t.x - p.x) - aim;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < 0.45 && d < bestD) { bestD = d; best = t; }
  }
  if (best) {
    state.stats.hits += 1;
    damageTarget(state, best, w.damage);
  }
  if (!p.onFoot || state.wanted === 0) {
    // Gunfire in public draws the law — unless nobody is around to hear it.
    const near = state.peds.some((d) => Math.hypot(d.x - p.x, d.z - p.z) < 40)
      || state.cars.some((c) => c.police && Math.hypot(c.x - p.x, c.z - p.z) < 60);
    if (near) addHeat(state, 1);
  }
  scarePeds(state, p.x, p.z, 30);
}

function damageTarget(state, target, dmg) {
  if (target.hp !== undefined) {
    target.hp -= dmg;
    if (target.hp <= 0) {
      if (state.missions.hostiles.includes(target)) {
        state.missions.killed += 1;
      } else if (target.kind === 'police') {
        // A wrecked interceptor: it is gone, and the city noticed.
        target.kind = 'gone';
        state.cars = state.cars.filter((c) => c.kind !== 'gone');
        addHeat(state, 2);
      }
    }
    return;
  }
  // A pedestrian.
  target.down = true;
  target.state = 'down';
  addHeat(state, 1);
  state.radioLine = 'Dispatch: pedestrian down — units respond.';
}

/** Buy one garage item. Returns a message for the HUD. */
export function buyGarageItem(state, key) {
  const item = GARAGE_ITEMS.find((i) => i.key === key);
  if (!item) return 'No such item.';
  if (state.money < item.price) return 'Not enough cash.';
  if (key === 'respray') {
    state.money -= item.price;
    dropWanted(state, 5);
    return 'Respray done — clean plates, clean record.';
  }
  if (key === 'ammo') {
    state.money -= item.price;
    state.player.ammo = [Infinity, 12, 32, 6];
    state.player.reserve = [Infinity, 48, 128, 18];
    return 'Ammo crate loaded.';
  }
  if (key === 'armor') {
    state.money -= item.price;
    state.player.armor = 100;
    return 'Armour plating fitted.';
  }
  if (key === 'engine') {
    if (state.upgrades.engine >= 2) return 'Engine is already maxed.';
    state.money -= item.price;
    state.upgrades.engine += 1;
    return 'Engine tuned — faster top speed.';
  }
  if (key === 'tires') {
    if (state.upgrades.tires >= 1) return 'Grip tires already fitted.';
    state.money -= item.price;
    state.upgrades.tires = 1;
    return 'Grip tires fitted — sharper steering.';
  }
  if (key === 'vela' || key === 'pickup') {
    const modelKey = key === 'vela' ? 'vela-coupe' : 'bay-pickup';
    if (state.ownedCars.includes(modelKey)) return 'You already own that car.';
    state.money -= item.price;
    state.ownedCars.push(modelKey);
    const model = CAR_MODELS.find((m) => m.key === modelKey);
    const car = {
      id: 9000 + state.ownedCars.length, kind: 'parked', model: model.key, name: model.name,
      top: model.top, x: PLACES.garageDoor.x, z: PLACES.garageDoor.z + 8, angle: 0, speed: 0,
      color: model.color, hp: 100, police: false, axis: 'x', line: 0, dir: 1, lane: 0, cruise: 0, owned: true,
    };
    state.cars.push(car);
    saveProgress(state);
    return `${model.name} is parked outside the garage.`;
  }
  return 'No such item.';
}

/** Move the player on foot. */
function stepOnFoot(state, input, dt) {
  const p = state.player;
  const fwd = input.moveY; // W/S
  const strafe = input.moveX; // A/D
  const speed = input.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  // Movement is relative to the camera's facing.
  const camA = Math.atan2(state.camera.lz - state.camera.z, state.camera.lx - state.camera.x);
  const mx = Math.cos(camA) * fwd - Math.sin(camA) * strafe;
  const mz = Math.sin(camA) * fwd + Math.cos(camA) * strafe;
  const len = Math.hypot(mx, mz);
  if (len > 0.01) {
    p.angle = Math.atan2(mz, mx);
    p.x += (mx / len) * speed * dt;
    p.z += (mz / len) * speed * dt;
    p.speed = speed;
    p.walking = true;
  } else {
    p.speed = 0;
    p.walking = false;
  }
  // Aim where the mouse points on the ground.
  const aimLen = Math.hypot(p.aimX - p.x, p.aimZ - p.z);
  if (aimLen > 1 && input.mouseActive) p.angle = Math.atan2(p.aimZ - p.z, p.aimX - p.x);
  resolveBuildings(state.buildings, p, PLAYER.radius);
  p.x = Math.max(WORLD.minX + 2, Math.min(WORLD.maxX - 2, p.x));
  p.z = Math.max(WORLD.minZ + 2, Math.min(WORLD.maxZ - 2, p.z));
}

/** Arcade driving: accelerate, steer, collide with buildings and cars. */
function stepDriving(state, input, dt) {
  const p = state.player;
  const car = p.car;
  if (!car) return;
  const top = car.top * (1 + state.upgrades.engine * 0.07);
  const steerPower = CAR.steer * (1 + state.upgrades.tires * 0.25);
  if (input.moveY > 0) car.speed += CAR.accel * dt;
  else if (input.moveY < 0) car.speed -= (car.speed > 0.5 ? CAR.brake : CAR.reverse) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  if (input.handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
  car.speed = Math.max(-CAR.maxReverse, Math.min(top, car.speed));
  const steer = input.moveX * steerPower * Math.min(1, Math.abs(car.speed) / 8) * (car.speed < 0 ? -1 : 1);
  car.angle += steer * dt * (car.speed >= 0 ? 1 : -1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.z += Math.sin(car.angle) * car.speed * dt;
  const hit = resolveBuildings(state.buildings, car, CAR.radius);
  if (hit) {
    // A scrape: lose speed, take a little damage (throttled).
    state.scrapeTimer = (state.scrapeTimer ?? 0) - dt;
    if ((state.scrapeTimer ?? 0) <= 0) {
      car.hp = Math.max(0, car.hp - 4);
      state.scrapeTimer = 0.6;
    }
    car.speed *= 0.4;
  }
  // Bumping other cars.
  for (const other of state.cars) {
    if (other === car || other.kind === 'gone') continue;
    const d = Math.hypot(other.x - car.x, other.z - car.z);
    if (d < 4.4 && d > 0.01) {
      const push = (4.4 - d) / 2;
      const ux = (car.x - other.x) / d, uz = (car.z - other.z) / d;
      car.x += ux * push;
      car.z += uz * push;
      if (other.kind !== 'police' || !other.roadblock) {
        other.x -= ux * push;
        other.z -= uz * push;
      }
      state.bumpTimer = (state.bumpTimer ?? 0) - dt;
      if ((state.bumpTimer ?? 0) <= 0) {
        car.hp = Math.max(0, car.hp - 2);
        state.bumpTimer = 0.5;
      }
    }
  }
  // Running over a pedestrian is a crime.
  for (const ped of state.peds) {
    if (ped.down) continue;
    const d = Math.hypot(ped.x - car.x, ped.z - car.z);
    if (d < 2.6 && Math.abs(car.speed) > 6) {
      ped.down = true;
      ped.state = 'down';
      addHeat(state, 1);
      state.radioLine = 'Dispatch: pedestrian struck — units respond.';
      scarePeds(state, car.x, car.z, 25);
    }
  }
  car.x = Math.max(WORLD.minX + 2, Math.min(WORLD.maxX - 2, car.x));
  car.z = Math.max(WORLD.minZ + 2, Math.min(WORLD.maxZ - 2, car.z));
  p.x = car.x;
  p.z = car.z;
  p.angle = car.angle;
  p.speed = car.speed;
  if (car.hp <= 0) {
    // The car is wrecked: you climb out as it dies.
    car.kind = 'gone';
    state.cars = state.cars.filter((c) => c.kind !== 'gone');
    p.car = null;
    p.onFoot = true;
    p.x = car.x - Math.sin(car.angle) * 3;
    p.z = car.z + Math.cos(car.angle) * 3;
    addHeat(state, 1);
    state.message = { text: 'Your car is wrecked!', until: state.time + 3 };
  }
}

/** The chase camera: behind and above the player, smoothed. Closer and
 * lower than before, so the car reads big and the street has depth. */
function stepCamera(state, dt) {
  const p = state.player;
  const cam = state.camera;
  if (state.screen === 'title') return; // the title shot sets its own camera
  const dist = p.onFoot ? 6.5 : 6;
  const height = p.onFoot ? 2.8 : 2.6;
  const fx = Math.cos(p.angle), fz = Math.sin(p.angle);
  const tx = p.x - fx * dist;
  const tz = p.z - fz * dist;
  const k = Math.min(1, 6 * dt);
  cam.x += (tx - cam.x) * k;
  cam.z += (tz - cam.z) * k;
  cam.y += (height - cam.y) * k;
  cam.lx = p.x + fx * 5;
  cam.ly = p.onFoot ? 1.6 : 1.8;
  cam.lz = p.z + fz * 5;
}

/** One fixed step of the whole world. */
export function stepWorld(state, input, dt) {
  state.time += dt;
  const p = state.player;

  // Dialogue and toasts expire on their own.
  if (state.dialogue && state.time > state.dialogue.until) state.dialogue = null;
  if (state.message && state.time > state.message.until) state.message = null;
  if (p.muzzle > 0) p.muzzle -= dt;
  if (state.flashRed > 0) state.flashRed -= dt;

  // The sea and sky keep moving even on the title screen.
  state.planeFlying.orbit += state.planeFlying.speed * dt;
  for (const boat of state.boats) {
    if (!boat.moored) {
      boat.orbit += dt * 0.05;
      boat.x = boat.cx + Math.cos(boat.orbit) * boat.orbitR;
      boat.z = boat.cz + Math.sin(boat.orbit) * boat.orbitR;
      boat.angle = boat.orbit + Math.PI / 2;
    }
  }

  if (state.screen !== 'play') {
    // Title screen: the city idles (traffic drives, boats sail).
    stepTraffic(state, dt);
    stepCamera(state, dt);
    return;
  }

  // Shooting (mouse click) — one shot per click, handled by main.js via input.shoot.
  if (input.shoot) {
    shoot(state);
    input.shoot = false;
  }
  if (input.enter) {
    toggleEnterCar(state);
    input.enter = false;
  }

  if (p.onFoot) stepOnFoot(state, input, dt);
  else stepDriving(state, input, dt);

  stepTraffic(state, dt);
  stepPolice(state, dt);
  stepOfficers(state, dt);
  stepHostiles(state, dt);
  updateMissions(state, dt);
  stepCamera(state, dt);

  // Radio chatter follows the heat.
  if (state.wanted > 0 && state.rng() < dt * 0.05) {
    state.radioLine = dispatchLine(state);
  }

  // Parked cars restock the streets slowly.
  state.parkedTimer += dt;
  if (state.parkedTimer > 25) {
    state.parkedTimer = 0;
    if (state.cars.filter((c) => c.kind === 'parked').length < 9) spawnParkedCar(state);
  }

  // Busted: no health left.
  if (p.hp <= 0) {
    state.screen = 'busted';
    state.money = Math.max(0, state.money - state.bustedFine);
    dropWanted(state, 5);
    p.hp = PLAYER.health;
    p.x = PLACES.hospital.x;
    p.z = PLACES.hospital.z;
    p.onFoot = true;
    p.car = null;
    state.radioLine = `BUSTED — $${state.bustedFine} fine. You wake up at Meridian General.`;
    saveProgress(state);
  }
}

/** Where the camera looks for the title screen: set by shots.js. */
export function setTitleCamera(state, x, y, z, lx, ly, lz) {
  state.camera.x = x;
  state.camera.y = y;
  state.camera.z = z;
  state.camera.lx = lx;
  state.camera.ly = ly;
  state.camera.lz = lz;
}

export { loadProgress, saveProgress, currentMission, pick };
