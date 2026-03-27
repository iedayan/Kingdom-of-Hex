/** Player structures — HP for combat clarity (goblins can destroy them). */
const STATS = {
  lumberjack: { hp: 12, maxHp: 12 },
  farm: { hp: 10, maxHp: 10 },
  mine: { hp: 14, maxHp: 14 },
  market: { hp: 16, maxHp: 16 },
  tower: { hp: 28, maxHp: 28 },
  library: { hp: 12, maxHp: 12 },
}

const DEFAULT = { hp: 12, maxHp: 12 }

/**
 * @param {string} type - building id
 * @param {string} [owner]
 * @param {number} [level] - tile level for VFX alignment
 */
export function createPlayerBuilding(type, owner = 'player', level = 0) {
  const s = STATS[type] || DEFAULT
  return { type, owner, hp: s.hp, maxHp: s.maxHp, level }
}
