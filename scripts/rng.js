/**
 * Small seeded PRNG (mulberry32) so a given seed always produces the same rune.
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic hash from a string into a 32-bit seed. */
export function hashStringToSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** Helpers built on top of a rng() function that returns [0,1). */
export class Rand {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.rng = mulberry32(this.seed);
  }
  float(min = 0, max = 1) {
    return min + this.rng() * (max - min);
  }
  int(min, max) {
    return Math.floor(this.float(min, max + 1));
  }
  bool(chance = 0.5) {
    return this.rng() < chance;
  }
  pick(arr) {
    return arr[this.int(0, arr.length - 1)];
  }
  /** Fisher-Yates shuffle, returns a new array. */
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}
