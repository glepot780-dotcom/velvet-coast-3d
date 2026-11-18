// A small seeded random number generator (mulberry32): the same seed gives the same
// game, which is what makes the screenshot scenes repeatable.
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random float in [min, max). */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** Random integer in [min, max]. */
export function int(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** One random element of an array. */
export function pick(rng, array) {
  return array[Math.floor(rng() * array.length)];
}

/** Deterministic hash of a string, for seeding per-object variation. */
export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
