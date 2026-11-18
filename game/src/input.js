// Keyboard and mouse: held movement keys, edge-triggered actions, mouse aim.
// main.js reads `moveX`/`moveY` every frame and `takeActions()` for one-shot
// actions (pause, map, enter, ...).
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MAP = 4;
export const ACTION_RADIO = 8;
export const ACTION_ENTER = 16;
export const ACTION_GARAGE = 32;
export const ACTION_UP = 64;
export const ACTION_DOWN = 128;

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  Space: 'handbrake',
  KeyQ: 'wheel',
  KeyR: 'radio',
  KeyF: 'enter',
  KeyG: 'garage',
  KeyM: 'map',
  Escape: 'pause', KeyP: 'pause',
  Enter: 'confirm',
  Digit1: 'w1', Digit2: 'w2', Digit3: 'w3', Digit4: 'w4',
};

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0, mouseY = 0, mouseActive = false;
  let clicked = false;

  function onKeyDown(e) {
    const name = KEYMAP[e.code];
    if (!name) return;
    if (['up', 'down', 'left', 'right', 'handbrake', 'sprint', 'wheel'].includes(name)) {
      // Space scrolls the page otherwise; arrows too.
      e.preventDefault();
    }
    if (e.repeat) return;
    held.add(name);
    if (name === 'confirm') actions |= ACTION_CONFIRM;
    else if (name === 'pause') actions |= ACTION_PAUSE;
    else if (name === 'map') actions |= ACTION_MAP;
    else if (name === 'radio') actions |= ACTION_RADIO;
    else if (name === 'enter') actions |= ACTION_ENTER;
    else if (name === 'garage') actions |= ACTION_GARAGE;
    else if (name === 'up') actions |= ACTION_UP;
    else if (name === 'down') actions |= ACTION_DOWN;
  }
  function onKeyUp(e) {
    const name = KEYMAP[e.code];
    if (name) held.delete(name);
  }
  function onMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    mouseActive = true;
  }
  function onMouseDown(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    mouseActive = true;
    clicked = true;
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);

  return {
    /** Forward/back (-1..1) and strafe (-1..1) from the held keys. */
    moveY() {
      return (held.has('up') ? 1 : 0) - (held.has('down') ? 1 : 0);
    },
    moveX() {
      return (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
    },
    get sprint() { return held.has('sprint'); },
    get handbrake() { return held.has('handbrake'); },
    get wheelHeld() { return held.has('wheel'); },
    get mouseX() { return mouseX; },
    get mouseY() { return mouseY; },
    get mouseActive() { return mouseActive; },
    /** The weapon key held this frame (1-4), or 0. */
    weaponKey() {
      if (held.has('w1')) return 1;
      if (held.has('w2')) return 2;
      if (held.has('w3')) return 3;
      if (held.has('w4')) return 4;
      return 0;
    },
    /** True once per click (cleared by takeClick). */
    takeClick() {
      const c = clicked;
      clicked = false;
      return c;
    },
    takeActions() {
      const a = actions;
      actions = 0;
      return a;
    },
  };
}
