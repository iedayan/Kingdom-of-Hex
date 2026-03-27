/**
 * Central utility for Cube Coordinate math (q, r, s).
 * Prevents brittle string splitting and centralizes topology logic.
 */
export const HexUtils = {
  /** Convert "q,r,s" string to {q,r,s} object */
  parse: (key) => {
    const parts = key.split(',').map(Number)
    return { q: parts[0], r: parts[1], s: parts[2] }
  },

  /** Convert {q,r,s} to "q,r,s" string */
  key: (q, r, s) => {
    if (typeof q === 'object') return `${q.q},${q.r},${q.s}`
    return `${q},${r},${s}`
  },

  /** Calculate Manhattan distance between two hexes */
  distance: (aKey, bKey) => {
    const a = HexUtils.parse(aKey)
    const b = HexUtils.parse(bKey)
    return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.s - b.s)) / 2
  },

  /** Get the 6 neighbor keys of a hex */
  getNeighbors: (key) => {
    const { q, r, s } = HexUtils.parse(key)
    const dirs = [
      { dq: 1, dr: -1, ds: 0 }, { dq: 1, dr: 0, ds: -1 }, { dq: 0, dr: 1, ds: -1 },
      { dq: -1, dr: 1, ds: 0 }, { dq: -1, dr: 0, ds: 1 }, { dq: 0, dr: -1, ds: 1 }
    ]
    return dirs.map(d => `${q + d.dq},${r + d.dr},${s + d.ds}`)
  },

  /** Find the neighbor closest to a target destination */
  getStepTowards: (startKey, targetKey) => {
    const neighbors = HexUtils.getNeighbors(startKey)
    const target = HexUtils.parse(targetKey)
    
    let minIndex = 0
    for (let i = 1; i < neighbors.length; i++) {
      const pa = HexUtils.parse(neighbors[i]), pb = HexUtils.parse(neighbors[minIndex])
      const distA = Math.abs(pa.q - target.q) + Math.abs(pa.r - target.r) + Math.abs(pa.s - target.s)
      const distB = Math.abs(pb.q - target.q) + Math.abs(pb.r - target.r) + Math.abs(pb.s - target.s)
      if (distA < distB) minIndex = i
    }
    return neighbors[minIndex]
  },

  /** A* Pathfinding on the hex grid */
  findPath: (startKey, targetKey, app) => {
    const start = HexUtils.parse(startKey)
    const goal = HexUtils.parse(targetKey)
    
    if (!app.city.globalCells.has(targetKey)) return null // Cannot move to void

    const frontier = [{ key: startKey, priority: 0 }]
    const cameFrom = new Map()
    const costSoFar = new Map()
    
    cameFrom.set(startKey, null)
    costSoFar.set(startKey, 0)

    while (frontier.length > 0) {
      let minIndex = 0
      for (let i = 1; i < frontier.length; i++) {
        if (frontier[i].priority < frontier[minIndex].priority) minIndex = i
      }
      const current = frontier[minIndex].key
      
      // Remove current from frontier
      frontier[minIndex] = frontier[frontier.length - 1]
      frontier.pop()

      if (current === targetKey) break

      const neighbors = HexUtils.getNeighbors(current)
      for (const next of neighbors) {
        // Must be a valid hex in the world
        const cell = app.city.globalCells.get(next)
        if (!cell) continue
        
        // Cannot move through enemies or buildings (unless it's our target to attack)
        if (next !== targetKey && app.game.objects.has(next)) {
           const obj = app.game.objects.get(next)
           // Allow moving through own units, but not enemy or buildings
           if (obj.owner !== 'player' || !['scout','archer','knight'].includes(obj.type)) continue
        }

        // Terrain cost: Hills/Forest cost more, Water is impassable
        // Note: For now, we assume simple costs based on level
        const terrainCost = cell.level >= 1 ? 2 : 1
        // (Optional: add river crossing logic later)

        const newCost = costSoFar.get(current) + terrainCost
        
        if (!costSoFar.has(next) || newCost < costSoFar.get(next)) {
          costSoFar.set(next, newCost)
          const priority = newCost + HexUtils.distance(next, targetKey)
          frontier.push({ key: next, priority })
          cameFrom.set(next, current)
        }
      }
    }

    if (!cameFrom.has(targetKey)) return null // No path found

    // Reconstruct path
    let current = targetKey
    const path = []
    while (current !== startKey) {
      path.push(current)
      current = cameFrom.get(current)
    }
    path.reverse()
    return { path, cost: costSoFar.get(targetKey) }
  }
}
