/**
 * Bridge cube keys (game logic) to grid keys (map / biome lookup).
 */

/** @param {object} app - App with city.globalCells */
export function getGridKeyForCube(app, cKey) {
  return app?.city?.globalCells?.get(cKey)?.gridKey ?? null
}

/** @param {import('../../game/GameSession.js').GameSession} session */
export function getBiomeForCube(session, app, cKey) {
  const gk = getGridKeyForCube(app, cKey)
  return gk ? session.getBiome(gk) : 'temperate'
}
