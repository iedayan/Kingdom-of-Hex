import { getBiomeForCube } from './gridAccess.js'

/** Per-bioma yield multipliers for economic buildings (grid-level climate). */
const YIELD = {
  temperate: { lumberjack: 1, farm: 1, mine: 1, library: 1, market: 1 },
  winter: { lumberjack: 0.88, farm: 0.72, mine: 1.08, library: 1.12, market: 0.92 },
  wasteland: { lumberjack: 0.82, farm: 0.62, mine: 1.28, library: 0.95, market: 1.06 },
}

export function productionMultiplier(biome, buildingType) {
  const row = YIELD[biome] || YIELD.temperate
  return row[buildingType] ?? 1
}

export function scaleYield(amount, mult) {
  return Math.max(0, Math.round(amount * mult))
}

const BASE_TOWER_DAMAGE = 4

/**
 * @param {import('../../game/GameSession.js').GameSession} session
 * @param {object} app
 * @param {string} attackerKey
 * @param {object} attacker - game object
 */
export function getAttackDamage(session, app, attackerKey, attacker) {
  if (!attacker) return 0
  if (typeof attacker.atk === 'number') return attacker.atk
  if (attacker.type === 'tower') {
    const biome = getBiomeForCube(session, app, attackerKey)
    return BASE_TOWER_DAMAGE + (biome === 'wasteland' ? 1 : 0)
  }
  return 0
}
