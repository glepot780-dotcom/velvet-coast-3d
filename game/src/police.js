// The Meridian PD: wanted level, pursuit cars, roadblocks and the police
// helicopter. Crimes add heat; heat crosses whole stars; stars bring cars.
// The helicopter arrives at three stars and never leaves while you are hot.
import { WANTED } from './config.js';
import { insideBuilding, makeCar, resolveBuildings } from './traffic.js';

const POLICE_MODEL = { key: 'interceptor', name: 'VCPD INTERCEPTOR', color: '#e8e8e8', top: 44 };

/** Fresh police state. */
export function createPolice() {
  return {
    cars: [], // pursuit car ids (the cars themselves live in state.cars)
    heli: { active: false, x: 0, z: 0, y: 46, angle: 0, rotor: 0, orbit: 0 },
    roadblocks: [], // {x, z, angle, carIds}
    officers: [], // on-foot officers {x, z, angle, bust}
    officerTimer: 0,
    officerAnnounced: false,
    spawnTimer: 0,
    cleanTimer: 0,
    seen: false,
  };
}

/** Crime adds heat; heat crosses whole stars. */
export function addHeat(state, amount) {
  state.heat = Math.min(WANTED.maxStars, (state.heat ?? 0) + amount);
  state.wanted = Math.floor(state.heat);
  if (state.wanted > 0) state.police.cleanTimer = 0;
}

/** Clear some or all wanted stars (respray, bribe, hiding). */
export function dropWanted(state, stars) {
  state.heat = Math.max(0, (state.heat ?? 0) - stars);
  state.wanted = Math.floor(state.heat);
  if (state.wanted === 0) {
    // The pursuit stands down.
    for (const car of state.cars.filter((c) => c.kind === 'police')) car.kind = 'gone';
    state.cars = state.cars.filter((c) => c.kind !== 'gone');
    state.police.cars = [];
    state.police.roadblocks = [];
    state.police.officers = [];
    state.police.officerAnnounced = false;
    state.police.heli.active = false;
  }
}

function spawnPoliceCar(state, px, pz) {
  // Spawn on an edge street, far enough away that the player can break
  // line of sight and lose the cops — but close enough to arrive in seconds.
  // Prefer a spot 120–220 m out; fall back to the farthest candidate.
  const cands = [];
  for (const line of [-200, 180]) {
    for (const off of [-140, 140]) cands.push([line, Math.max(-190, Math.min(190, pz + off))]);
  }
  for (const line of [-160, 160]) {
    for (const off of [-140, 140]) cands.push([Math.max(-240, Math.min(240, px + off)), line]);
  }
  let best = null, bestD = -1;
  for (const [x, z] of cands) {
    const d = Math.hypot(x - px, z - pz);
    if (d >= 120 && d <= 220) { best = [x, z]; bestD = d; break; }
    if (d > bestD) { bestD = d; best = [x, z]; }
  }
  const [sx, sz] = best;
  const vertical = sx === -200 || sx === 180;
  const car = makeCar('police', POLICE_MODEL, sx, sz,
    vertical ? (sz > pz ? -Math.PI / 2 : Math.PI / 2) : (sx > px ? Math.PI : 0));
  car.speed = 20;
  state.cars.push(car);
  state.police.cars.push(car.id);
  return car;
}

function spawnRoadblock(state, px, pz, playerAngle) {
  // Two police cars parked across the road ahead of the player.
  const ahead = 34;
  const cx = px + Math.cos(playerAngle) * ahead;
  const cz = pz + Math.sin(playerAngle) * ahead;
  const perp = playerAngle + Math.PI / 2;
  const ids = [];
  for (const side of [-1, 1]) {
    const car = makeCar('police', POLICE_MODEL,
      cx + Math.cos(perp) * side * 3.4, cz + Math.sin(perp) * side * 3.4, perp);
    car.speed = 0;
    car.roadblock = true;
    state.cars.push(car);
    ids.push(car.id);
  }
  state.police.roadblocks.push({ x: cx, z: cz, angle: perp, carIds: ids });
}

function spawnOfficer(state, px, pz) {
  // On a street near the player, 15–30 m out, never inside a building.
  let spot = [px + 20, pz];
  for (let i = 0; i < 8; i += 1) {
    const a = state.rng() * Math.PI * 2;
    const d = 15 + state.rng() * 15;
    const x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d;
    if (x > -255 && x < 255 && z > -205 && z < 205 && !insideBuilding(state.buildings, x, z, 1)) {
      spot = [x, z];
      break;
    }
  }
  state.police.officers.push({ x: spot[0], z: spot[1], angle: 0, bust: 0 });
  if (!state.police.officerAnnounced) {
    state.police.officerAnnounced = true;
    state.dialogue = { who: 'officer', text: 'On foot now. You are not walking away from this.', until: state.time + 4 };
    state.radioLine = 'Dispatch: foot patrol converging on the suspect.';
  }
}

/** One police step: keep the right number of pursuit cars, move them toward the
 * player, lay roadblocks at four stars and above, fly the helicopter. */
export function stepPolice(state, dt) {
  const police = state.police;
  const player = state.player;
  const px = player.x, pz = player.z;

  if (state.wanted <= 0) {
    police.heli.active = false;
    police.officers = [];
    police.officerAnnounced = false;
    return;
  }

  // Wanted strength decides how many cars hunt.
  const wantedCars = Math.min(WANTED.maxCars, state.wanted * WANTED.perStar);
  const alive = state.cars.filter((c) => c.kind === 'police' && !c.roadblock);
  police.spawnTimer -= dt;
  if (alive.length < wantedCars && police.spawnTimer <= 0) {
    spawnPoliceCar(state, px, pz);
    // Higher heat brings cars faster.
    police.spawnTimer = Math.max(0.6, 1.6 - state.wanted * 0.2);
  }

  // Roadblocks at four stars and above.
  if (state.wanted >= WANTED.roadblockAtStars && police.roadblocks.length < state.wanted - 3 && police.spawnTimer <= -1) {
    spawnRoadblock(state, px, pz, player.angle);
    police.spawnTimer = 0;
  }

  // Pursuit: steer toward the player, ram on contact.
  for (const car of alive) {
    const dx = px - car.x, dz = pz - car.z;
    const dist = Math.hypot(dx, dz) || 1;
    const want = Math.atan2(dz, dx);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const target = dist > 60 ? 40 : 34;
    car.speed += Math.max(-20 * dt, Math.min(14 * dt, target - car.speed));
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.z += Math.sin(car.angle) * car.speed * dt;
    // Ram: shove the player's car and damage it.
    if (dist < 4.5) {
      const pc = player.car;
      if (pc) {
        pc.hp = Math.max(0, pc.hp - 6 * dt);
        pc.x += (dx / dist) * -2.5 * dt * 10;
        pc.z += (dz / dist) * -2.5 * dt * 10;
      }
    }
  }

  // On-foot officers: they deploy at two stars and above while you are on
  // foot, chase you down and cuff you if they hold you for 1.2 s. You can
  // outrun them by sprinting or by getting in a car.
  const wantOfficers = player.onFoot ? Math.min(4, state.wanted) : 0;
  police.officerTimer -= dt;
  if (police.officers.length < wantOfficers && police.officerTimer <= 0) {
    spawnOfficer(state, px, pz);
    police.officerTimer = 2;
  }
  for (const off of police.officers) {
    const dx = px - off.x, dz = pz - off.z;
    const d = Math.hypot(dx, dz) || 1;
    off.angle = Math.atan2(dz, dx);
    if (d > 1.8) {
      off.x += (dx / d) * 7.5 * dt;
      off.z += (dz / d) * 7.5 * dt;
      off.bust = 0;
    } else {
      off.bust = (off.bust ?? 0) + dt;
      if (off.bust > 1.2) {
        // Cuffed: the bust plays out like being caught with no health.
        state.player.hp = 0;
        state.radioLine = 'Officer Reyes: you are coming with us. Hands where I can see them.';
      }
    }
    resolveBuildings(state.buildings, off, 0.6);
    off.x = Math.max(-255, Math.min(255, off.x));
    off.z = Math.max(-205, Math.min(205, off.z));
  }

  // The helicopter: orbits the player, rotor spinning, searchlight on.
  const heli = police.heli;
  if (state.wanted >= WANTED.heliAtStars) {
    heli.active = true;
    heli.orbit += dt * 0.35;
    const r = 26;
    heli.x = px + Math.cos(heli.orbit) * r;
    heli.z = pz + Math.sin(heli.orbit) * r;
    heli.y = 46;
    heli.angle = Math.atan2(pz - heli.z, px - heli.x);
  } else {
    heli.active = false;
  }
  heli.rotor += dt * 22;

  // Wanted decay: unseen for long enough, lose a star.
  const nearest = alive.length ? Math.min(...alive.map((c) => Math.hypot(c.x - px, c.z - pz))) : Infinity;
  const seen = nearest < WANTED.sight;
  if (!seen) {
    police.cleanTimer += dt;
    if (police.cleanTimer > WANTED.decaySeconds) {
      dropWanted(state, 1);
      police.cleanTimer = 0;
      state.radioLine = 'Dispatch: lost visual. Standing down one star.';
    }
  } else {
    police.cleanTimer = 0;
  }
  police.seen = seen;
}

/** The police response panel: who is chasing, how far, what they are doing. */
export function responseList(state) {
  const out = [];
  const px = state.player.x, pz = state.player.z;
  const alive = state.cars.filter((c) => c.kind === 'police' && !c.roadblock);
  const names = ['IBIS', 'TARPON', 'HERON', 'KESTREL', 'MARLIN', 'GULL', 'OSPREY', 'FALCON'];
  alive.slice(0, 5).forEach((car, i) => {
    const d = Math.round(Math.hypot(car.x - px, car.z - pz));
    const doing = d < 12 ? 'RAMMING' : d < 40 ? 'PURSUIT' : 'RESPONDING';
    out.push({ name: `${names[i % names.length]}-${11 + i * 7}`, dist: d, doing });
  });
  if (state.police.heli.active) {
    out.unshift({ name: 'AIR-1', dist: Math.round(Math.hypot(state.police.heli.x - px, state.police.heli.z - pz)), doing: 'SEARCHLIGHT' });
  }
  const offNames = ['REYES', 'KOVA', 'DUNN', 'SOL'];
  state.police.officers.forEach((off, i) => {
    const d = Math.round(Math.hypot(off.x - px, off.z - pz));
    out.push({ name: `OFC ${offNames[i % offNames.length]}`, dist: d, doing: d < 4 ? 'CUFFING' : 'ON FOOT' });
  });
  return out;
}

/** Radio dispatch lines by wanted level (the PD talking about you). */
export function dispatchLine(state) {
  const w = state.wanted;
  if (w <= 0) {
    return 'Coast Radio: smooth traffic on the Strip tonight.';
  }
  const lines = {
    1: 'Dispatch: one star, keep an eye out near Neon Row.',
    2: 'Dispatch: two stars, units moving to intercept.',
    3: 'Dispatch: three stars, roadblocks up — box that car in, all units.',
    4: 'Dispatch: four stars, all units converge. This one does not get away.',
    5: 'Dispatch: FIVE STARS. Air-1 overhead. Nobody lets this one go.',
  };
  return lines[w] ?? lines[1];
}
