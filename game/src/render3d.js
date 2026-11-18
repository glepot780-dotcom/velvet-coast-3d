// The 3D renderer: raw WebGL2, one program, flat-shaded low-poly meshes.
// Flags per vertex: 0 lit, 1 water (the shader waves it), 2 emissive (windows,
// lamps, headlights), 4 sky (no fog, no lighting). The city + water are one
// static mesh; cars, people, the helicopter, planes and boats are rebuilt
// every frame into a small dynamic mesh.
import { DUSK } from './config.js';
import { MeshBuilder, hexToRgb } from './mesh.js';
import { boatMesh, carMesh, heliMesh, personMesh, planeMesh } from './sea.js';

const VERT = `#version 300 es
in vec3 aPos;
in vec3 aNor;
in vec3 aCol;
in float aFlag;
uniform mat4 uProj;
uniform mat4 uView;
uniform float uTime;
out vec3 vCol;
out vec3 vNor;
out float vFlag;
out float vDist;
out vec3 vPos;
void main() {
  vec3 p = aPos;
  if (aFlag > 0.5 && aFlag < 1.5) {
    // Water: two sine waves travelling across the ocean.
    p.y += sin(p.x * 0.08 + uTime * 1.3) * 0.35 + sin(p.z * 0.11 + uTime * 0.9) * 0.3;
  }
  vec4 view = uView * vec4(p, 1.0);
  vDist = -view.z;
  vPos = p;
  vCol = aCol;
  vNor = aNor;
  vFlag = aFlag;
  gl_Position = uProj * view;
}
`;

const FRAG = `#version 300 es
precision highp float;
in vec3 vCol;
in vec3 vNor;
in float vFlag;
in float vDist;
in vec3 vPos;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAmb;
uniform vec3 uFogColor;
uniform vec2 uFog;
uniform float uTime;
out vec4 fragColor;
void main() {
  vec3 col = vCol;
  if (vFlag > 3.5) {
    // Sky: colour straight through, no fog, no light.
    fragColor = vec4(col, 1.0);
    return;
  }
  if (vFlag > 1.5 && vFlag < 2.5) {
    // Emissive: windows, lamps, headlights — bright, unfogged a little.
    col = vCol * 1.5;
  } else {
    float diff = max(dot(normalize(vNor), normalize(uSunDir)), 0.0);
    col = vCol * (uAmb + uSunColor * diff);
    if (vFlag > 0.5 && vFlag < 1.5) {
      // Water: travelling sparkle on top of the waves.
      float sp = sin(vPos.x * 0.35 + uTime * 2.0) * sin(vPos.z * 0.3 - uTime * 1.6);
      col += vec3(0.10, 0.14, 0.14) * max(sp, 0.0);
    }
  }
  float f = smoothstep(uFog.x, uFog.y, vDist);
  col = mix(col, uFogColor, f);
  fragColor = vec4(col, 1.0);
}
`;

function mat4Perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const out = new Float32Array(16);
  out[0] = f / aspect; out[5] = f; out[10] = (far + near) / (near - far);
  out[11] = -1; out[14] = (2 * far * near) / (near - far);
  return out;
}

function mat4LookAt(ex, ey, ez, lx, ly, lz) {
  // z = normalize(eye - target); x = normalize(up x z); y = z x x.
  let zx = ex - lx, zy = ey - ly, zz = ez - lz;
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len; zy /= len; zz /= len;
  let xx = zz, xy = 0, xz = -zx;
  len = Math.hypot(xx, xy, xz) || 1;
  xx /= len; xy /= len; xz /= len;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  // The axes are the ROWS of the view matrix (gl-matrix lookAt): row 0 is the
  // camera's right vector, row 1 its up vector, row 2 its back vector. The
  // previous code stored them as columns instead, which skewed every diagonal
  // view by twice its yaw: the chase camera framed the player car at the left
  // edge and put the sailboat and helicopter off-screen, while axis-aligned
  // views (the title screen) looked almost right.
  const out = new Float32Array(16);
  out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
  out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
  out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
  out[12] = -(xx * ex + xy * ey + xz * ez);
  out[13] = -(yx * ex + yy * ey + yz * ez);
  out[14] = -(zx * ex + zy * ey + zz * ez);
  out[15] = 1;
  return out;
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(`shader: ${gl.getShaderInfoLog(sh)}`);
  }
  return sh;
}

function createBuffer(gl, data, target = gl.ARRAY_BUFFER) {
  const buf = gl.createBuffer();
  gl.bindBuffer(target, buf);
  gl.bufferData(target, data, gl.DYNAMIC_DRAW);
  return buf;
}

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
  if (!gl) throw new Error('WebGL2 is not available in this browser.');
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`program: ${gl.getProgramInfoLog(prog)}`);
  }
  gl.useProgram(prog);
  const loc = {
    proj: gl.getUniformLocation(prog, 'uProj'),
    view: gl.getUniformLocation(prog, 'uView'),
    time: gl.getUniformLocation(prog, 'uTime'),
    sunDir: gl.getUniformLocation(prog, 'uSunDir'),
    sunColor: gl.getUniformLocation(prog, 'uSunColor'),
    amb: gl.getUniformLocation(prog, 'uAmb'),
    fogColor: gl.getUniformLocation(prog, 'uFogColor'),
    fog: gl.getUniformLocation(prog, 'uFog'),
  };
  const aPos = gl.getAttribLocation(prog, 'aPos');
  const aNor = gl.getAttribLocation(prog, 'aNor');
  const aCol = gl.getAttribLocation(prog, 'aCol');
  const aFlag = gl.getAttribLocation(prog, 'aFlag');

  // One VAO/VBO set per mesh, (re)filled each draw.
  function makeMesh() {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const bufs = {
      pos: createBuffer(gl, new Float32Array(0)),
      nor: createBuffer(gl, new Float32Array(0)),
      col: createBuffer(gl, new Float32Array(0)),
      flg: createBuffer(gl, new Float32Array(0)),
      idx: createBuffer(gl, new Uint32Array(0), gl.ELEMENT_ARRAY_BUFFER),
    };
    for (const [name, size, attr] of [['pos', 3, aPos], ['nor', 3, aNor], ['col', 3, aCol], ['flg', 1, aFlag]]) {
      gl.bindBuffer(gl.ARRAY_BUFFER, bufs[name]);
      gl.enableVertexAttribArray(attr);
      gl.vertexAttribPointer(attr, size, gl.FLOAT, false, 0, 0);
    }
    return { vao, bufs, count: 0 };
  }
  function upload(mesh, arrays) {
    gl.bindVertexArray(mesh.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.bufs.pos);
    gl.bufferData(gl.ARRAY_BUFFER, arrays.position, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.bufs.nor);
    gl.bufferData(gl.ARRAY_BUFFER, arrays.normal, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.bufs.col);
    gl.bufferData(gl.ARRAY_BUFFER, arrays.color, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.bufs.flg);
    gl.bufferData(gl.ARRAY_BUFFER, arrays.flag, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.bufs.idx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, arrays.index, gl.DYNAMIC_DRAW);
    mesh.count = arrays.index.length;
  }

  const staticMesh = makeMesh();
  const dynamicMesh = makeMesh();
  const skyMesh = makeMesh();

  // The sky dome: a big box around the camera with a dusk gradient, plus the sun.
  function buildSky(cx, cy, cz) {
    const b = new MeshBuilder();
    const top = hexToRgb('#241a3e');
    const horizon = hexToRgb('#ff8a4d');
    const S = 900;
    // Four side quads, gradient by height (two quads each: top colour above,
    // horizon colour below) — approximated with a single colour per quad band.
    const bands = [
      { y0: cy - 40, y1: cy + 220, col: horizon },
      { y0: cy + 220, y1: cy + S, col: top },
    ];
    for (const band of bands) {
      b.quad([cx - S, band.y0, cz - S], [cx + S, band.y0, cz - S], [cx + S, band.y1, cz - S], [cx - S, band.y1, cz - S], 0, 0, 1, band.col, 4);
      b.quad([cx + S, band.y0, cz + S], [cx - S, band.y0, cz + S], [cx - S, band.y1, cz + S], [cx + S, band.y1, cz + S], 0, 0, 1, band.col, 4);
      b.quad([cx + S, band.y0, cz - S], [cx + S, band.y0, cz + S], [cx + S, band.y1, cz + S], [cx + S, band.y1, cz - S], 0, 0, 1, band.col, 4);
      b.quad([cx - S, band.y0, cz + S], [cx - S, band.y0, cz - S], [cx - S, band.y1, cz - S], [cx - S, band.y1, cz + S], 0, 0, 1, band.col, 4);
    }
    b.flatQuad(cx - S, cz - S, cx + S, cz + S, cy + S, top, 4); // roof
    // The sun: a bright cube low in the west (a cube reads from every angle).
    const sun = hexToRgb('#ffe9a8');
    const sd = DUSK.sunDir;
    const sx = cx + sd[0] * 780, sy = cy + sd[1] * 780, sz = cz + sd[2] * 780;
    b.box(sx, sy, sz, 52, 52, 52, sun, sun, 2);
    return b.toArrays();
  }

  let staticUploaded = false;
  let lastW = 0, lastH = 0;

  // Camera basis, for mouse aiming (screen -> ground plane).
  const basis = { fwd: [0, 0, -1], right: [1, 0, 0], up: [0, 1, 0], pos: [0, 0, 0] };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (w !== lastW || h !== lastH) {
      canvas.width = w;
      canvas.height = h;
      lastW = w;
      lastH = h;
    }
    return { w, h };
  }

  function draw(state) {
    const { w, h } = resize();
    if (w === 0 || h === 0) return;
    const time = state.time;
    const cam = state.camera;

    if (!staticUploaded) {
      const combined = new MeshBuilder();
      combined.append(state.city.mesh);
      combined.append(state.water);
      upload(staticMesh, combined.toArrays());
      staticUploaded = true;
    }

    gl.viewport(0, 0, w, h);
    gl.clearColor(DUSK.skyHorizon[0], DUSK.skyHorizon[1], DUSK.skyHorizon[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(prog);
    const proj = mat4Perspective((62 * Math.PI) / 180, w / h, 0.1, 2400);
    const view = mat4LookAt(cam.x, cam.y, cam.z, cam.lx, cam.ly, cam.lz);
    gl.uniformMatrix4fv(loc.proj, false, proj);
    gl.uniformMatrix4fv(loc.view, false, view);
    gl.uniform1f(loc.time, time);
    gl.uniform3fv(loc.sunDir, new Float32Array(DUSK.sunDir));
    gl.uniform3fv(loc.sunColor, new Float32Array(DUSK.sunColor));
    gl.uniform3fv(loc.amb, new Float32Array(DUSK.ambient));
    gl.uniform3fv(loc.fogColor, new Float32Array(DUSK.fogColor));
    gl.uniform2f(loc.fog, DUSK.fogNear, DUSK.fogFar);

    // Camera basis for aiming.
    {
      let fx = cam.lx - cam.x, fy = cam.ly - cam.y, fz = cam.lz - cam.z;
      const fl = Math.hypot(fx, fy, fz) || 1;
      fx /= fl; fy /= fl; fz /= fl;
      let rx = -fz, ry = 0, rz = fx;
      const rl = Math.hypot(rx, ry, rz) || 1;
      rx /= rl; ry /= rl; rz /= rl;
      const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
      basis.fwd = [fx, fy, fz];
      basis.right = [rx, ry, rz];
      basis.up = [ux, uy, uz];
      basis.pos = [cam.x, cam.y, cam.z];
    }

    // Sky first, no depth writes.
    gl.depthMask(false);
    upload(skyMesh, buildSky(cam.x, cam.y, cam.z));
    gl.bindVertexArray(skyMesh.vao);
    gl.drawElements(gl.TRIANGLES, skyMesh.count, gl.UNSIGNED_INT, 0);
    gl.depthMask(true);

    // The island and the sea.
    gl.bindVertexArray(staticMesh.vao);
    gl.drawElements(gl.TRIANGLES, staticMesh.count, gl.UNSIGNED_INT, 0);

    // Everything that moves, rebuilt this frame.
    const d = new MeshBuilder();
    for (const car of state.cars) {
      if (car.kind === 'gone') continue;
      carMesh(d, car, time);
    }
    for (const ped of state.peds) {
      if (ped.down) {
        // Lying flat.
        d.rotatedBox(ped.x, 0.35, ped.z, 1.7, 0.5, 0.6, ped.angle, hexToRgb(ped.color));
      } else {
        personMesh(d, ped.x, ped.z, ped.angle, ped.color, true, time + ped.x);
      }
    }
    for (const hostile of state.missions.hostiles) {
      if (hostile.hp > 0) personMesh(d, hostile.x, hostile.z, hostile.angle, hostile.color, true, time + hostile.x);
    }
    // Foot patrol: navy uniforms, peaked caps.
    for (const o of state.police.officers) {
      personMesh(d, o.x, o.z, o.angle, '#1d4ed8', true, time + o.x, { police: true });
    }
    // The player on foot.
    const p = state.player;
    if (p.onFoot) {
      personMesh(d, p.x, p.z, p.angle, '#e5484d', p.walking, time);
      if (p.weapon > 0 && p.muzzle > 0) {
        // Muzzle flash.
        const fx = p.x + Math.cos(p.angle) * 1.2, fz = p.z + Math.sin(p.angle) * 1.2;
        d.rotatedBox(fx, 1.5, fz, 0.7, 0.7, 0.7, p.angle, hexToRgb('#ffe9a8'), hexToRgb('#ffffff'), 2);
      }
    }
    // Boats, the parked plane, the plane overhead, the police helicopter.
    for (const boat of state.boats) {
      boatMesh(d, boat.x, boat.y, boat.z, boat.angle, boat.color, boat.size);
    }
    planeMesh(d, state.planeParked.x, state.planeParked.y + 1.4, state.planeParked.z, state.planeParked.angle, '#e8e2d2');
    if (!state.hideFlyingPlane) {
      const pf = state.planeFlying;
      const px = Math.cos(pf.orbit) * pf.radius;
      const pz = Math.sin(pf.orbit) * pf.radius;
      planeMesh(d, px, pf.y, pz, pf.orbit + Math.PI / 2, '#c8ccd2');
    }
    const heli = state.police.heli;
    if (heli.active) {
      heliMesh(d, heli.x, heli.y, heli.z, heli.angle, heli.rotor);
    }
    upload(dynamicMesh, d.toArrays());
    gl.bindVertexArray(dynamicMesh.vao);
    gl.drawElements(gl.TRIANGLES, dynamicMesh.count, gl.UNSIGNED_INT, 0);
  }

  /** Where on the ground (y = 0) the mouse points, for aiming. */
  function screenToGround(sx, sy) {
    const rect = canvas.getBoundingClientRect();
    const nx = ((sx - rect.left) / rect.width) * 2 - 1;
    const ny = 1 - ((sy - rect.top) / rect.height) * 2;
    const tan = Math.tan((62 * Math.PI / 180) / 2);
    const aspect = rect.width / rect.height;
    const dx = basis.fwd[0] + basis.right[0] * nx * tan * aspect + basis.up[0] * ny * tan;
    const dy = basis.fwd[1] + basis.right[1] * nx * tan * aspect + basis.up[1] * ny * tan;
    const dz = basis.fwd[2] + basis.right[2] * nx * tan * aspect + basis.up[2] * ny * tan;
    if (dy >= -0.001) return null;
    const t = -basis.pos[1] / dy;
    return { x: basis.pos[0] + dx * t, z: basis.pos[2] + dz * t };
  }

  return { draw, screenToGround, gl };
}
