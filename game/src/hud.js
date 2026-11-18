// The 2D overlay: HUD, minimap, full city map, weapon wheel, menus, dialogue and
// shop. Everything is drawn on a second canvas over the WebGL one, in a fixed
// 1280x720 logical space scaled to the window. drawHud returns the clickable
// buttons of the current screen so main.js can hit-test them.
import {
  CHARACTERS, DISTRICTS, FONT, GARAGE_ITEMS, MISSIONS, PLACES, RADIO, WEAPONS, WORLD,
} from './config.js';
import { currentMission, currentStage, objectiveTarget, objectiveText } from './missions.js';
import { responseList } from './police.js';

const W = 1280, H = 720;
const PANEL = 'rgba(8, 12, 22, 0.82)';
const PANEL_EDGE = 'rgba(53, 224, 200, 0.55)';
const GOLD = '#f2c94c';
const PINK = '#ff5fa2';
const TEAL = '#35e0c8';
const GREEN = '#4ade80';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function panel(ctx, x, y, w, h, edge = PANEL_EDGE) {
  rr(ctx, x, y, w, h, 10);
  ctx.fillStyle = PANEL;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function text(ctx, s, x, y, size, color, weight = 700, align = 'left') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x, y);
}

function bar(ctx, x, y, w, h, frac, color, bg = 'rgba(255,255,255,0.18)') {
  rr(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  if (frac > 0) {
    rr(ctx, x, y, Math.max(h, w * Math.min(1, frac)), h, h / 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function star(ctx, x, y, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? GOLD : 'rgba(255,255,255,0.25)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** A character portrait: coloured card, simple face, name under it. */
function portrait(ctx, key, x, y, size, showName = true, label = null) {
  const ch = CHARACTERS[key];
  rr(ctx, x, y, size, size, 10);
  ctx.fillStyle = ch.color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Face: head, hair, eyes.
  const cx = x + size / 2, cy = y + size * 0.44;
  ctx.fillStyle = '#d9a066';
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = key === 'ivy' ? '#2b2b33' : key === 'priya' ? '#1f2a44' : '#3a2a1a';
  ctx.beginPath();
  ctx.arc(cx, cy - size * 0.08, size * 0.26, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#14161a';
  ctx.beginPath();
  ctx.arc(cx - size * 0.1, cy, size * 0.035, 0, Math.PI * 2);
  ctx.arc(cx + size * 0.1, cy, size * 0.035, 0, Math.PI * 2);
  ctx.fill();
  if (showName) text(ctx, label ?? ch.name, x + size / 2, y + size + 16, 12, '#ffffff', 800, 'center');
}

/** Small weapon glyphs for the wheel and the HUD slots. */
function weaponIcon(ctx, icon, x, y, s, color = '#eef1f5') {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, s * 0.08);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (icon === 'fist') {
    rr(ctx, x - s * 0.32, y - s * 0.2, s * 0.64, s * 0.44, s * 0.12);
    ctx.stroke();
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x - s * 0.18 + i * s * 0.18, y - s * 0.2);
      ctx.lineTo(x - s * 0.18 + i * s * 0.18, y + s * 0.24);
      ctx.stroke();
    }
  } else if (icon === 'pistol') {
    ctx.beginPath();
    ctx.moveTo(x - s * 0.4, y - s * 0.1);
    ctx.lineTo(x + s * 0.42, y - s * 0.1);
    ctx.lineTo(x + s * 0.42, y + s * 0.08);
    ctx.lineTo(x + s * 0.05, y + s * 0.08);
    ctx.lineTo(x - s * 0.05, y + s * 0.42);
    ctx.lineTo(x - s * 0.28, y + s * 0.42);
    ctx.lineTo(x - s * 0.2, y + s * 0.08);
    ctx.closePath();
    ctx.fill();
  } else if (icon === 'smg') {
    ctx.fillRect(x - s * 0.42, y - s * 0.12, s * 0.84, s * 0.2);
    ctx.fillRect(x - s * 0.1, y + s * 0.08, s * 0.14, s * 0.34);
    ctx.fillRect(x + s * 0.28, y - s * 0.2, s * 0.1, s * 0.36);
  } else {
    // Shotgun: long barrel + pump.
    ctx.fillRect(x - s * 0.45, y - s * 0.1, s * 0.9, s * 0.16);
    ctx.fillRect(x - s * 0.3, y + s * 0.06, s * 0.22, s * 0.3);
    ctx.fillRect(x + s * 0.3, y + s * 0.02, s * 0.14, s * 0.24);
  }
}

function districtAt(state) {
  let best = DISTRICTS[0], bestD = Infinity;
  for (const d of DISTRICTS) {
    const dd = Math.hypot(state.player.x - d.cx, state.player.z - d.cz);
    if (dd < bestD) { bestD = dd; best = d; }
  }
  return best;
}

function clockText(state) {
  const total = 18 * 60 + 36 + Math.floor(state.time / 10);
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** The circular minimap, bottom-left. */
function drawMinimap(ctx, state, cx, cy, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#14506e';
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  const scale = (r * 2) / 560;
  const toX = (x) => cx + (x + 0) * scale;
  const toY = (z) => cy + (z + 0) * scale;
  // Land.
  ctx.fillStyle = '#3d5a44';
  ctx.fillRect(toX(WORLD.minX), toY(WORLD.minZ), (WORLD.maxX - WORLD.minX) * scale, (WORLD.maxZ - WORLD.minZ) * scale);
  // Beach.
  ctx.fillStyle = '#c9a86a';
  ctx.fillRect(toX(WORLD.minX), toY(WORLD.minZ), (WORLD.beachX - WORLD.minX) * scale, (WORLD.maxZ - WORLD.minZ) * scale);
  ctx.fillRect(toX(WORLD.minX), toY(WORLD.beachZ), (WORLD.maxX - WORLD.minX) * scale, (WORLD.maxZ - WORLD.beachZ) * scale);
  // Roads.
  ctx.strokeStyle = 'rgba(20, 22, 28, 0.85)';
  ctx.lineWidth = 3;
  for (const x of [-200, -120, -40, 40, 120, 180]) {
    ctx.beginPath();
    ctx.moveTo(toX(x), toY(WORLD.minZ));
    ctx.lineTo(toX(x), toY(WORLD.maxZ));
    ctx.stroke();
  }
  for (const z of [-160, -80, 0, 80, 160]) {
    ctx.beginPath();
    ctx.moveTo(toX(WORLD.minX), toY(z));
    ctx.lineTo(toX(WORLD.maxX), toY(z));
    ctx.stroke();
  }
  // Airfield runway.
  ctx.strokeStyle = '#8b93a3';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(toX(225), toY(-90));
  ctx.lineTo(toX(225), toY(90));
  ctx.stroke();
  // Objective marker.
  const target = objectiveTarget(state);
  if (target) {
    const pulse = 1 + Math.sin(state.time * 4) * 0.2;
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(toX(target.x), toY(target.z), 6 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#14161a';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // Police dots.
  for (const car of state.cars) {
    if (car.kind !== 'police') continue;
    ctx.fillStyle = '#ff2d2d';
    ctx.beginPath();
    ctx.arc(toX(car.x), toY(car.z), 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player arrow.
  ctx.save();
  ctx.translate(toX(state.player.x), toY(state.player.z));
  ctx.rotate(state.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(-6, -6);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#14161a';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  ctx.restore();
  // Ring + north.
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = TEAL;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 5, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
  text(ctx, 'N', cx, cy - r + 16, 13, '#ffffff', 800, 'center');
  const d = districtAt(state);
  text(ctx, d.name.toUpperCase(), cx, cy + r + 18, 13, '#ffffff', 800, 'center');
  if (target) {
    const dist = Math.round(Math.hypot(target.x - state.player.x, target.z - state.player.z));
    text(ctx, `${dist}m`, cx, cy + r + 36, 12, GOLD, 800, 'center');
  }
}

/** The full city map screen. */
function drawMapScreen(ctx, state) {
  ctx.fillStyle = 'rgba(6, 8, 14, 0.88)';
  ctx.fillRect(0, 0, W, H);
  text(ctx, 'MERIDIAN BAY', 40, 52, 30, '#ff5fa2', 900);
  text(ctx, 'CITY MAP', 40, 78, 16, '#ffffff', 700);
  text(ctx, 'M / Esc close', W - 40, 52, 14, '#8b93a3', 700, 'right');

  // Left: the story jobs.
  panel(ctx, 40, 96, 250, 520);
  text(ctx, 'STORY', 60, 126, 15, GOLD, 800);
  text(ctx, `${Math.min(state.missions.index, 7)}/7 jobs`, 270, 126, 13, '#ffffff', 700, 'right');
  MISSIONS.forEach((m, i) => {
    const y = 150 + i * 62;
    const done = i < state.missions.index;
    const active = i === state.missions.index && state.missions.active;
    portrait(ctx, m.giver, 60, y, 34, false);
    text(ctx, `${m.id}. ${m.title}`, 104, y + 14, 13, done ? '#8b93a3' : '#ffffff', 800);
    text(ctx, done ? 'Complete' : active ? 'In progress' : 'Locked', 104, y + 32, 12, done ? GREEN : active ? GOLD : '#8b93a3', 700);
    text(ctx, `$${m.pay.toLocaleString('en-US')}`, 270, y + 22, 13, GREEN, 800, 'right');
  });
  // Current job box.
  const m = currentMission(state.missions);
  if (m) {
    panel(ctx, 40, 620, 250, 64, 'rgba(242, 201, 76, 0.6)');
    text(ctx, 'CURRENT JOB', 56, 642, 11, GOLD, 800);
    text(ctx, `CH ${m.id} · ${m.title}`, 56, 662, 14, '#ffffff', 800);
  }

  // Centre: the map.
  const mx = 320, my = 96, mw = 640, mh = 520;
  panel(ctx, mx, my, mw, mh, 'rgba(53, 224, 200, 0.4)');
  ctx.save();
  rr(ctx, mx, my, mw, mh, 10);
  ctx.clip();
  ctx.fillStyle = '#14506e';
  ctx.fillRect(mx, my, mw, mh);
  const scale = 1.05;
  const toX = (x) => mx + mw / 2 + x * scale;
  const toY = (z) => my + mh / 2 + z * scale;
  ctx.fillStyle = '#476b4f';
  ctx.fillRect(toX(WORLD.minX), toY(WORLD.minZ), (WORLD.maxX - WORLD.minX) * scale, (WORLD.maxZ - WORLD.minZ) * scale);
  ctx.fillStyle = '#c9a86a';
  ctx.fillRect(toX(WORLD.minX), toY(WORLD.minZ), (WORLD.beachX - WORLD.minX) * scale, (WORLD.maxZ - WORLD.minZ) * scale);
  ctx.fillRect(toX(WORLD.minX), toY(WORLD.beachZ), (WORLD.maxX - WORLD.minX) * scale, (WORLD.maxZ - WORLD.beachZ) * scale);
  ctx.strokeStyle = 'rgba(20, 22, 28, 0.8)';
  ctx.lineWidth = 4;
  for (const x of [-200, -120, -40, 40, 120, 180]) {
    ctx.beginPath(); ctx.moveTo(toX(x), toY(WORLD.minZ)); ctx.lineTo(toX(x), toY(WORLD.maxZ)); ctx.stroke();
  }
  for (const z of [-160, -80, 0, 80, 160]) {
    ctx.beginPath(); ctx.moveTo(toX(WORLD.minX), toY(z)); ctx.lineTo(toX(WORLD.maxX), toY(z)); ctx.stroke();
  }
  // Runway + piers.
  ctx.strokeStyle = '#d8dde2';
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(toX(225), toY(-90)); ctx.lineTo(toX(225), toY(90)); ctx.stroke();
  ctx.strokeStyle = '#7a5c38';
  ctx.lineWidth = 5;
  for (const pz of [118, 140, 162]) {
    ctx.beginPath(); ctx.moveTo(toX(-258), toY(pz)); ctx.lineTo(toX(-286), toY(pz)); ctx.stroke();
  }
  // District labels.
  for (const d of DISTRICTS) {
    text(ctx, d.name.toUpperCase(), toX(d.cx), toY(d.cz), 12, 'rgba(255,255,255,0.9)', 800, 'center');
  }
  // Route from the player to the objective.
  const target = objectiveTarget(state);
  if (target) {
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(toX(state.player.x), toY(state.player.z));
    ctx.lineTo(toX(target.x), toY(target.z));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(toX(target.x), toY(target.z), 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#14161a';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // Markers: player, places, boats, plane.
  function marker(x, z, label, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(toX(x), toY(z), 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#14161a';
    ctx.lineWidth = 2;
    ctx.stroke();
    text(ctx, label, toX(x), toY(z) + 3, 9, '#14161a', 900, 'center');
  }
  marker(PLACES.garage.x, PLACES.garage.z, 'G', '#ff5fa2');
  marker(PLACES.hospital.x, PLACES.hospital.z, 'H', '#7ee2a8');
  marker(PLACES.safehouse.x, PLACES.safehouse.z, 'S', '#7fb069');
  marker(PLACES.airfield.x, PLACES.airfield.z, 'A', '#9b8cf2');
  marker(PLACES.marina.x, PLACES.marina.z, 'M', '#4fc3f7');
  for (const boat of state.boats) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(toX(boat.x), toY(boat.z), 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player.
  ctx.save();
  ctx.translate(toX(state.player.x), toY(state.player.z));
  ctx.rotate(state.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(13, 0); ctx.lineTo(-9, -9); ctx.lineTo(-9, 9); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#e5484d';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
  text(ctx, 'You are here', toX(state.player.x), toY(state.player.z) - 16, 11, '#ffffff', 800, 'center');
  ctx.restore();

  // Right: legend + stats.
  panel(ctx, 990, 96, 250, 520);
  text(ctx, 'LEGEND', 1010, 126, 15, TEAL, 800);
  const legend = [
    ['▶', 'You are here', '#ffffff'], ['P', 'Story contact', GOLD], ['◉', 'Job objective', GOLD],
    ['G', 'Garage / respray', '#ff5fa2'], ['H', 'Hospital', '#7ee2a8'], ['S', 'Safehouse', '#7fb069'],
    ['A', 'Airfield', '#9b8cf2'], ['M', 'Marina', '#4fc3f7'], ['●', 'Police', '#ff2d2d'], ['○', 'Boat', '#ffffff'],
  ];
  legend.forEach(([g, label, col], i) => {
    text(ctx, g, 1014, 154 + i * 26, 14, col, 900);
    text(ctx, label, 1038, 154 + i * 26, 13, '#eef1f5', 600);
  });
  text(ctx, 'STATS', 1010, 440, 15, TEAL, 800);
  text(ctx, `Cash  $${state.money.toLocaleString('en-US')}`, 1010, 468, 14, '#ffffff', 700);
  text(ctx, `Respect  level ${state.respect}`, 1010, 492, 14, '#ffffff', 700);
  text(ctx, `Cars owned  ${state.ownedCars.length}`, 1010, 516, 14, '#ffffff', 700);
  text(ctx, `Shots fired  ${state.stats.shots}`, 1010, 540, 14, '#ffffff', 700);
  text(ctx, `Cars stolen  ${state.stats.stolen}`, 1010, 564, 14, '#ffffff', 700);
  return [];
}

/** The weapon wheel: four slots, one highlighted. */
function drawWeaponWheel(ctx, state) {
  ctx.fillStyle = 'rgba(6, 8, 14, 0.55)';
  ctx.fillRect(0, 0, W, H);
  text(ctx, 'WEAPONS', W / 2, 210, 22, '#ffffff', 900, 'center');
  text(ctx, '1–4 or click to choose · Q to close', W / 2, 236, 13, '#8b93a3', 600, 'center');
  const slotW = 150, slotH = 120, gap = 18;
  const total = WEAPONS.length * slotW + (WEAPONS.length - 1) * gap;
  const x0 = (W - total) / 2, y0 = 290;
  const p = state.player;
  WEAPONS.forEach((w, i) => {
    const x = x0 + i * (slotW + gap);
    const sel = state.wheelSelected === i;
    rr(ctx, x, y0, slotW, slotH, 12);
    ctx.fillStyle = sel ? 'rgba(242, 201, 76, 0.22)' : PANEL;
    ctx.fill();
    ctx.strokeStyle = sel ? GOLD : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = sel ? 3 : 1.5;
    ctx.stroke();
    text(ctx, `${i + 1}`, x + 12, y0 + 22, 13, '#8b93a3', 800);
    weaponIcon(ctx, w.icon, x + slotW / 2, y0 + 46, 44, sel ? GOLD : '#eef1f5');
    text(ctx, w.name, x + slotW / 2, y0 + 86, 14, sel ? GOLD : '#ffffff', 800, 'center');
    const ammo = w.mag === Infinity ? '∞' : `${p.ammo[i]} / ${p.reserve[i]}`;
    text(ctx, ammo, x + slotW / 2, y0 + 106, 13, '#8b93a3', 700, 'center');
  });
  const w = WEAPONS[state.wheelSelected];
  text(ctx, `${w.name} — ${w.damage} damage · ${w.range}m range`, W / 2, y0 + slotH + 34, 14, '#ffffff', 700, 'center');
  const buttons = [];
  WEAPONS.forEach((ww, i) => {
    buttons.push({ id: `weapon:${i}`, x: x0 + i * (slotW + gap), y: y0, w: slotW, h: slotH });
  });
  return buttons;
}

/** The in-play HUD. */
function drawPlayHud(ctx, state) {
  const p = state.player;
  const ms = state.missions;
  const m = currentMission(ms);
  const stage = currentStage(ms);

  // Mission panel, top-left.
  panel(ctx, 16, 14, 360, 92);
  if (m && ms.active) {
    text(ctx, `MISSION ${m.id}/7 · ${m.title}`, 30, 40, 15, GOLD, 900);
    text(ctx, objectiveText(state), 30, 64, 14, '#ffffff', 700);
    if (stage && stage.seconds) {
      text(ctx, `${Math.ceil(ms.timer)}s`, 362, 40, 20, ms.timer < 15 ? '#ff5b5b' : '#ffffff', 900, 'right');
    }
    const total = m.stages.length;
    bar(ctx, 30, 76, 200, 8, (ms.stage + 0.5) / total, TEAL);
    text(ctx, `STAGE ${ms.stage + 1}/${total}`, 240, 86, 11, '#8b93a3', 700);
    if (stage && stage.kind !== 'escape') text(ctx, `NEXT › ${stage.label.slice(0, 34)}`, 30, 98, 11, '#8b93a3', 600);
  } else if (m) {
    text(ctx, `NEXT JOB · ${m.title}`, 30, 40, 15, GOLD, 900);
    text(ctx, m.brief, 30, 64, 13, '#ffffff', 600);
  } else {
    text(ctx, 'STORY COMPLETE', 30, 40, 15, GOLD, 900);
    text(ctx, 'Meridian Bay is yours. Free roam.', 30, 64, 13, '#ffffff', 600);
  }

  // Police response panel (only when hot).
  if (state.wanted > 0) {
    const list = responseList(state);
    panel(ctx, 16, 118, 300, 44 + list.length * 24, 'rgba(255, 45, 45, 0.6)');
    text(ctx, 'VCPD RESPONSE', 30, 142, 13, '#ff8a8a', 900);
    text(ctx, responseList(state).length && state.police.seen ? 'IN SIGHT' : 'SEARCHING', 302, 142, 12, '#ff8a8a', 800, 'right');
    list.forEach((u, i) => {
      text(ctx, `◆ ${u.name}`, 30, 166 + i * 24, 13, '#ffffff', 700);
      text(ctx, `${u.dist} m`, 200, 166 + i * 24, 13, '#ffffff', 700, 'right');
      text(ctx, u.doing, 302, 166 + i * 24, 12, u.doing === 'RAMMING' ? '#ff5b5b' : GOLD, 800, 'right');
    });
  }

  // Money + wanted, top-right.
  text(ctx, `DAY ${state.day} · ${clockText(state)}`, W - 16, 36, 14, '#ffffff', 800, 'right');
  text(ctx, `$${state.money.toLocaleString('en-US')}`, W - 16, 74, 34, GREEN, 900, 'right');
  for (let i = 0; i < 5; i += 1) star(ctx, W - 16 - (4 - i) * 30, 100, 11, i < state.wanted);
  const w = WEAPONS[p.weapon];
  text(ctx, `${w.name}  ${w.mag === Infinity ? '∞' : `${p.ammo[p.weapon]} / ${p.reserve[p.weapon]}`}`, W - 16, 126, 14, '#ffffff', 800, 'right');
  text(ctx, state.wanted > 0 ? 'VCPD: CITYWIDE ALERT' : 'VCPD: QUIET NIGHT', W - 16, 148, 12, state.wanted > 0 ? '#ff8a8a' : '#8b93a3', 800, 'right');

  // Weapon mini-slots, right edge.
  WEAPONS.forEach((ww, i) => {
    const y = 168 + i * 40;
    const sel = p.weapon === i;
    rr(ctx, W - 66, y, 50, 32, 7);
    ctx.fillStyle = sel ? 'rgba(242, 201, 76, 0.3)' : PANEL;
    ctx.fill();
    ctx.strokeStyle = sel ? GOLD : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = sel ? 2 : 1;
    ctx.stroke();
    weaponIcon(ctx, ww.icon, W - 41, y + 16, 20, sel ? GOLD : '#eef1f5');
    text(ctx, `${i + 1}`, W - 74, y + 21, 12, '#8b93a3', 800, 'right');
  });

  // Health / armour / respect, bottom-left above the minimap.
  const hx = 16;
  const rows = [['HEALTH', p.hp / 100, GREEN], ['ARMOUR', p.armor / 100, '#4fc3f7'], [`REP ${state.respect}`, state.respect / 5, GOLD]];
  rows.forEach(([label, frac, color], i) => {
    const y = 458 + i * 24;
    text(ctx, label, hx, y, 11, '#ffffff', 800);
    bar(ctx, hx + 74, y - 9, 110, 10, frac, color);
  });

  // Minimap.
  drawMinimap(ctx, state, 112, 596, 84);

  // Speed + car, bottom-right.
  const car = p.car;
  const kmh = Math.round(Math.abs(p.speed ?? 0) * 3.6);
  text(ctx, `${kmh}`, W - 110, 668, 54, '#ffffff', 900, 'right');
  text(ctx, 'KM/H', W - 16, 668, 15, '#8b93a3', 800, 'right');
  if (car) {
    text(ctx, car.name, W - 16, 600, 15, TEAL, 800, 'right');
    bar(ctx, W - 216, 610, 120, 9, car.hp / 100, car.hp > 40 ? GREEN : '#ff5b5b');
  } else {
    text(ctx, 'ON FOOT', W - 16, 600, 15, TEAL, 800, 'right');
  }

  // Radio + dispatch, bottom-centre.
  const station = RADIO[state.radio.station];
  text(ctx, `♪ ${station.name} · ${station.show}`, W / 2, 668, 13, PINK, 800, 'center');
  text(ctx, station.desc, W / 2, 686, 11, '#8b93a3', 600, 'center');
  text(ctx, state.radioLine, W / 2, 640, 13, '#ffffff', 700, 'center');

  // Controls hint.
  text(ctx, 'W/S drive · A/D steer · SPACE handbrake · F exit · Q weapons · M map · R radio · ESC pause', W / 2, 710, 11, 'rgba(255,255,255,0.55)', 600, 'center');

  // Dialogue box.
  if (state.dialogue) {
    const ch = CHARACTERS[state.dialogue.who];
    const wrapped = wrapText(state.dialogue.text, 56);
    panel(ctx, W / 2 - 320, 520, 640, 92);
    portrait(ctx, state.dialogue.who, W / 2 - 304, 534, 64, false);
    text(ctx, ch.name, W / 2 - 226, 560, 14, ch.color, 900);
    text(ctx, ch.role, W / 2 - 226, 578, 11, '#8b93a3', 700);
    wrapped.slice(0, 2).forEach((ln, i) => text(ctx, ln, W / 2 - 226, 600 + i * 18, 14, '#ffffff', 600));
  }

  // Mission banner (the card that opens a job).
  const ms2 = state.missions;
  if (ms2.banner && state.time < ms2.banner.until) {
    const b = ms2.banner;
    panel(ctx, W / 2 - 280, 130, 560, 110, 'rgba(242, 201, 76, 0.7)');
    text(ctx, b.title, W / 2, 164, 20, GOLD, 900, 'center');
    const wrapped = wrapText(b.text, 62);
    wrapped.slice(0, 2).forEach((ln, i) => text(ctx, ln, W / 2, 192 + i * 22, 14, '#ffffff', 600, 'center'));
  }

  // Toast message.
  if (state.message) {
    text(ctx, state.message.text, W / 2, 300, 15, '#ffffff', 800, 'center');
  }

  // Red flash when hurt.
  if (state.flashRed > 0) {
    ctx.fillStyle = `rgba(255, 30, 30, ${Math.min(0.35, state.flashRed)})`;
    ctx.fillRect(0, 0, W, H);
  }

  if (state.wheelOpen) return drawWeaponWheel(ctx, state);
  return [];
}

function wrapText(s, max) {
  const words = s.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > max && line) {
      lines.push(line.trim());
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line.trim());
  return lines;
}

/** The title screen: logo, menu, crew row, controls. The 3D scene behind it
 * is the staged shot (character in front of the car, helicopter, sunset). */
function drawTitle(ctx, state, ui) {
  // A soft dark gradient at the edges so the text reads over the 3D scene.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(6,8,14,0.55)');
  grad.addColorStop(0.45, 'rgba(6,8,14,0.05)');
  grad.addColorStop(1, 'rgba(6,8,14,0.72)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Logo.
  text(ctx, 'AZURE', 60, 128, 84, '#ff5fa2', 900);
  text(ctx, 'TIDE', 60, 208, 84, '#35e0c8', 900);
  text(ctx, '7 JOBS IN MERIDIAN BAY', 62, 242, 17, '#ffffff', 800);
  text(ctx, 'Sun, sea, sirens — and one last tide to ride.', 62, 268, 14, '#d8dde2', 600);

  // Menu.
  const items = [
    { id: 'continue', label: 'CONTINUE', sub: state.hasSave ? `Day ${state.saveDay ?? 1} · $${(state.saveMoney ?? 0).toLocaleString('en-US')}` : 'No save yet' },
    { id: 'new', label: 'NEW GAME', sub: 'From job 1' },
    { id: 'controls', label: 'CONTROLS', sub: 'Drive, fight, fly' },
    { id: 'settings', label: 'SETTINGS', sub: 'Radio on · Sound on' },
  ];
  const buttons = [];
  items.forEach((item, i) => {
    const y = 320 + i * 62;
    const sel = ui.menuIndex === i;
    if (sel) {
      rr(ctx, 56, y - 8, 340, 50, 10);
      ctx.fillStyle = 'rgba(242, 201, 76, 0.25)';
      ctx.fill();
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // The hint sits on its own line under the label, left-aligned inside the
    // button — never beside the label, so it can never collide with it.
    text(ctx, item.label, 72, y + 22, 22, sel ? GOLD : '#ffffff', 900);
    text(ctx, item.sub, 72, y + 41, 11, '#8b93a3', 600);
    buttons.push({ id: item.id, x: 56, y: y - 8, w: 340, h: 50 });
  });

  // Controls panel, top-right.
  panel(ctx, 880, 40, 360, 250);
  text(ctx, 'HOW TO PLAY', 904, 70, 16, TEAL, 900);
  const controls = [
    ['W A S D', 'Walk / drive'], ['Mouse', 'Aim · Click to shoot'], ['Shift', 'Sprint'],
    ['Space', 'Handbrake drift'], ['F', 'Enter / steal a vehicle'], ['E', 'Interact · next station'],
    ['Q', 'Weapon wheel'], ['R', 'Radio station'], ['M  Esc', 'City map · pause'], ['V', 'Chase / high camera'],
  ];
  controls.forEach(([k, label], i) => {
    text(ctx, k, 904, 98 + i * 20, 13, GOLD, 800);
    text(ctx, label, 1010, 98 + i * 20, 13, '#eef1f5', 600);
  });

  // Crew row, bottom.
  text(ctx, 'YOUR CREW', 60, 592, 14, '#ffffff', 800);
  const crew = [['jax', 'JAX'], ['ivy', 'IVY'], ['dante', 'DANTE'], ['priya', 'PRIYA'], ['marcus', 'MARCUS'], ['voss', 'VOSS']];
  crew.forEach(([key, label], i) => {
    portrait(ctx, key, 60 + i * 96, 606, 72, true, label);
  });
  text(ctx, 'Three years out. One last tide to ride. Jax is back in Meridian Bay — and the city owes him.', 60, 712, 13, '#d8dde2', 600);
  return buttons;
}

/** Pause / garage / end screens. */
function drawPause(ctx, state) {
  ctx.fillStyle = 'rgba(6, 8, 14, 0.7)';
  ctx.fillRect(0, 0, W, H);
  panel(ctx, W / 2 - 220, 220, 440, 280);
  text(ctx, 'PAUSED', W / 2, 268, 34, '#ffffff', 900, 'center');
  text(ctx, 'Meridian Bay waits for no one. Except now.', W / 2, 296, 13, '#8b93a3', 600, 'center');
  const items = [
    { id: 'resume', label: 'RESUME' },
    { id: 'garage', label: 'GARAGE / SHOP' },
    { id: 'map', label: 'CITY MAP' },
    { id: 'title', label: 'QUIT TO TITLE' },
  ];
  const buttons = [];
  items.forEach((item, i) => {
    const y = 330 + i * 40;
    text(ctx, item.label, W / 2, y, 17, '#ffffff', 800, 'center');
    buttons.push({ id: item.id, x: W / 2 - 220, y: y - 22, w: 440, h: 34 });
  });
  return buttons;
}

function drawGarage(ctx, state) {
  ctx.fillStyle = 'rgba(6, 8, 14, 0.82)';
  ctx.fillRect(0, 0, W, H);
  text(ctx, "IVY'S GARAGE", 60, 80, 34, PINK, 900);
  text(ctx, 'Upgrades, clean plates and new wheels.', 62, 106, 14, '#d8dde2', 600);
  text(ctx, `$${state.money.toLocaleString('en-US')}`, W - 60, 80, 30, GREEN, 900, 'right');
  const buttons = [];
  GARAGE_ITEMS.forEach((item, i) => {
    const y = 140 + i * 68;
    const owned = (item.key === 'vela' && state.ownedCars.includes('vela-coupe'))
      || (item.key === 'pickup' && state.ownedCars.includes('bay-pickup'))
      || (item.key === 'tires' && state.upgrades.tires >= 1)
      || (item.key === 'engine' && state.upgrades.engine >= 2);
    panel(ctx, 60, y, 1160, 56, owned ? 'rgba(74, 222, 128, 0.5)' : PANEL_EDGE);
    text(ctx, item.name, 84, y + 24, 17, owned ? GREEN : '#ffffff', 800);
    text(ctx, item.desc, 84, y + 44, 13, '#8b93a3', 600);
    text(ctx, owned ? 'OWNED' : `$${item.price}`, W - 84, y + 34, 17, owned ? GREEN : GOLD, 800, 'right');
    buttons.push({ id: `buy:${item.key}`, x: 60, y, w: 1160, h: 56 });
  });
  text(ctx, state.garageMessage ?? 'Esc to close', 60, 660, 14, state.garageMessage ? GOLD : '#8b93a3', 700);
  return buttons;
}

function drawEnd(ctx, state, kind) {
  ctx.fillStyle = 'rgba(6, 8, 14, 0.78)';
  ctx.fillRect(0, 0, W, H);
  if (kind === 'busted') {
    text(ctx, 'BUSTED', W / 2, 300, 72, '#ff5b5b', 900, 'center');
    text(ctx, `The VCPD caught up with you. Fine: $${state.bustedFine}.`, W / 2, 350, 16, '#ffffff', 600, 'center');
    text(ctx, 'You wake up at Meridian General. Press Enter to continue.', W / 2, 390, 14, '#8b93a3', 600, 'center');
  } else {
    text(ctx, 'THE BIG TIDE', W / 2, 260, 64, GOLD, 900, 'center');
    text(ctx, 'The loot is on the yacht. The city is yours, Jax.', W / 2, 320, 18, '#ffffff', 600, 'center');
    text(ctx, `Final cash: $${state.money.toLocaleString('en-US')} · Respect ${state.respect}/5 · Shots fired ${state.stats.shots}`, W / 2, 360, 14, '#d8dde2', 700, 'center');
    text(ctx, 'Press Enter to keep roaming Meridian Bay.', W / 2, 400, 14, '#8b93a3', 600, 'center');
  }
  return [];
}

/**
 * Draw the overlay for the current screen. `ui` carries menu selection and
 * other transient UI state. Returns the screen's clickable buttons.
 */
export function createHud(canvas) {
  const ctx = canvas.getContext('2d');
  function draw(state, ui) {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }
    ctx.setTransform((canvas.width / W), 0, 0, (canvas.height / H), 0, 0);
    ctx.clearRect(0, 0, W, H);
    switch (state.screen) {
      case 'title': return drawTitle(ctx, state, ui);
      case 'map': return drawMapScreen(ctx, state);
      case 'paused': return drawPause(ctx, state);
      case 'garage': return drawGarage(ctx, state);
      case 'busted': return drawEnd(ctx, state, 'busted');
      case 'win': return drawEnd(ctx, state, 'win');
      default: return drawPlayHud(ctx, state);
    }
  }
  return { draw };
}
