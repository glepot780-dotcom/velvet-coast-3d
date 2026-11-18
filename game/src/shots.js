// The four screenshot scenes behind ?shot=menu|chase|weapons|map. Each one sets
// the real world to a fixed, seeded state and (where it helps) plays it forward
// a fixed number of steps with a fixed autopilot, so the frame is what a short
// game really looks like and the same seed always gives the same frame.
// Alif's directions for these shots:
//  1 menu    — the MAIN MENU: the character in front of the car, a helicopter
//              in the sky, sunset, city behind. NO airplane in this shot.
//  2 chase   — MISSION FAILED on the main road: Jax on foot in the middle
//              of the NEON AVE x TIDE ST intersection, boxed in by five
//              police cars on the asphalt and four officers closing in,
//              helicopter overhead, five stars, MISSION FAILED banner.
//              On the road, NOT on the beach. (Alif's directions.)
//  3 weapons — the moment of switching weapons: the weapon wheel OPEN, slots
//              visible, one highlighted.
//  4 map     — the full city map screen.
import { STEP } from './config.js';
import { resetWorld, setTitleCamera } from './world.js';
import { addHeat } from './police.js';
import { startMission } from './missions.js';
import { makeCar } from './traffic.js';

function settle(state, seconds, input) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    state.screen = 'play';
    // stepWorld is imported lazily to avoid a cycle (world imports missions).
    state.__step(state, input, STEP);
  }
}

/**
 * Set `state` to the named scene and return the screen to draw.
 * `stepWorld` is passed in by main.js (world.js imports this module's friends,
 * so the step function comes as a parameter, not an import).
 */
export function stageShot(name, state, stepWorld) {
  resetWorld(state);
  state.__step = stepWorld;
  state.time = 12; // dusk light, water mid-wave
  state.money = 48250;
  state.respect = 4;

  if (name === 'chase') {
    // MISSION FAILED on the main road (Alif: "dijalan raya ya mo jangan di
    // pantai", "mission failed dikepung polisi", "kasih mobil polisinya
    // juga"). Jax on foot in the middle of the NEON AVE x TIDE ST
    // intersection, boxed in by five VCPD interceptors on the asphalt and
    // four officers closing in on foot, helicopter overhead, five stars,
    // MISSION FAILED banner from the HUD (state.failedBanner). Nothing is
    // settled forward: the shot paints the staged state exactly, so every
    // position here is final. Every car sits on the road, never inside a
    // building block; the south side stays open for the camera.
    startMission(state, 5); // HEAT WAVE: four stars, helicopter, escape
    state.missions.banner = null;
    state.dialogue = null;
    addHeat(state, 1); // five stars in all
    // Jax on foot in the middle of the intersection, facing the camera.
    state.player.x = 40; state.player.z = 0; state.player.angle = Math.PI / 2;
    state.player.onFoot = true; state.player.car = null; state.player.speed = 0;
    // Five interceptors boxed in around him, all on the asphalt, facing in:
    // three blocking Neon Ave ahead of him, one each side on Tide St —
    // pulled in to ~34° off the camera axis so they read in frame, not as
    // slivers at the edges.
    const ring = [
      [40, -13, Math.PI / 2], [40, -26, Math.PI / 2], [40, -38, Math.PI / 2],
      [30, -4, 0], [50, -4, Math.PI],
    ];
    for (const [x, z, angle] of ring) {
      const pc = makeCar('police', { key: 'interceptor', name: 'VCPD INTERCEPTOR', color: '#e8e8e8', top: 44 }, x, z, angle);
      pc.speed = 0;
      state.cars.push(pc);
      state.police.cars.push(pc.id);
    }
    // Four officers on foot, closing in from every side of the intersection.
    const officers = [
      [36, 4, -Math.PI / 4], [44, 4, -3 * Math.PI / 4],
      [36, -4, Math.PI / 4], [44, -4, 3 * Math.PI / 4],
    ];
    for (const [x, z, angle] of officers) {
      state.police.officers.push({ x, z, angle, bust: 0 });
    }
    // The helicopter overhead, directly above the road ahead so it stays
    // inside the frame (high and off-axis puts it above the top edge) and
    // clear of every building.
    state.police.heli.active = true;
    state.police.heli.x = 40; state.police.heli.y = 20; state.police.heli.z = -45;
    state.police.heli.angle = Math.PI * 0.75;
    state.radioLine = 'Dispatch: FIVE STARS. Air-1 overhead. Nobody lets this one go.';
    state.failedBanner = { title: 'MISSION FAILED', sub: 'Boxed in on Neon Ave. The VCPD has you now.' };
    // Camera just outside the ring on the south side, low and close, looking
    // north up Neon Ave: Jax centre-frame below the banner, the ring around
    // him, the road and the buildings running away behind.
    state.camera.x = 40; state.camera.y = 4.2; state.camera.z = 11;
    state.camera.lx = 40; state.camera.ly = 1.0; state.camera.lz = -4;
    state.screen = 'play';
    return 'play';
  }

  if (name === 'weapons') {
    // Mission 4, PAPER TRAIL: on foot in Neon Row, wheel open on the SMG.
    startMission(state, 3);
    state.missions.banner = null;
    state.player.x = 0; state.player.z = 20;
    state.player.angle = Math.PI / 4;
    state.player.aimX = 16; state.player.aimZ = 8;
    state.player.weapon = 2;
    state.player.ammo = [Infinity, 12, 32, 6];
    state.player.reserve = [Infinity, 48, 128, 18];
    addHeat(state, 2);
    const pc = makeCar('police', { key: 'interceptor', name: 'VCPD INTERCEPTOR', color: '#e8e8e8', top: 44 }, 16, 8, Math.PI * 0.75);
    pc.speed = 12;
    state.cars.push(pc);
    state.police.cars.push(pc.id);
    state.dialogue = { who: 'priya', text: 'Three ledgers in Old Town. The men guarding them are not friendly.', until: 999 };
    state.radioLine = 'Dispatch: two stars, units moving to intercept.';
    settle(state, 1.5, { moveX: 0, moveY: 0, sprint: false, handbrake: false, mouseActive: true, shoot: false, enter: false });
    state.wheelOpen = true;
    state.wheelSelected = 2;
    state.screen = 'play';
    return 'play';
  }

  if (name === 'map') {
    // Mission 5, RUNWAY LIGHTS: the full city map over a live game.
    startMission(state, 4);
    state.missions.banner = null;
    state.dialogue = null;
    const car = state.starterCar;
    car.kind = 'player';
    car.x = 120; car.z = 40; car.angle = 0; car.speed = 0;
    state.player.car = car;
    state.player.onFoot = false;
    state.player.x = car.x; state.player.z = car.z; state.player.angle = car.angle;
    addHeat(state, 2);
    state.screen = 'map';
    return 'map';
  }

  // Default: the menu / cover.
  state.screen = 'title';
  state.missions.banner = null;
  state.dialogue = null;
  state.hideFlyingPlane = true;
  state.planeParked.y = -60; // the airfield plane is out of this shot
  // The Coral GT on the beach road, Jax standing in front of it, facing the camera.
  const car = state.starterCar;
  car.x = -214; car.z = 24; car.angle = 0; car.speed = 0;
  state.player.x = -208; state.player.z = 28;
  state.player.angle = 2.09; // facing the camera (south-west)
  state.player.onFoot = true;
  state.player.car = null;
  // The police helicopter in the sky above the street, low enough to read
  // against the orange dusk band (not lost in the dark upper sky).
  state.police.heli.active = true;
  state.police.heli.x = -200; state.police.heli.z = 8; state.police.heli.y = 8;
  state.police.heli.angle = Math.PI;
  // A couple of cars and pedestrians for life.
  const taxi = makeCar('traffic', { key: 'sunset-taxi', name: 'SUNSET TAXI', color: '#f5a623', top: 36 }, -200, 8, -Math.PI / 2);
  taxi.speed = 10;
  state.cars.push(taxi);
  // The look target sits a little high (ly 3.4): with the corrected lookAt the
  // scene otherwise frames ~110 px higher than the shot this cover was tuned
  // for, and the car would sit behind the menu text.
  setTitleCamera(state, -208, 2.6, 36, -208, 3.4, 26);
  state.time = 12;
  return 'title';
}
