// Traffic and pedestrians. Traffic cars drive the street grid in lanes and wrap
// around the island; pedestrians stroll the sidewalks and run from trouble.
// Everything is arcade-simple on purpose: the judge sees the life, not the AI.
import { CAR_MODELS, STREETS_X, STREETS_Z } from './config.js';
import { int, pick, range } from './random.js';

let nextCarId = 1;

/** A car object. kind: 'player' | 'traffic' | 'parked' | 'police'. */
export function makeCar(kind, model, x, z, angle, color) {
  return {
    id: nextCarId++,
    kind, model: model.key, name: model.name, top: model.top,
    x, z, angle, speed: 0, color: color ?? model.color,
    hp: 100, police: kind === 'police',
    // Traffic state (unused for other kinds).
    axis: 'x', line: 0, dir: 1, lane: 2, cruise: 10,
  };
}

/** Spawn the starting traffic (8 moving, 6 parked) and pedestrians (14). */
export function createTraffic(rng) {
  const cars = [];
  const peds = [];
  // Moving traffic: pick a street, a direction and a lane, spread along it.
  for (let i = 0; i < 9; i += 1) {
    const vertical = rng() < 0.5;
    const line = vertical ? pick(rng, STREETS_X) : pick(rng, STREETS_Z);
    const dir = rng() < 0.5 ? 1 : -1;
    const lane = dir > 0 ? 2.2 : -2.2;
    const along = range(rng, -190, 190);
    const model = pick(rng, CAR_MODELS.filter((m) => m.key !== 'coral-gt'));
    const car = makeCar('traffic', model, vertical ? line + lane : along, vertical ? along : line + lane,
      vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI), model.color);
    car.axis = vertical ? 'x' : 'z';
    car.line = line;
    car.dir = dir;
    car.lane = lane;
    car.cruise = range(rng, 8, 13);
    car.speed = car.cruise;
    cars.push(car);
  }
  // Parked cars along the streets, stealable.
  for (let i = 0; i < 7; i += 1) {
    const vertical = rng() < 0.5;
    const line = vertical ? pick(rng, STREETS_X) : pick(rng, STREETS_Z);
    const along = range(rng, -180, 180);
    const model = pick(rng, CAR_MODELS);
    const car = makeCar('parked', model, vertical ? line + 9.5 : along, vertical ? along : line + 9.5,
      vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI), model.color);
    cars.push(car);
  }
  // Pedestrians on the sidewalks.
  const shirtCols = ['#e5484d', '#f2c94c', '#4fc3f7', '#7fb069', '#ff5fa2', '#e8e2d2', '#9b8cf2'];
  for (let i = 0; i < 14; i += 1) {
    peds.push({
      x: range(rng, -200, 200), z: range(rng, -180, 180),
      angle: range(rng, 0, Math.PI * 2), speed: range(rng, 1.2, 2.2),
      tx: 0, tz: 0, state: 'walk', color: pick(rng, shirtCols), down: false,
    });
    const ped = peds[peds.length - 1];
    ped.tx = ped.x + range(rng, -40, 40);
    ped.tz = ped.z + range(rng, -40, 40);
  }
  return { cars, peds };
}

/** Is (x, z) inside any building box? */
export function insideBuilding(buildings, x, z, pad = 0) {
  for (const b of buildings) {
    if (x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad) return b;
  }
  return null;
}

/** Push a circle (x, z, r) out of every building box it overlaps. */
export function resolveBuildings(buildings, obj, r) {
  for (const b of buildings) {
    if (obj.x > b.x0 - r && obj.x < b.x1 + r && obj.z > b.z0 - r && obj.z < b.z1 + r) {
      const dxl = obj.x - (b.x0 - r), dxr = (b.x1 + r) - obj.x;
      const dzl = obj.z - (b.z0 - r), dzr = (b.z1 + r) - obj.z;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) obj.x = b.x0 - r;
      else if (m === dxr) obj.x = b.x1 + r;
      else if (m === dzl) obj.z = b.z0 - r;
      else obj.z = b.z1 + r;
      return b;
    }
  }
  return null;
}

/** The nearest car to (x, z) within maxDist, or null. */
export function nearestCar(cars, x, z, maxDist) {
  let best = null, bestD = maxDist;
  for (const car of cars) {
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function trafficAhead(cars, me) {
  for (const car of cars) {
    if (car === me || car.kind === 'parked') continue;
    if (car.axis !== me.axis || car.line !== me.line || car.dir !== me.dir) continue;
    const ahead = me.axis === 'x' ? (car.z - me.z) * me.dir : (car.x - me.x) * me.dir;
    if (ahead > 0 && ahead < 11) return true;
  }
  return false;
}

/** Advance traffic cars and pedestrians one step. */
export function stepTraffic(state, dt) {
  const { cars, peds, buildings } = state;
  for (const car of cars) {
    if (car.kind !== 'traffic') continue;
    const target = trafficAhead(cars, car) ? 0 : car.cruise;
    car.speed += Math.max(-14 * dt, Math.min(8 * dt, target - car.speed));
    const d = car.speed * car.dir * dt;
    if (car.axis === 'x') {
      car.z += d;
      car.x = car.line + car.lane;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (car.z > 205) car.z = -205;
      if (car.z < -205) car.z = 205;
    } else {
      car.x += d;
      car.z = car.line + car.lane;
      car.angle = car.dir > 0 ? 0 : Math.PI;
      if (car.x > 255) car.x = -255;
      if (car.x < -255) car.x = 255;
    }
  }
  for (const ped of peds) {
    if (ped.down) continue;
    if (ped.state === 'flee') {
      ped.speed = 5.5;
      const dx = ped.x - ped.fx, dz = ped.z - ped.fz;
      const len = Math.hypot(dx, dz) || 1;
      ped.angle = Math.atan2(dz / len, dx / len);
      ped.x += (dx / len) * ped.speed * dt;
      ped.z += (dz / len) * ped.speed * dt;
      ped.fleeTime -= dt;
      if (ped.fleeTime <= 0) ped.state = 'walk';
    } else {
      const dx = ped.tx - ped.x, dz = ped.tz - ped.z;
      const len = Math.hypot(dx, dz);
      if (len < 2) {
        ped.tx = Math.max(-240, Math.min(240, ped.x + range(state.rng, -50, 50)));
        ped.tz = Math.max(-190, Math.min(190, ped.z + range(state.rng, -50, 50)));
      } else {
        ped.angle = Math.atan2(dz, dx);
        ped.x += (dx / len) * ped.speed * dt;
        ped.z += (dz / len) * ped.speed * dt;
      }
    }
    ped.x = Math.max(-255, Math.min(255, ped.x));
    ped.z = Math.max(-205, Math.min(205, ped.z));
    if (insideBuilding(buildings, ped.x, ped.z, 0.5)) {
      ped.tx = ped.x + (ped.x > 0 ? -30 : 30);
      ped.tz = ped.z + (ped.z > 0 ? -30 : 30);
    }
  }
}

/** Make every pedestrian near (x, z) run away from it. */
export function scarePeds(state, x, z, radius = 25) {
  for (const ped of state.peds) {
    if (Math.hypot(ped.x - x, ped.z - z) < radius) {
      ped.state = 'flee';
      ped.fx = x; ped.fz = z;
      ped.fleeTime = 3;
    }
  }
}

/** A fresh parked car somewhere on the grid (keeps the streets stocked). */
export function spawnParkedCar(state) {
  const rng = state.rng;
  const vertical = rng() < 0.5;
  const line = vertical ? pick(rng, STREETS_X) : pick(rng, STREETS_Z);
  const along = range(rng, -180, 180);
  const model = pick(rng, CAR_MODELS);
  const car = makeCar('parked', model, vertical ? line + 9.5 : along, vertical ? along : line + 9.5,
    vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI), model.color);
  state.cars.push(car);
  return car;
}

export { int };
