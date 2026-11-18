// The four screenshot scenes behind ?shot=menu|chase|weapons|map. Each one sets
// the real world to a fixed, seeded state and (where it helps) plays it forward
// a fixed number of steps with a fixed autopilot, so the frame is what a short
// game really looks like and the same seed always gives the same frame.
// Alif's directions for these shots:
//  1 menu    — the MAIN MENU: the character in front of the car, a helicopter
//              in the sky, sunset, city behind. NO airplane in this shot.
//  2 chase   — a police chase on the coast road: sea/beach + boats clearly
//              visible, minimap visible, wanted stars, mission timer.
//  3 weapons — the moment of switching weapons: the weapon wheel OPEN, slots
//              visible, one highlighted.
//  4 map     — the full city map screen.
import { STEP } from './config.js';
import { resetWorld, setTitleCamera } from './world.js';
import { addHeat } from './police.js';
import { startMission } from './missions.js';
import { makeCar } from './traffic.js';

/** The autopilot input for the chase scene: foot down, straight ahead. */
const CHASE_INPUT = {
  moveX: 0, moveY: 1,
  sprint: false, handbrake: false, mouseActive: false,
  shoot: false, enter: false,
};

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
    // Mission 2, COAST RUN: a timed delivery up the coast road, three stars.
    // The run angles north-west along the beach, west of the palm line, so
    // the camera looks up the shoreline: sea + beach on the left, the city
    // set back on the right. Driving straight north put the car beside a
    // 25 m building whose west face (x -192) filled the whole right third;
    // driving on the roadside palm line (x -238) put a palm trunk dead
    // centre. Starting 15 m west of the road keeps the camera clear of
    // both: the palms fall to the right edge and the sea fills the left.
    // The mission starts AFTER the settle, not before: the beach run passes
    // straight through the Lifeguard Hut (-242, 0), the COAST RUN
    // destination, so starting it before the settle completes the job
    // mid-run and the HUD would show the next job instead of MISSION 2/7
    // with its timer. The wanted level comes from addHeat, not the mission.
    const car = state.starterCar;
    car.kind = 'player';
    car.x = -215; car.z = 90; car.angle = -Math.PI / 2 - 0.30; car.speed = 26;
    state.player.car = car;
    state.player.onFoot = false;
    state.player.x = car.x; state.player.z = car.z; state.player.angle = car.angle;
    addHeat(state, 3);
    state.radioLine = 'Dispatch: three stars, roadblocks up — box that car in, all units.';
    // Two pursuit cars ahead on the beach that the player is about to catch.
    const spots = [[-232.8, 32.7, 40], [-238.7, 13.6, 40]];
    for (const [x, z, speed] of spots) {
      const pc = makeCar('police', { key: 'interceptor', name: 'VCPD INTERCEPTOR', color: '#e8e8e8', top: 44 }, x, z, -Math.PI / 2);
      pc.speed = speed;
      state.cars.push(pc);
      state.police.cars.push(pc.id);
    }
    // The helicopter overhead.
    state.police.heli.active = true;
    state.police.heli.x = -196; state.police.heli.z = 30; state.police.heli.y = 46;
    // A big sailboat moored in the open water, ahead-left of the chase, so it
    // reads unmistakably in the frame. The sailing boat used to drift out of
    // frame on its orbit during the settle, so it is moored for this shot.
    const sail = state.boats[4];
    sail.moored = true;
    sail.x = -281; sail.z = -57; sail.y = -0.4; sail.angle = -0.9; sail.size = 1.8;
    // One pursuit car ahead on the beach, in frame, that the player is about
    // to overtake.
    const ahead = makeCar('police', { key: 'interceptor', name: 'VCPD INTERCEPTOR', color: '#e8e8e8', top: 44 }, -256, -44, -Math.PI / 2 - 0.30);
    ahead.speed = 30;
    state.cars.push(ahead);
    state.police.cars.push(ahead.id);
    settle(state, 3, CHASE_INPUT);
    // Frame the helicopter: low and ahead-left over the water so it reads
    // against the sky, not against the buildings.
    state.police.heli.x = -275; state.police.heli.y = 22; state.police.heli.z = -62;
    state.police.heli.angle = Math.PI * 0.75;
    // Pull the chase camera in a little for the shot: the smoothed chase
    // camera trails ~14 m behind a car at full speed, which shrinks the
    // player car to a speck. 11 m keeps the car prominent without putting
    // the lens on the palm line.
    const fx = Math.cos(car.angle), fz = Math.sin(car.angle);
    state.camera.x = car.x - fx * 11;
    state.camera.z = car.z - fz * 11;
    state.camera.y = 2.8;
    state.camera.lx = car.x + fx * 6;
    state.camera.ly = 1.6;
    state.camera.lz = car.z + fz * 6;
    startMission(state, 1);
    state.missions.timer = 64;
    state.missions.banner = null;
    state.dialogue = null;
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
