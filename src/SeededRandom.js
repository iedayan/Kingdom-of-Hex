/**
 * Global seeded random number generator
 * Allows deterministic map generation for debugging
 */

let rng = Math.random
let currentSeed = null

export function createRng(seed) {
  let s = (seed ?? 0) >>> 0
  return () => {
    s |= 0
    s = s + 0x6D2B79F5 | 0
    let t = Math.imul(s ^ s >>> 15, 1 | s)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

export function hashSeed(...parts) {
  const input = parts.join(':')
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/**
 * Set the global RNG seed
 * @param {number|null} seed - Seed value, or null/0 for Math.random
 */
export function setSeed(seed) {
  currentSeed = seed
  if (seed === null) {
    rng = Math.random
  } else {
    rng = createRng(seed)
  }
}

/**
 * Get a random number [0, 1)
 */
export function random() {
  return rng()
}

/**
 * Get current seed value
 */
export function getSeed() {
  return currentSeed
}

/**
 * In-place Fisher-Yates shuffle using seeded RNG
 */
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
