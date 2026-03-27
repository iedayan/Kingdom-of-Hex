import { getBiomeForCube } from './gridAccess.js'
import { COMBAT, PLAYER_UNIT_TYPES } from '../../game/constants.js'

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

function getTileLevel(app, cKey, obj) {
  if (!cKey) return obj?.level ?? 0
  return app?.city?.globalCells?.get(cKey)?.level ?? obj?.level ?? 0
}

function getMatchupBonus(attackerType, targetType) {
  if (!attackerType || !targetType) return 0
  return COMBAT.ATTACK_BONUSES?.[attackerType]?.[targetType] ?? 0
}

function isPlayerUnit(target) {
  return PLAYER_UNIT_TYPES.includes(target?.type)
}

export function getDefenseReduction(session, app, targetKey, target) {
  if (!target || target.owner !== 'player' || !targetKey) return 0

  let reduction = 0
  const neighbors = session.getNeighbors?.(targetKey) ?? []
  let adjacentSupport = false
  let adjacentTower = false

  for (const neighborKey of neighbors) {
    const ally = session.objects?.get(neighborKey)
    if (!ally || ally.owner !== 'player') continue
    if (ally.type === 'tower') adjacentTower = true
    else if (neighborKey !== targetKey) adjacentSupport = true
  }

  if (adjacentSupport) reduction += 1
  if (adjacentTower && isPlayerUnit(target)) reduction += 1
  if (isPlayerUnit(target) && target.movedThisTurn === false && typeof target.mpRemaining === 'number' && target.mpRemaining > 0) {
    reduction += 1
  }

  return Math.min(reduction, 2)
}

/**
 * @param {import('../../game/GameSession.js').GameSession} session
 * @param {object} app
 * @param {string} attackerKey
 * @param {object} attacker - game object
 */
export function getAttackDamage(session, app, attackerKey, attacker, targetKey = null, target = null) {
  if (!attacker) return 0
  let damage = 0

  if (typeof attacker.atk === 'number') {
    damage = attacker.atk
  }
  if (attacker.type === 'tower') {
    const biome = getBiomeForCube(session, app, attackerKey)
    damage = BASE_TOWER_DAMAGE + (biome === 'wasteland' ? 1 : 0)
  }

  damage += getMatchupBonus(attacker.type, target?.type)
  damage += attacker.tempAtkBonus ?? 0

  const attackerLevel = getTileLevel(app, attackerKey, attacker)
  const targetLevel = getTileLevel(app, targetKey, target)
  if (attackerLevel > targetLevel) {
    damage += COMBAT.HIGH_GROUND_BONUS
  } else if (targetLevel > attackerLevel) {
    damage -= COMBAT.HIGH_GROUND_BONUS
  }

  if (target?.type === 'tower' && attacker?.type !== 'goblin_brute') {
    damage -= COMBAT.FORTIFIED_TARGET_REDUCTION
  }

  return Math.max(1, Math.round(damage))
}
