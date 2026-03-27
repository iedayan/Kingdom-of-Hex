import { random } from '../../SeededRandom.js'
import { HexUtils } from '../../game/HexUtils.js'
import { CAPITAL_CUBE_KEY } from '../../game/goals.js'

/** First wave starts this turn (after End Turn increments turn). */
export const GOBLIN_FIRST_WAVE_TURN = 8
/** Turns between waves after the first (8, 13, 18, …). */
export const GOBLIN_WAVE_PERIOD = 5

/**
 * @param {number} turn
 */
export function shouldSpawnGoblinWave(turn) {
  if (turn < GOBLIN_FIRST_WAVE_TURN) return false
  return (turn - GOBLIN_FIRST_WAVE_TURN) % GOBLIN_WAVE_PERIOD === 0
}

/**
 * How many goblins this wave (seeded random for variety).
 * Early: 1. Mid: sometimes 2. Late: often 2, rarely 3.
 */
export function goblinCountForWave(turn) {
  if (turn < 12) return 1
  let n = 1 + (random() < 0.48 ? 1 : 0)
  if (turn >= 22 && random() < 0.22) n++
  return Math.min(n, 3)
}

/**
 * Collect empty grass hexes that can host a spawn.
 * @param {{ grids?: Map }} city
 * @param {Map<string, object>} objects
 */
export function collectEmptyGrassTiles(city, objects) {
  const out = []
  if (!city?.grids) return out
  for (const grid of city.grids.values()) {
    if (!grid.hexTiles) continue
    for (const tile of grid.hexTiles) {
      if (tile.type === 0 || tile.type === 18 || tile.type === 21) {
        const q = tile.gridX - grid.gridRadius + (grid.globalCenterCube?.q || 0)
        const r = tile.gridZ - grid.gridRadius + (grid.globalCenterCube?.r || 0)
        const s = -q - r
        const key = `${q},${r},${s}`
        if (!objects.has(key) && key !== CAPITAL_CUBE_KEY) out.push({ key, q, r, s })
      }
    }
  }
  return out
}

/**
 * Weighted pick: bias toward tiles moderately close to player assets (pressure without always dropping on HQ).
 * @param {{ key: string, q: number, r: number, s: number }[]} tiles
 * @param {import('../../game/GameSession.js').GameSession} session
 */
export function pickGoblinSpawnTile(tiles, session) {
  if (tiles.length === 0) return null

  const playerKeys = [...session.objects.entries()]
    .filter(([_, o]) => o.owner === 'player')
    .map(([k]) => k)

  if (playerKeys.length === 0 || random() > 0.42) {
    return tiles[Math.floor(random() * tiles.length)]
  }

  const ranked = tiles.map((t) => {
    let minD = 999
    for (const pk of playerKeys) {
      const d = HexUtils.distance(pk, t.key)
      if (d < minD) minD = d
    }
    return { t, minD }
  })
  ranked.sort((a, b) => a.minD - b.minD)
  const near = ranked.filter((x) => x.minD >= 3 && x.minD <= 7).map((x) => x.t)
  const pool = near.length > 0 ? near : ranked.slice(0, Math.min(8, ranked.length)).map((x) => x.t)
  return pool[Math.floor(random() * pool.length)]
}
