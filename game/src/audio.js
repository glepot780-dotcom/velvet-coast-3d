// Procedural WebAudio: engine hum, police siren, gunshots and three radio
// stations of chiptune. No audio files, no network. Everything is guarded:
// if the browser has no audio (headless, muted), every call is a no-op.
import { RADIO } from './config.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenHigh = false;
  let sirenTimer = 0;
  let radioTimer = 0;
  let radioStep = 0;
  let muted = false;

  function ensure() {
    if (ctx || muted) return;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.4;
      master.connect(ctx.destination);
      // Engine: a sawtooth through a lowpass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a sine that alternates two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    } catch {
      ctx = null;
    }
  }

  function note(freq, when, dur, type = 'square', vol = 0.12) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  return {
    ensure,
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.4;
      return muted;
    },
    /** Call every frame: engine pitch, siren, radio sequencer. */
    update(state, dt) {
      if (!ctx || muted) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const speed = Math.abs(state.player.speed ?? 0);
      if (engineOsc && engineGain) {
        engineOsc.frequency.value = 50 + speed * 3.2;
        engineGain.gain.value = state.player.onFoot ? 0 : 0.05 + Math.min(0.09, speed * 0.002);
      }
      if (sirenOsc && sirenGain) {
        if (state.wanted > 0) {
          sirenTimer -= dt;
          if (sirenTimer <= 0) {
            sirenTimer = 0.45;
            sirenHigh = !sirenHigh;
            sirenOsc.frequency.value = sirenHigh ? 950 : 720;
          }
          sirenGain.gain.value = 0.045;
        } else {
          sirenGain.gain.value = 0;
        }
      }
      // Radio: a tiny sequencer on the current station's scale.
      radioTimer -= dt;
      if (radioTimer <= 0) {
        const station = RADIO[state.radio.station];
        radioTimer = 60 / station.tempo / 2;
        const scale = station.scale;
        const degree = [0, 2, 1, 3, 4, 3, 2, 1][radioStep % 8];
        const semis = scale[degree % scale.length] + 12 * Math.floor(degree / scale.length);
        const freq = 220 * Math.pow(2, semis / 12);
        note(freq, ctx.currentTime, 0.22, 'square', 0.05);
        if (radioStep % 4 === 0) note(freq / 2, ctx.currentTime, 0.3, 'triangle', 0.08);
        radioStep += 1;
      }
    },
    gunshot() {
      if (!ctx || muted) return;
      try {
        const dur = 0.12;
        const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1800;
        const g = ctx.createGain();
        g.gain.value = 0.5;
        src.connect(filter);
        filter.connect(g);
        g.connect(master);
        src.start();
      } catch {
        // Audio is best-effort.
      }
    },
    blip(freq = 660) {
      if (!ctx || muted) return;
      note(freq, ctx.currentTime, 0.08, 'sine', 0.1);
    },
  };
}
