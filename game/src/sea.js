// The sea, the sky's traffic and every moving thing's shape. The water is one big
// segmented plane (flag 1: the shader waves it); boats, the airplane, the police
// helicopter, cars and people are low-poly boxes appended to the dynamic mesh
// each frame by the renderer. Nothing here loads a file.
import { PALETTE, WORLD } from './config.js';
import { hexToRgb, MeshBuilder, shade } from './mesh.js';

/** The ocean: a segmented plane so the vertex shader can wave it. */
export function buildWaterMesh() {
  const mesh = new MeshBuilder();
  const deep = hexToRgb(PALETTE.waterDeep);
  const edge = hexToRgb(PALETTE.water);
  const size = 1000;
  const seg = 40;
  const step = (size * 2) / seg;
  for (let i = 0; i < seg; i += 1) {
    for (let j = 0; j < seg; j += 1) {
      const x0 = -size + i * step;
      const x1 = x0 + step;
      const z0 = -size + j * step;
      const z1 = z0 + step;
      // Colour blends from deep blue far out to turquoise near the island.
      const d = Math.max(Math.abs((x0 + x1) / 2), Math.abs((z0 + z1) / 2));
      const t = Math.min(1, Math.max(0, (d - 260) / 500));
      const col = [
        deep[0] + (edge[0] - deep[0]) * (1 - t),
        deep[1] + (edge[1] - deep[1]) * (1 - t),
        deep[2] + (edge[2] - deep[2]) * (1 - t),
      ];
      mesh.flatQuad(x0, z0, x1, z1, WORLD.waterY, col, 1);
    }
  }
  return mesh;
}

/** A boat: hull, cabin, mast and sail. `size` scales it; `y` is its waterline. */
export function boatMesh(b, x, y, z, angle, colorHex, size = 1) {
  const hull = hexToRgb(colorHex);
  const deck = shade(hull, 1.25);
  b.rotatedBox(x, y + 0.7 * size, z, 7 * size, 1.4 * size, 2.6 * size, angle, hull, deck);
  b.rotatedBox(x, y + 1.7 * size, z, 2.6 * size, 1.1 * size, 2.0 * size, angle, hexToRgb('#e8e2d2'), hexToRgb('#f2eee2'));
  b.prism(x, y + 2.2 * size, z, 0.12 * size, 5 * size, 5, hexToRgb('#5a4632'));
  // Sail: a triangle standing off the mast.
  const c = Math.cos(angle), s = Math.sin(angle);
  const fwd = [c, s];
  const top = [x + fwd[0] * 0.0, y + 7 * size, z + fwd[1] * 0.0];
  const back = [x - fwd[0] * 2.6 * size, y + 2.4 * size, z - fwd[1] * 2.6 * size];
  const front = [x + fwd[0] * 2.2 * size, y + 2.4 * size, z + fwd[1] * 2.2 * size];
  const sailCol = hexToRgb('#f2f0e6');
  const i0 = b.vertex(top[0], top[1], top[2], 0, 0, 1, sailCol, 0);
  const i1 = b.vertex(back[0], back[1], back[2], 0, 0, 1, sailCol, 0);
  const i2 = b.vertex(front[0], front[1], front[2], 0, 0, 1, sailCol, 0);
  b.tri(i0, i1, i2);
}

/** A small cargo airplane: fuselage, wings, tail, engines. */
export function planeMesh(b, x, y, z, angle, colorHex) {
  const body = hexToRgb(colorHex);
  const belly = shade(body, 0.7);
  b.rotatedBox(x, y, z, 16, 2.6, 2.6, angle, body, belly);
  b.rotatedBox(x, y + 0.4, z, 3.2, 2.2, 2.2, angle, hexToRgb('#20242c'), hexToRgb('#20242c')); // nose/cockpit
  b.rotatedBox(x, y - 0.2, z, 4.5, 0.5, 13, angle, shade(body, 0.85)); // main wings
  b.rotatedBox(x - 6.5, y + 0.6, z, 2.5, 0.4, 6, angle, shade(body, 0.85)); // tailplane
  b.rotatedBox(x - 7.2, y + 1.4, z, 2.2, 2.4, 0.4, angle, shade(body, 0.9)); // fin
  b.rotatedBox(x + 2, y - 1.2, z + 3.2, 3.4, 1.1, 1.1, angle, hexToRgb('#3a3f47'));
  b.rotatedBox(x + 2, y - 1.2, z - 3.2, 3.4, 1.1, 1.1, angle, hexToRgb('#3a3f47'));
  // Window strip, lit.
  const c = Math.cos(angle), s = Math.sin(angle);
  const win = hexToRgb(PALETTE.windowLit);
  for (const side of [1, -1]) {
    const nx = -s * side, nz = c * side;
    const ox = -nz * 1.35, oz = nx * 1.35;
    b.quad([x + c * 5 + ox, y + 0.7, z + s * 5 + oz], [x - c * 4 + ox, y + 0.7, z - s * 4 + oz],
      [x - c * 4 + ox, y + 1.1, z - s * 4 + oz], [x + c * 5 + ox, y + 1.1, z + s * 5 + oz],
      nx, 0, nz, win, 2);
  }
}

/** A police helicopter: body, tail, skids and a spinning rotor. */
export function heliMesh(b, x, y, z, angle, rotor, colorHex = '#8b98ac') {
  const body = hexToRgb(colorHex);
  b.rotatedBox(x, y, z, 4.6, 2.0, 2.4, angle, body, shade(body, 1.3));
  b.rotatedBox(x - 3.6, y + 0.4, z, 4.4, 0.9, 0.9, angle, shade(body, 0.8));
  b.rotatedBox(x + 1.2, y + 0.3, z, 1.8, 1.1, 2.0, angle, hexToRgb('#9fc6e8'), hexToRgb('#9fc6e8'));
  b.rotatedBox(x, y - 1.3, z - 0.9, 3.4, 0.25, 0.25, angle, hexToRgb('#1d2126'));
  b.rotatedBox(x, y - 1.3, z + 0.9, 3.4, 0.25, 0.25, angle, hexToRgb('#1d2126'));
  // Rotor: two long thin blades, spinning.
  b.rotatedBox(x, y + 1.25, z, 11, 0.12, 0.5, rotor, hexToRgb('#1d2126'));
  b.rotatedBox(x, y + 1.25, z, 0.5, 0.12, 11, rotor, hexToRgb('#1d2126'));
  // Searchlight glow under the nose (emissive).
  const glow = hexToRgb('#fff3c4');
  b.rotatedBox(x + 2.0, y - 1.1, z, 0.5, 0.3, 0.5, angle, glow, glow, 2);
}

/**
 * A low-poly car: body, cabin, wheels, headlights. `opts.police` adds the
 * black-and-white livery, the stripe and the flashing light bar.
 */
export function carMesh(b, car, time) {
  const { x, z, angle, color, model } = car;
  const body = hexToRgb(color);
  const isPolice = !!car.police;
  const main = isPolice ? hexToRgb(PALETTE.police) : body;
  const trim = isPolice ? hexToRgb(PALETTE.policeTrim) : shade(body, 0.6);
  // Body + cabin.
  b.rotatedBox(x, 0.75, z, 4.4, 0.9, 2.0, angle, main, shade(main, 1.15));
  b.rotatedBox(x - 0.2, 1.5, z, 2.4, 0.75, 1.8, angle, hexToRgb('#20242c'), hexToRgb('#2c313a'));
  if (isPolice) {
    b.rotatedBox(x, 0.75, z, 4.45, 0.28, 2.02, angle, trim);
    // Light bar, flashing red/blue.
    const phase = Math.floor(time * 4) % 2 === 0;
    const bar = hexToRgb(phase ? '#ff2d2d' : '#2d5bff');
    b.rotatedBox(x - 0.2, 2.05, z - 0.5, 0.7, 0.25, 0.5, angle, bar, bar, 2);
    b.rotatedBox(x - 0.2, 2.05, z + 0.5, 0.7, 0.25, 0.5, angle, hexToRgb(phase ? '#2d5bff' : '#ff2d2d'), hexToRgb('#ffffff'), 2);
  }
  // Wheels.
  const wheel = hexToRgb('#14161a');
  const c = Math.cos(angle), s = Math.sin(angle);
  for (const [dx, dz] of [[1.5, 1.0], [1.5, -1.0], [-1.5, 1.0], [-1.5, -1.0]]) {
    const wx = x + dx * c - dz * s;
    const wz = z + dx * s + dz * c;
    b.rotatedBox(wx, 0.42, wz, 0.85, 0.84, 0.3, angle, wheel);
  }
  // Headlights (emissive at dusk).
  const hl = hexToRgb('#ffe9a8');
  const fx = x + 2.25 * c, fz = z + 2.25 * s;
  b.rotatedBox(fx, 0.8, fz - 0.7 * s + 0, 0.2, 0.3, 0.5, angle, hl, hl, 2);
  b.rotatedBox(fx, 0.8, fz + 0.7 * s, 0.2, 0.3, 0.5, angle, hl, hl, 2);
  return model;
}

/** A blocky person: legs, torso, arms, head. `walk` swings the legs. */
export function personMesh(b, x, z, angle, colorHex, walk, time) {
  const shirt = hexToRgb(colorHex);
  const skin = hexToRgb('#d9a066');
  const pants = hexToRgb('#2c3240');
  const swing = walk ? Math.sin(time * 9) * 0.5 : 0;
  const c = Math.cos(angle), s = Math.sin(angle);
  // Legs (swing opposite).
  b.rotatedBox(x - 0.28 * c + 0.0, 0.45, z - 0.28 * s, 0.34, 0.9, 0.34, angle + swing * 0.4, pants);
  b.rotatedBox(x + 0.28 * c, 0.45, z + 0.28 * s, 0.34, 0.9, 0.34, angle - swing * 0.4, pants);
  // Torso + arms.
  b.rotatedBox(x, 1.35, z, 0.85, 0.9, 0.5, angle, shirt, shade(shirt, 1.2));
  b.rotatedBox(x - 0.62 * c, 1.35, z - 0.62 * s, 0.3, 0.85, 0.3, angle + swing * 0.3, shirt);
  b.rotatedBox(x + 0.62 * c, 1.35, z + 0.62 * s, 0.3, 0.85, 0.3, angle - swing * 0.3, shirt);
  // Head, hair and eyes (the eyes sit on the facing side).
  b.rotatedBox(x, 2.15, z, 0.55, 0.55, 0.55, angle, skin, shade(skin, 1.1));
  const fx = Math.cos(angle), fz = Math.sin(angle);
  const px = -fz, pz = fx; // perpendicular
  const hair = hexToRgb('#2b2b33');
  b.rotatedBox(x - fx * 0.1, 2.42, z - fz * 0.1, 0.5, 0.18, 0.5, angle, hair, hair);
  const eye = hexToRgb('#14161a');
  for (const side of [-1, 1]) {
    b.rotatedBox(x + fx * 0.29 + px * side * 0.13, 2.2, z + fz * 0.29 + pz * side * 0.13,
      0.1, 0.1, 0.1, angle, eye, eye);
  }
}
