// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, the WebGL renderer paints the 3D scene and the 2D canvas paints
// the HUD over it. The game moves between title, play, paused, map, garage,
// busted and win screens.
//
// ?seed=N fixes the world. ?shot=menu|chase|weapons|map (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { applySave, buyGarageItem, createWorld, loadProgress, resetWorld, saveProgress, stepWorld } from './world.js';
import {
  ACTION_CONFIRM, ACTION_DOWN, ACTION_ENTER, ACTION_GARAGE, ACTION_MAP,
  ACTION_PAUSE, ACTION_RADIO, ACTION_UP, createInput,
} from './input.js';
import { createRenderer } from './render3d.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const glCanvas = document.getElementById('gl');
const hudCanvas = document.getElementById('hud');
const status = document.getElementById('status');
const state = createWorld(seed);
const renderer = createRenderer(glCanvas);
const hud = createHud(hudCanvas);
const input = createInput(hudCanvas);
const audio = createAudio();
const ui = { menuIndex: 0 };
let lastButtons = [];

function announce(message) {
  status.textContent = message;
}

/** The save on this browser, if any. */
function readSave() {
  return loadProgress(state);
}

function toLogical(clientX, clientY) {
  const rect = hudCanvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / rect.width * 1280,
    y: (clientY - rect.top) / rect.height * 720,
  };
}

function hitButton(lx, ly) {
  for (const b of lastButtons) {
    if (lx >= b.x && lx <= b.x + b.w && ly >= b.y && ly <= b.y + b.h) return b.id;
  }
  return null;
}

/** What a click on a HUD button does, by screen. */
function handleButton(id) {
  audio.ensure();
  if (!id) return;
  if (id.startsWith('weapon:')) {
    state.player.weapon = Number(id.split(':')[1]);
    state.wheelSelected = state.player.weapon;
    audio.blip(880);
    return;
  }
  if (id.startsWith('buy:')) {
    state.garageMessage = buyGarageItem(state, id.slice(4));
    audio.blip(660);
    return;
  }
  switch (state.screen) {
    case 'title':
      if (id === 'continue') continueGame();
      else if (id === 'new') newGame();
      else if (id === 'controls') state.message = { text: 'Controls are on the right — WASD drives, mouse aims, Q is weapons.', until: state.time + 4 };
      else if (id === 'settings') state.message = { text: audio.toggleMute() ? 'Sound off.' : 'Sound on.', until: state.time + 2 };
      break;
    case 'paused':
      if (id === 'resume') state.screen = 'play';
      else if (id === 'garage') state.screen = 'garage';
      else if (id === 'map') state.screen = 'map';
      else if (id === 'title') { state.screen = 'title'; }
      break;
    default:
      break;
  }
}

function continueGame() {
  const save = readSave();
  if (save) {
    applySave(state, save);
    announce('Continuing your story.');
  } else {
    newGame();
  }
}

function newGame() {
  resetWorld(state);
  announce('New game. Mission 1: First Wheels.');
}

function runShot(name) {
  const screen = stageShot(name, state, stepWorld);
  state.screen = screen;
  window.__game = { state, stepWorld, resetWorld, saveProgress, loadProgress };
  window.__redraw = () => {
    renderer.draw(state);
    lastButtons = hud.draw(state, ui);
  };
  let painted = 0;
  function paint() {
    renderer.draw(state);
    lastButtons = hud.draw(state, ui);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const save = readSave();
  state.hasSave = !!save;
  if (save) {
    state.saveDay = (save.missionIndex ?? 0) >= 6 ? 3 : ((save.missionIndex ?? 0) >= 3 ? 2 : 1);
    state.saveMoney = save.money ?? 0;
  }
  let accumulator = 0;
  let last = performance.now();
  let pendingShoot = false;
  let pendingEnter = false;

  function frameInput() {
    return {
      moveX: input.moveX(),
      moveY: input.moveY(),
      sprint: input.sprint,
      handbrake: input.handbrake,
      mouseActive: input.mouseActive,
      shoot: false,
      enter: false,
    };
  }

  function handleActions() {
    const actions = input.takeActions();
    const wheelKey = input.weaponKey();
    if (wheelKey > 0) {
      state.player.weapon = wheelKey - 1;
      state.wheelSelected = wheelKey - 1;
    }
    if (state.screen === 'title') {
      if (actions & ACTION_UP) ui.menuIndex = (ui.menuIndex + 3) % 4;
      if (actions & ACTION_DOWN) ui.menuIndex = (ui.menuIndex + 1) % 4;
      if (actions & ACTION_CONFIRM) {
        handleButton(['continue', 'new', 'controls', 'settings'][ui.menuIndex]);
      }
      return;
    }
    if (state.screen === 'play') {
      if (actions & ACTION_PAUSE) { state.screen = 'paused'; announce('Paused.'); }
      else if (actions & ACTION_MAP) { state.screen = 'map'; announce('City map.'); }
      else if (actions & ACTION_RADIO) {
        state.radio.station = (state.radio.station + 1) % 3;
        const st = ['WAVE 88.1 · Neon Drive', 'CORAL 104 · Sunset Synth', 'HARBOR FM · Dock Talk'][state.radio.station];
        state.radioLine = `${st} — now playing.`;
      } else if (actions & ACTION_GARAGE) {
        // The garage door is the forecourt on the street in front of the shop.
        const g = state.city.markers.find((m) => m.key === 'garageDoor');
        if (g && Math.hypot(state.player.x - g.x, state.player.z - g.z) < 12) {
          state.screen = 'garage';
          state.garageMessage = null;
        }
      } else if (actions & ACTION_ENTER) {
        pendingEnter = true;
      }
      return;
    }
    if (state.screen === 'paused') {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) state.screen = 'play';
      else if (actions & ACTION_MAP) state.screen = 'map';
      return;
    }
    if (state.screen === 'map') {
      if (actions & (ACTION_MAP | ACTION_PAUSE | ACTION_CONFIRM)) state.screen = 'play';
      return;
    }
    if (state.screen === 'garage') {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) state.screen = 'play';
      return;
    }
    if (state.screen === 'busted' || state.screen === 'win') {
      if (actions & ACTION_CONFIRM) {
        state.screen = 'play';
        announce('Back on the streets.');
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    audio.ensure();

    // Mouse aim: where on the ground the cursor points.
    if (input.mouseActive) {
      const g = renderer.screenToGround(input.mouseX, input.mouseY);
      if (g) {
        state.player.aimX = g.x;
        state.player.aimZ = g.z;
      }
    }

    // The weapon wheel holds the world still while it is open.
    const wasWheel = state.wheelOpen;
    state.wheelOpen = state.screen === 'play' && input.wheelHeld;
    if (state.wheelOpen && !wasWheel) audio.blip(520);

    // Clicks: HUD buttons first, shooting second.
    if (input.takeClick()) {
      const p = toLogical(input.mouseX, input.mouseY);
      const id = hitButton(p.x, p.y);
      if (id) handleButton(id);
      else if (state.screen === 'play' && !state.wheelOpen) {
        pendingShoot = true;
        audio.gunshot();
      } else if (state.screen === 'play' && state.wheelOpen) {
        // Clicking outside the wheel closes it.
        state.wheelOpen = false;
      }
    }

    handleActions();

    const fi = frameInput();
    fi.shoot = pendingShoot;
    fi.enter = pendingEnter;
    pendingShoot = false;
    pendingEnter = false;
    if (state.screen === 'play' && !state.wheelOpen) {
      accumulator += dt;
      while (accumulator >= STEP) {
        stepWorld(state, fi, STEP);
        accumulator -= STEP;
        fi.shoot = false;
        fi.enter = false;
      }
    } else if (state.screen === 'title') {
      // A slow aerial orbit behind the title menu.
      const t = state.time + dt;
      state.time = t;
      const a = t * 0.04;
      state.camera.x = Math.cos(a) * 190;
      state.camera.y = 58;
      state.camera.z = Math.sin(a) * 190;
      state.camera.lx = 0;
      state.camera.ly = 8;
      state.camera.lz = 0;
      stepWorld(state, fi, dt);
    } else {
      accumulator = 0;
    }

    audio.update(state, dt);
    renderer.draw(state);
    lastButtons = hud.draw(state, ui);
  }

  // Leaving the tab pauses a running game.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === 'play') state.screen = 'paused';
  });

  announce('Azure Tide. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

// For the headless play-test: the state, the input and the world, on demand.
window.__game = { state, input, stepWorld, resetWorld, saveProgress, loadProgress };

if (shot) runShot(shot);
else runGame();
