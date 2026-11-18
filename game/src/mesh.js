// MeshBuilder: one triangle soup with per-vertex position, normal, colour and a
// flag (0 = lit, 1 = water, 2 = emissive / unlit). Boxes, quads and prisms are
// appended in world space; the renderer draws the whole thing in one call.
// Colours are [r, g, b] floats in 0..1 (hexToRgb converts '#rrggbb').

export function hexToRgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function shade(rgb, f) {
  return [rgb[0] * f, rgb[1] * f, rgb[2] * f];
}

export class MeshBuilder {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.flg = [];
    this.idx = [];
  }

  get count() {
    return this.idx.length;
  }

  get triangles() {
    return this.idx.length / 3;
  }

  /** Push one vertex, return its index. */
  vertex(x, y, z, nx, ny, nz, rgb, flag) {
    this.pos.push(x, y, z);
    this.nor.push(nx, ny, nz);
    this.col.push(rgb[0], rgb[1], rgb[2]);
    this.flg.push(flag);
    return this.pos.length / 3 - 1;
  }

  /** One triangle from three already-built vertices. */
  tri(a, b, c) {
    this.idx.push(a, b, c);
  }

  /** A quad from four corners (a, b, c, d) with one normal. */
  quad(a, b, c, d, nx, ny, nz, rgb, flag = 0) {
    const i0 = this.vertex(a[0], a[1], a[2], nx, ny, nz, rgb, flag);
    const i1 = this.vertex(b[0], b[1], b[2], nx, ny, nz, rgb, flag);
    const i2 = this.vertex(c[0], c[1], c[2], nx, ny, nz, rgb, flag);
    const i3 = this.vertex(d[0], d[1], d[2], nx, ny, nz, rgb, flag);
    this.idx.push(i0, i1, i2, i0, i2, i3);
  }

  /** A horizontal quad at height y (normal +y). Corners in x/z order. */
  flatQuad(x0, z0, x1, z1, y, rgb, flag = 0) {
    this.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], 0, 1, 0, rgb, flag);
  }

  /** A vertical quad facing +z or -z (a wall segment). */
  wall(x0, x1, y0, y1, z, facing, rgb, flag = 0) {
    const nz = facing > 0 ? 1 : -1;
    if (facing > 0) this.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], 0, 0, nz, rgb, flag);
    else this.quad([x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z], 0, 0, nz, rgb, flag);
  }

  /** A vertical quad facing +x or -x. */
  wallX(z0, z1, y0, y1, x, facing, rgb, flag = 0) {
    const nx = facing > 0 ? 1 : -1;
    if (facing > 0) this.quad([x, y0, z1], [x, y0, z0], [x, y1, z0], [x, y1, z1], nx, 0, 0, rgb, flag);
    else this.quad([x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0], nx, 0, 0, rgb, flag);
  }

  /**
   * An axis-aligned box centred at (cx, cy, cz) with size (sx, sy, sz).
   * `top` colours the roof differently; `flag` marks every face.
   */
  box(cx, cy, cz, sx, sy, sz, rgb, top = null, flag = 0) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2;
    const y0 = cy - sy / 2, y1 = cy + sy / 2;
    const z0 = cz - sz / 2, z1 = cz + sz / 2;
    const roof = top ?? rgb;
    this.flatQuad(x0, z0, x1, z1, y1, roof, flag); // top
    this.flatQuad(x0, z0, x1, z1, y0, shade(rgb, 0.55), flag); // bottom (rarely seen)
    this.wall(x0, x1, y0, y1, z1, 1, rgb, flag);
    this.wall(x0, x1, y0, y1, z0, -1, shade(rgb, 0.85), flag);
    this.wallX(z0, z1, y0, y1, x1, 1, shade(rgb, 0.92), flag);
    this.wallX(z0, z1, y0, y1, x0, -1, shade(rgb, 0.78), flag);
  }

  /**
   * A box rotated around the Y axis by `angle` (radians), centred at (cx, cy, cz).
   * Used for cars, people, boats and planes. Normals are rotated too.
   */
  rotatedBox(cx, cy, cz, sx, sy, sz, angle, rgb, top = null, flag = 0) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const rot = (x, z) => [cx + x * c - z * s, cz + x * s + z * c];
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const y0 = cy - hy, y1 = cy + hy;
    const roof = top ?? rgb;
    // Top and bottom (rotated corners, normal stays +y / -y).
    const t = [rot(-hx, -hz), rot(hx, -hz), rot(hx, hz), rot(-hx, hz)];
    this.quad([t[0][0], y1, t[0][1]], [t[1][0], y1, t[1][1]], [t[2][0], y1, t[2][1]], [t[3][0], y1, t[3][1]], 0, 1, 0, roof, flag);
    this.quad([t[3][0], y0, t[3][1]], [t[2][0], y0, t[2][1]], [t[1][0], y0, t[1][1]], [t[0][0], y0, t[0][1]], 0, -1, 0, shade(rgb, 0.55), flag);
    // Four sides, each with a rotated normal.
    const sides = [
      { corners: [[-hx, -hz], [hx, -hz]], n: [0, 0, -1], col: shade(rgb, 0.85) },
      { corners: [[hx, -hz], [hx, hz]], n: [1, 0, 0], col: shade(rgb, 0.92) },
      { corners: [[hx, hz], [-hx, hz]], n: [0, 0, 1], col: rgb },
      { corners: [[-hx, hz], [-hx, -hz]], n: [-1, 0, 0], col: shade(rgb, 0.78) },
    ];
    for (const side of sides) {
      const [ax, az] = side.corners[0];
      const [bx, bz] = side.corners[1];
      const [pax, paz] = rot(ax, az);
      const [pbx, pbz] = rot(bx, bz);
      const nx = side.n[0] * c - side.n[2] * s;
      const nz = side.n[0] * s + side.n[2] * c;
      this.quad([pax, y0, paz], [pbx, y0, pbz], [pbx, y1, pbz], [pax, y1, paz], nx, 0, nz, side.col, flag);
    }
  }

  /** A vertical prism (cylinder with `sides` sides), for trunks, poles, wheels. */
  prism(cx, y0, cz, radius, height, sides, rgb, flag = 0) {
    const top = [];
    const bottom = [];
    for (let i = 0; i < sides; i += 1) {
      const a = (i / sides) * Math.PI * 2;
      const x = cx + Math.cos(a) * radius;
      const z = cz + Math.sin(a) * radius;
      top.push([x, y0 + height, z]);
      bottom.push([x, y0, z]);
    }
    for (let i = 0; i < sides; i += 1) {
      const j = (i + 1) % sides;
      const nx = Math.cos(((i + 0.5) / sides) * Math.PI * 2);
      const nz = Math.sin(((i + 0.5) / sides) * Math.PI * 2);
      this.quad(bottom[i], bottom[j], top[j], top[i], nx, 0, nz, rgb, flag);
    }
    // Cap.
    const tc = this.vertex(cx, y0 + height, cz, 0, 1, 0, rgb, flag);
    for (let i = 0; i < sides; i += 1) {
      const j = (i + 1) % sides;
      const a = this.vertex(top[i][0], top[i][1], top[i][2], 0, 1, 0, rgb, flag);
      const b = this.vertex(top[j][0], top[j][1], top[j][2], 0, 1, 0, rgb, flag);
      this.idx.push(tc, a, b);
    }
  }

  /** Append another builder's triangles (already in world space). */
  append(other) {
    const base = this.pos.length / 3;
    this.pos.push(...other.pos);
    this.nor.push(...other.nor);
    this.col.push(...other.col);
    this.flg.push(...other.flg);
    for (const i of other.idx) this.idx.push(i + base);
  }

  /** Typed arrays for the GPU. */
  toArrays() {
    return {
      position: new Float32Array(this.pos),
      normal: new Float32Array(this.nor),
      color: new Float32Array(this.col),
      flag: new Float32Array(this.flg),
      index: new Uint32Array(this.idx),
    };
  }
}
