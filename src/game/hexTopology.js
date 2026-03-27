import { CUBE_DIRS, cubeKey, parseCubeKey } from '../hexmap/HexWFCCore.js'

/**
 * Cube-axial neighbor keys for game logic (matches WFC / globalCells).
 * @param {string} cKey "q,r,s"
 * @returns {string[]}
 */
export function getCubeNeighborKeys(cKey) {
  const { q, r, s } = parseCubeKey(cKey)
  return CUBE_DIRS.map(({ dq, dr, ds }) => cubeKey(q + dq, r + dr, s + ds))
}
