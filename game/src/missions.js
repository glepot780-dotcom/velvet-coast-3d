// The story: 7 jobs across 3 days. A mission is a list of stages; each stage is
// one of goto / timed / collect / combat / escape (see config.js). This module
// starts a mission, checks its stages every step and pays out on completion.
import { CHARACTERS, MISSIONS } from './config.js';
import { addHeat } from './police.js';

export const MISSION_NONE = 0;

/** Fresh mission runtime state. */
export function createMissionState() {
  return {
    index: 0, // 0-based into MISSIONS; MISSIONS.length means the story is done
    stage: 0,
    timer: 0,
    visited: [],
    killed: 0,
    failed: false,
    done: false,
    active: false,
    hostiles: [], // {x, z, angle, hp, state}
    banner: null, // {title, text, until} — the mission-start card
  };
}

export function currentMission(ms) {
  return MISSIONS[ms.index] ?? null;
}

export function currentStage(ms) {
  const m = currentMission(ms);
  return m ? m.stages[ms.stage] : null;
}

/** Begin mission `index` (0-based): reset its runtime, show the banner. */
export function startMission(state, index) {
  const ms = state.missions;
  ms.index = index;
  ms.stage = 0;
  ms.timer = 0;
  ms.visited = [];
  ms.killed = 0;
  ms.failed = false;
  ms.done = false;
  ms.active = true;
  ms.hostiles = [];
  const m = MISSIONS[index];
  if (!m) return;
  ms.banner = { title: `MISSION ${m.id}/7 · ${m.title}`, text: m.brief, until: state.time + 6 };
  state.dialogue = {
    who: m.giver, text: m.brief, until: state.time + 6,
  };
  const stage = m.stages[0];
  if (stage) enterStage(state, stage);
  state.day = m.day;
}

/** Side effects when a stage begins (timers, wanted, hostile spawns). */
function enterStage(state, stage) {
  const ms = state.missions;
  if (stage.seconds) ms.timer = stage.seconds;
  if (stage.spawnWanted) addHeat(state, stage.spawnWanted);
  if (stage.kind === 'combat') {
    ms.hostiles = [];
    for (let i = 0; i < stage.count; i += 1) {
      const a = (i / stage.count) * Math.PI * 2;
      ms.hostiles.push({
        x: stage.x + Math.cos(a) * 14, z: stage.z + Math.sin(a) * 14,
        angle: a, hp: 100, state: 'fight',
        color: ['#3a3f47', '#4a3a3f', '#3f4a3a'][i % 3],
      });
    }
  }
  if (stage.kind === 'collect') ms.visited = stage.points.map(() => false);
}

/** Advance to the next stage, or complete the mission. */
function advanceStage(state) {
  const ms = state.missions;
  const m = currentMission(ms);
  ms.stage += 1;
  if (ms.stage >= m.stages.length) {
    completeMission(state);
    return;
  }
  enterStage(state, m.stages[ms.stage]);
}

function completeMission(state) {
  const ms = state.missions;
  const m = currentMission(ms);
  state.money += m.pay;
  state.respect = Math.min(5, state.respect + 1);
  ms.done = true;
  ms.active = false;
  state.dialogue = { who: m.giver, text: m.done, until: state.time + 6 };
  state.radioLine = `${CHARACTERS[m.giver].name}: job done. $${m.pay.toLocaleString('en-US')} in your pocket.`;
  saveProgress(state);
  // The next job unlocks on the next step.
  ms.index += 1;
  ms.stage = 0;
  if (ms.index < MISSIONS.length) {
    ms.active = false;
    ms.pendingNext = true;
  } else {
    state.screen = 'win';
  }
}

function failMission(state, reason) {
  const ms = state.missions;
  ms.failed = true;
  ms.active = false;
  state.dialogue = { who: 'ivy', text: `Mission failed — ${reason}. Come back and we run it again.`, until: state.time + 6 };
  state.radioLine = `Mission failed: ${reason}.`;
}

/** Save progress (money, missions, cars) for CONTINUE on the title screen. */
export function saveProgress(state) {
  try {
    const save = {
      money: state.money,
      missionIndex: Math.min(state.missions.index, MISSIONS.length - 1),
      respect: state.respect,
      owned: state.ownedCars,
      upgrades: state.upgrades,
    };
    window.localStorage.setItem(state.saveKey, JSON.stringify(save));
  } catch {
    // Storage can be off: progress then lasts this visit only.
  }
}

export function loadProgress(state) {
  try {
    const raw = window.localStorage.getItem(state.saveKey);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function distTo(state, x, z) {
  return Math.hypot(state.player.x - x, state.player.z - z);
}

/** Check the active stage every step. Returns true when the stage changed. */
export function updateMissions(state, dt) {
  const ms = state.missions;
  if (!ms.active) {
    if (ms.pendingNext && !state.dialogue) {
      ms.pendingNext = false;
      startMission(state, ms.index);
    }
    return;
  }
  const stage = currentStage(ms);
  if (!stage) return;

  if (stage.seconds) {
    ms.timer -= dt;
    if (ms.timer <= 0) {
      failMission(state, 'out of time');
      return;
    }
  }

  const player = state.player;
  switch (stage.kind) {
    case 'goto':
    case 'timed': {
      const ok = distTo(state, stage.x, stage.z) < stage.r
        && (!stage.needsCar || !player.onFoot);
      if (ok) advanceStage(state);
      break;
    }
    case 'collect': {
      let changed = false;
      stage.points.forEach((p, i) => {
        if (!ms.visited[i] && distTo(state, p[0], p[1]) < stage.r) {
          ms.visited[i] = true;
          changed = true;
        }
      });
      if (changed && ms.visited.every(Boolean)) advanceStage(state);
      break;
    }
    case 'combat': {
      if (ms.killed >= stage.count) advanceStage(state);
      break;
    }
    case 'escape': {
      if (state.wanted <= 0) advanceStage(state);
      break;
    }
    default:
      break;
  }
}

/** Hostiles fight: walk toward the player and shoot (badly) when close. */
export function stepHostiles(state, dt) {
  const ms = state.missions;
  for (const h of ms.hostiles) {
    if (h.hp <= 0) continue;
    const dx = state.player.x - h.x, dz = state.player.z - h.z;
    const d = Math.hypot(dx, dz) || 1;
    h.angle = Math.atan2(dz, dx);
    if (d > 14) {
      h.x += (dx / d) * 3.2 * dt;
      h.z += (dz / d) * 3.2 * dt;
    } else {
      h.shootTimer = (h.shootTimer ?? 1) - dt;
      if (h.shootTimer <= 0) {
        h.shootTimer = 1.4;
        if (state.rng() < 0.4) {
          state.player.hp = Math.max(0, state.player.hp - 6);
          state.flashRed = 0.25;
        }
      }
    }
  }
}

/** Objective text for the HUD, with live counts. */
export function objectiveText(state) {
  const ms = state.missions;
  const m = currentMission(ms);
  if (!m || !ms.active) {
    if (ms.index >= MISSIONS.length) return 'Story complete — Meridian Bay is yours.';
    return 'Free roam — press Enter at a job marker to start the next mission.';
  }
  const stage = currentStage(ms);
  if (!stage) return '';
  let label = stage.label;
  if (stage.kind === 'collect') {
    const n = ms.visited.filter(Boolean).length;
    label = label.replace(/\(\d+\/\d+\)/, `(${n}/${stage.points.length})`);
  }
  if (stage.kind === 'combat') {
    label = label.replace(/\(\d+\/\d+\)/, `(${ms.killed}/${stage.count})`);
  }
  return label;
}

/** Where the HUD arrow should point (the current objective), or null. */
export function objectiveTarget(state) {
  const ms = state.missions;
  const stage = currentStage(ms);
  if (!ms.active || !stage) return null;
  if (stage.kind === 'collect') {
    const i = ms.visited.findIndex((v) => !v);
    if (i < 0) return null;
    return { x: stage.points[i][0], z: stage.points[i][1] };
  }
  if (stage.kind === 'escape') return null;
  return { x: stage.x, z: stage.z };
}
