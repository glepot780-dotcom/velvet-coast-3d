// Meridian Bay: the static island. buildCity lays out the ground, the street grid,
// the buildings (with their collision boxes), the beach, the marina docks and the
// airfield, all as one triangle soup. The sea is sea.js; the city never moves.
import { DISTRICTS, PALETTE, PLACES, STREETS_X, STREETS_Z, STREET_HALF, WORLD } from './config.js';
import { hexToRgb, MeshBuilder, shade } from './mesh.js';
import { int, pick, range } from './random.js';

/** Street blocks: the gaps between neighbouring streets, plus the island edges. */
function blockEdges(streets, min, max) {
  const edges = [min, ...streets, max];
  const out = [];
  for (let i = 0; i < edges.length - 1; i += 1) out.push([edges[i], edges[i + 1]]);
  return out;
}

/** Distance of (x, z) from the city centre, for downtown height. */
function centreDistance(x, z) {
  return Math.hypot(x, z);
}

/**
 * Build the island. Returns:
 *  mesh      — the static triangle soup
 *  buildings — collision boxes {x0, z0, x1, z1, h, name?}
 *  palms     — palm positions (for the minimap/map only; they are in the mesh)
 *  markers   — named places for the map/minimap
 */
export function buildCity(rng) {
  const mesh = new MeshBuilder();
  const buildings = [];
  const palms = [];

  const grass = hexToRgb(PALETTE.grass);
  const asphalt = hexToRgb(PALETTE.asphalt);
  const sidewalk = hexToRgb(PALETTE.sidewalk);
  const sand = hexToRgb(PALETTE.sand);
  const line = hexToRgb(PALETTE.roadLine);

  // The island itself, then sand on the west and south edges.
  mesh.flatQuad(WORLD.minX, WORLD.minZ, WORLD.maxX, WORLD.maxZ, 0, grass);
  mesh.flatQuad(WORLD.minX, WORLD.minZ, WORLD.beachX, WORLD.maxZ, 0.02, sand);
  mesh.flatQuad(WORLD.minX, WORLD.beachZ, WORLD.maxX, WORLD.maxZ, 0.02, sand);

  // Sidewalks (a little wider than the roads) and the roads themselves.
  for (const x of STREETS_X) {
    mesh.flatQuad(x - STREET_HALF - 2.5, WORLD.minZ, x + STREET_HALF + 2.5, WORLD.maxZ, 0.03, sidewalk);
    mesh.flatQuad(x - STREET_HALF, WORLD.minZ, x + STREET_HALF, WORLD.maxZ, 0.05, asphalt);
  }
  for (const z of STREETS_Z) {
    mesh.flatQuad(WORLD.minX, z - STREET_HALF - 2.5, WORLD.maxX, z + STREET_HALF + 2.5, 0.03, sidewalk);
    mesh.flatQuad(WORLD.minX, z - STREET_HALF, WORLD.maxX, z + STREET_HALF, 0.05, asphalt);
  }
  // Dashed centre lines along every street.
  for (const x of STREETS_X) {
    for (let z = WORLD.minZ + 6; z < WORLD.maxZ - 6; z += 14) {
      mesh.flatQuad(x - 0.35, z, x + 0.35, z + 6, 0.07, line);
    }
  }
  for (const z of STREETS_Z) {
    for (let x = WORLD.minX + 6; x < WORLD.maxX - 6; x += 14) {
      mesh.flatQuad(x, z - 0.35, x + 6, z + 0.35, 0.07, line);
    }
  }

  // Crosswalks at the main downtown junction.
  for (const dx of [-5.5, -2, 1.5, 5]) {
    mesh.flatQuad(-40 + dx, -7, -40 + dx + 2.2, 7, 0.07, hexToRgb('#e8e8e8'));
  }

  // Buildings, one or two per block. The east strip is the airfield, the west
  // strip is the beach: no buildings there.
  const xBlocks = blockEdges(STREETS_X, WORLD.minX + 5, WORLD.maxX - 5);
  const zBlocks = blockEdges(STREETS_Z, WORLD.minZ + 5, WORLD.maxZ - 5);
  const buildingCols = PALETTE.building.map(hexToRgb);
  const roofCols = PALETTE.roof.map(hexToRgb);
  const litWin = hexToRgb(PALETTE.windowLit);
  const darkWin = hexToRgb(PALETTE.windowDark);
  // Points no random building may cover (3 m of margin): every named place,
  // the mission-4 ledger pickups and the bank's front columns.
  const KEEP_CLEAR = [
    ...Object.values(PLACES).map((p) => [p.x, p.z]),
    [-80, 120], [-20, 170], [-120, 100], // mission 4 ledgers
    [71, -29], [77, -29], [83, -29], [89, -29], // bank columns
  ];
  for (const [bx0, bx1] of xBlocks) {
    if (bx1 <= -195 || bx0 > 178) continue; // the beach strip and the airfield
    for (const [bz0, bz1] of zBlocks) {
      const bw = bx1 - bx0, bd = bz1 - bz0;
      if (bw < 18 || bd < 18) continue;
      const count = rng() < 0.45 ? 2 : 1;
      for (let k = 0; k < count; k += 1) {
        const w = range(rng, Math.min(18, bw * 0.55), Math.min(34, bw * 0.8));
        const d = range(rng, Math.min(16, bd * 0.55), Math.min(30, bd * 0.8));
        // Keep the whole footprint inside its block, clear of the streets.
        let cx = bx0 + (k === 0 ? bw * 0.3 : bw * 0.72) + range(rng, -2, 2);
        let cz = bz0 + bd / 2 + range(rng, -3, 3);
        cx = Math.max(bx0 + w / 2 + 2, Math.min(bx1 - w / 2 - 2, cx));
        cz = Math.max(bz0 + d / 2 + 2, Math.min(bz1 - d / 2 - 2, cz));
        // KEEP_CLEAR: skip any footprint that would cover a named place,
        // a ledger pickup or a bank column (each with 3 m of margin).
        const kx0 = cx - w / 2 - 3, kx1 = cx + w / 2 + 3;
        const kz0 = cz - d / 2 - 3, kz1 = cz + d / 2 + 3;
        if (KEEP_CLEAR.some(([px, pz]) => px > kx0 && px < kx1 && pz > kz0 && pz < kz1)) continue;
        const downtown = 1 - Math.min(1, centreDistance(cx, cz) / 320);
        const h = range(rng, 8, 12) + downtown * range(rng, 6, 34);
        const col = pick(rng, buildingCols);
        const roof = pick(rng, roofCols);
        // Darker ground-floor base and a parapet rim, so the block reads as
        // a built thing rather than a plain box.
        mesh.box(cx, 1.2, cz, w + 0.8, 2.4, d + 0.8, shade(col, 0.55), shade(col, 0.5));
        mesh.box(cx, h / 2, cz, w, h, d, col, roof);
        mesh.box(cx, h + 0.25, cz, w + 0.5, 0.5, d + 0.5, roof, roof);
        buildings.push({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2, h });
        // Lit windows on ALL FOUR faces, denser downtown.
        const floors = Math.max(1, Math.floor(h / 4));
        const perFloor = downtown > 0.5 ? 3 : 2;
        const faces = [
          { ax: 'x', at: cz + d / 2 + 0.06, n: [0, 0, 1], c: cx, s: w },
          { ax: 'x', at: cz - d / 2 - 0.06, n: [0, 0, -1], c: cx, s: w },
          { ax: 'z', at: cx + w / 2 + 0.06, n: [1, 0, 0], c: cz, s: d },
          { ax: 'z', at: cx - w / 2 - 0.06, n: [-1, 0, 0], c: cz, s: d },
        ];
        for (const fc of faces) {
          for (let f = 0; f < floors; f += 1) {
            const y = 2.2 + f * 3.6;
            if (y > h - 1.5) break;
            for (let s2 = 0; s2 < perFloor; s2 += 1) {
              const a = fc.c - fc.s / 2 + ((s2 + 1) / (perFloor + 1)) * fc.s;
              const lit = rng() < 0.55;
              const wc = lit ? litWin : darkWin;
              if (fc.ax === 'x') {
                mesh.quad([a - 0.9, y, fc.at], [a + 0.9, y, fc.at], [a + 0.9, y + 1.5, fc.at], [a - 0.9, y + 1.5, fc.at], fc.n[0], fc.n[1], fc.n[2], wc, lit ? 2 : 0);
              } else {
                mesh.quad([fc.at, y, a - 0.9], [fc.at, y, a + 0.9], [fc.at, y + 1.5, a + 0.9], [fc.at, y + 1.5, a - 0.9], fc.n[0], fc.n[1], fc.n[2], wc, lit ? 2 : 0);
              }
            }
          }
        }
        // Vertical accent stripes on the front face.
        for (const off of [-w / 3, w / 3]) {
          mesh.quad([cx + off - 0.4, 0.1, cz + d / 2 + 0.07], [cx + off + 0.4, 0.1, cz + d / 2 + 0.07],
            [cx + off + 0.4, h - 0.5, cz + d / 2 + 0.07], [cx + off - 0.4, h - 0.5, cz + d / 2 + 0.07],
            0, 0, 1, shade(col, 1.3), 0);
        }
        // Stepped crown on towers, antenna + red beacon on the tallest.
        if (h > 26) mesh.box(cx, h + 1.2, cz, w * 0.6, 2.4, d * 0.6, shade(col, 0.9), roof);
        if (h > 30) {
          mesh.prism(cx, h + 2.4, cz, 0.15, 5, 4, hexToRgb('#2a2f3a'));
          mesh.box(cx, h + 7.6, cz, 0.8, 0.8, 0.8, hexToRgb('#ff2d2d'), hexToRgb('#ff2d2d'), 2);
        }
        // Rooftop boxes (AC units) on some buildings.
        if (rng() < 0.4) {
          mesh.box(cx + range(rng, -w / 4, w / 4), h + 0.8, cz + range(rng, -d / 4, d / 4),
            range(rng, 3, 6), 1.6, range(rng, 3, 5), shade(col, 0.7), shade(col, 0.6));
        }
        if (rng() < 0.3) {
          mesh.box(cx + range(rng, -w / 4, w / 4), h + 0.5, cz + range(rng, -d / 4, d / 4),
            range(rng, 2, 3.5), 1, range(rng, 2, 3), shade(col, 0.6), shade(col, 0.55));
        }
      }
    }
  }

  // Landmark buildings (named, with a glow sign quad).
  function landmark(x, z, w, h, d, colorHex, signHex, name) {
    const col = hexToRgb(colorHex);
    mesh.box(x, h / 2, z, w, h, d, col, shade(col, 0.7));
    if (signHex) {
      const sign = hexToRgb(signHex);
      mesh.quad([x - w / 4, h - 3.4, z + d / 2 + 0.08], [x + w / 4, h - 3.4, z + d / 2 + 0.08],
        [x + w / 4, h - 1.2, z + d / 2 + 0.08], [x - w / 4, h - 1.2, z + d / 2 + 0.08],
        0, 0, 1, sign, 2);
    }
    buildings.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2, h, name });
  }
  landmark(PLACES.casino.x, PLACES.casino.z, 34, 22, 26, '#8a6a2f', '#ffd27a', 'The Azure Tide Casino');
  landmark(PLACES.garage.x, PLACES.garage.z, 26, 10, 20, '#3f5a6e', '#ff5fa2', "Ivy's Garage");
  landmark(PLACES.hospital.x, PLACES.hospital.z, 24, 16, 18, '#d8dde2', '#7ee2a8', 'Meridian General');
  landmark(PLACES.safehouse.x, PLACES.safehouse.z, 14, 7, 12, '#6a7d5e', null, 'Safehouse');
  // Meridian Bay Bank: cream stone, gold sign, columns and a pediment.
  landmark(PLACES.bank.x, PLACES.bank.z, 26, 12, 20, '#e8dcc0', '#f2c94c', 'Meridian Bay Bank');
  const bankCol = hexToRgb('#f2ead2');
  for (const ox of [-9, -3, 3, 9]) {
    mesh.box(PLACES.bank.x + ox, 5, PLACES.bank.z + 11.2, 1.1, 10, 1.1, bankCol, bankCol);
  }
  mesh.box(PLACES.bank.x, 11.2, PLACES.bank.z + 11.2, 26, 1.6, 2.4, bankCol, bankCol); // entablature
  {
    const bx = PLACES.bank.x, bz = PLACES.bank.z + 11.3;
    const cream = hexToRgb('#efe6cc');
    const i0 = mesh.vertex(bx - 13, 12, bz, 0, 0, 1, cream, 0);
    const i1 = mesh.vertex(bx + 13, 12, bz, 0, 0, 1, cream, 0);
    const i2 = mesh.vertex(bx, 16, bz, 0, 0, 1, cream, 0);
    mesh.tri(i0, i1, i2); // pediment
  }
  // Hospital: a glowing red cross on the roof and on the front wall.
  const cross = hexToRgb('#ff2d2d');
  mesh.box(PLACES.hospital.x, 16.3, PLACES.hospital.z, 8, 0.5, 2.4, cross, cross, 2);
  mesh.box(PLACES.hospital.x, 16.3, PLACES.hospital.z, 2.4, 0.5, 8, cross, cross, 2);
  mesh.quad([PLACES.hospital.x - 1.2, 8, PLACES.hospital.z + 9.08], [PLACES.hospital.x + 1.2, 8, PLACES.hospital.z + 9.08],
    [PLACES.hospital.x + 1.2, 14, PLACES.hospital.z + 9.08], [PLACES.hospital.x - 1.2, 14, PLACES.hospital.z + 9.08], 0, 0, 1, cross, 2);
  mesh.quad([PLACES.hospital.x - 3, 10, PLACES.hospital.z + 9.08], [PLACES.hospital.x + 3, 10, PLACES.hospital.z + 9.08],
    [PLACES.hospital.x + 3, 12.4, PLACES.hospital.z + 9.08], [PLACES.hospital.x - 3, 12.4, PLACES.hospital.z + 9.08], 0, 0, 1, cross, 2);
  // VCPD Headquarters: dark blue, blue sign, a roof beacon.
  landmark(PLACES.policeHQ.x, PLACES.policeHQ.z, 28, 18, 22, '#1e3a6e', '#3b82f6', 'VCPD Headquarters');
  mesh.box(PLACES.policeHQ.x, 19, PLACES.policeHQ.z, 1.4, 1.4, 1.4, hexToRgb('#3b82f6'), hexToRgb('#3b82f6'), 2);
  mesh.prism(PLACES.policeHQ.x, 19.6, PLACES.policeHQ.z, 0.15, 4, 4, hexToRgb('#2a2f3a'));

  // The airfield: runway, taxiway, hangar, control tower.
  const runway = hexToRgb('#2c2f36');
  mesh.flatQuad(212, -90, 238, 90, 0.05, runway);
  for (let z = -84; z < 84; z += 12) {
    mesh.flatQuad(223.5, z, 226.5, z + 6, 0.07, hexToRgb('#f2f2f2'));
  }
  mesh.flatQuad(238, -90, 246, 90, 0.04, asphalt); // taxiway
  mesh.box(252, 7, -60, 18, 14, 26, hexToRgb('#5a6270'), hexToRgb('#39404d')); // hangar
  buildings.push({ x0: 243, z0: -73, x1: 261, z1: -47, h: 14, name: 'Hangar 1' });
  mesh.box(252, 16, 62, 6, 32, 6, hexToRgb('#c8ccd2'), hexToRgb('#8a8f98')); // tower
  mesh.box(252, 33, 62, 10, 3, 10, hexToRgb('#3f6d8e'), hexToRgb('#2c4d66'));
  buildings.push({ x0: 249, z0: 59, x1: 255, z1: 65, h: 34, name: 'Tower' });

  // The marina: three wooden piers reaching west into the ocean, with posts.
  const wood = hexToRgb('#7a5c38');
  for (const pz of [118, 140, 162]) {
    mesh.flatQuad(-286, pz - 2.5, -258, pz + 2.5, 0.4, wood);
    for (let x = -284; x < -260; x += 8) {
      mesh.prism(x, 0, pz - 2.5, 0.5, 1.2, 5, shade(wood, 0.7));
      mesh.prism(x, 0, pz + 2.5, 0.5, 1.2, 5, shade(wood, 0.7));
    }
  }

  // Palm trees along the beach and a few downtown.
  const trunk = hexToRgb(PALETTE.palmTrunk);
  const leaf = hexToRgb(PALETTE.palmLeaf);
  function palm(x, z) {
    const h = range(rng, 7, 10);
    mesh.prism(x, 0, z, 0.35, h, 6, trunk);
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2 + rng() * 0.5;
      const lx = x + Math.cos(a) * 2.2;
      const lz = z + Math.sin(a) * 2.2;
      mesh.rotatedBox(lx, h + 0.4, lz, 4.6, 0.25, 1.4, -a, leaf);
    }
    palms.push({ x, z });
  }
  for (let z = -190; z <= 190; z += int(rng, 16, 22)) palm(-238 + range(rng, -4, 4), z);
  for (let z = 180; z <= 205; z += 20) palm(range(rng, -180, 140), z + range(rng, -3, 3));
  for (let i = 0; i < 8; i += 1) palm(range(rng, -180, 160), pick(rng, [-150, -70, 10, 90, 150]) + range(rng, -4, 4));

  // Street lamps along the main streets, lit at dusk.
  const lampCol = hexToRgb('#3a3f47');
  const lampGlow = hexToRgb('#ffe9a8');
  for (const x of [-120, 40, 120]) {
    for (let z = -180; z <= 180; z += 40) {
      mesh.prism(x + 8.5, 0, z, 0.18, 6, 5, lampCol);
      mesh.box(x + 8.5, 6.2, z, 1.6, 0.5, 0.5, lampGlow, lampGlow, 2);
    }
  }

  // A small park in Crestview: grass circle is a flat quad, plus benches.
  mesh.flatQuad(-80, -190, -10, -140, 0.02, hexToRgb('#557a45'));
  for (let i = 0; i < 4; i += 1) {
    mesh.box(-70 + i * 16, 0.5, -165, 4, 1, 1.2, hexToRgb('#7a5c38'));
  }

  const markers = Object.entries(PLACES).map(([key, p]) => ({ key, ...p }));
  return { mesh, buildings, palms, markers, districts: DISTRICTS };
}
