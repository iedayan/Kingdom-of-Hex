/**
 * Performance benchmarks for Kingdom of Hex
 * 
 * Run with: npm run benchmark
 */

const UNIT_TYPES = ['scout', 'archer', 'knight', 'goblin']
const BUILDING_TYPES = ['lumberjack', 'farm', 'mine', 'market', 'tower', 'library']

async function runBenchmarks() {
  console.log('🏰 Kingdom of Hex Performance Benchmarks\n')
  console.log('=' .repeat(50))

  // Simulate game session operations
  benchmark('GameSession initialization', () => {
    const session = createMockSession()
    return session
  })

  benchmark('Turn processing (100 objects)', () => {
    const session = createMockSession(100)
    processTurn(session)
  })

  benchmark('Unit spawning (1000 iterations)', () => {
    const session = createMockSession()
    for (let i = 0; i < 1000; i++) {
      session.spawnUnit(`${i},0,${-i}`, 'scout', 'player')
    }
  })

  benchmark('Combat resolution (100 iterations)', () => {
    const session = createMockSession()
    session.spawnUnit('0,0,0', 'scout', 'player')
    session.spawnUnit('1,0,-1', 'goblin', 'enemy')
    for (let i = 0; i < 100; i++) {
      resolveCombat(session)
    }
  })

  benchmark('Serialize game state', () => {
    const session = createMockSession(50)
    session.serialize()
  })

  benchmark('Deserialize game state', () => {
    const session = createMockSession(50)
    const data = session.serialize()
    deserializeSession(data)
  })

  benchmark('Path finding (100 iterations)', () => {
    for (let i = 0; i < 100; i++) {
      findPath(0, 0, 5, 5)
    }
  })

  benchmark('Hex distance calculation (10000 iterations)', () => {
    for (let i = 0; i < 10000; i++) {
      hexDistance(i % 20 - 10, i % 15 - 7)
    }
  })

  console.log('\n' + '=' .repeat(50))
  console.log('Benchmarks complete!')
}

// Mock implementations for benchmarks

function createMockSession(objectCount = 0) {
  return {
    seed: 12345,
    turn: 1,
    phase: 'playing',
    resources: { gold: 100, wood: 50, food: 50, stone: 0, science: 0 },
    objects: new Map(),
    revealed: new Set(),
    ownedTiles: new Set(),
    biomes: new Map(),
    spawnUnit(cKey, type, owner) {
      const stats = {
        scout: { hp: 10, maxHp: 10, atk: 2, range: 1, mp: 3 },
        archer: { hp: 8, maxHp: 8, atk: 4, range: 2, mp: 2 },
        knight: { hp: 20, maxHp: 20, atk: 6, range: 1, mp: 2 },
        goblin: { hp: 6, maxHp: 6, atk: 3, range: 1, mp: 1 },
      }
      this.objects.set(cKey, { ...stats[type], type, owner, cKey })
    },
    serialize() {
      return {
        seed: this.seed,
        turn: this.turn,
        phase: this.phase,
        resources: { ...this.resources },
        objects: Array.from(this.objects.entries()),
        revealed: [...this.revealed],
        ownedTiles: [...this.ownedTiles],
        biomes: Array.from(this.biomes.entries()),
      }
    },
  }
}

function processTurn(session) {
  session.turn++
  // Simulate income calculation
  for (const [cKey, obj] of session.objects) {
    if (obj.owner === 'player') {
      session.resources.gold += 5
    }
  }
}

function resolveCombat(session) {
  const units = Array.from(session.objects.values())
  if (units.length >= 2) {
    units[0].hp -= units[1].atk
    units[1].hp -= units[0].atk
  }
}

function deserializeSession(data) {
  return {
    ...data,
    objects: new Map(data.objects),
    revealed: new Set(data.revealed),
    ownedTiles: new Set(data.ownedTiles),
    biomes: new Map(data.biomes),
  }
}

function findPath(x1, y1, x2, y2) {
  // Simplified A* for benchmarking
  const open = [{ x: x1, y: y1, g: 0, h: 0 }]
  const closed = new Set()
  
  while (open.length > 0) {
    open.sort((a, b) => (a.g + a.h) - (b.g + b.h))
    const current = open.shift()
    
    if (current.x === x2 && current.y === y2) {
      return true
    }
    
    closed.add(`${current.x},${current.y}`)
    
    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ]
    
    for (const neighbor of neighbors) {
      const key = `${neighbor.x},${neighbor.y}`
      if (!closed.has(key)) {
        open.push({
          ...neighbor,
          g: current.g + 1,
          h: Math.abs(neighbor.x - x2) + Math.abs(neighbor.y - y2),
        })
      }
    }
  }
  return false
}

function hexDistance(q1, r1) {
  const s1 = -q1 - r1
  const s2 = -0 - 0
  return Math.max(Math.abs(q1), Math.abs(r1), Math.abs(s1))
}

function benchmark(name, fn) {
  const iterations = 100
  const start = performance.now()
  
  for (let i = 0; i < iterations; i++) {
    fn()
  }
  
  const elapsed = performance.now() - start
  const avg = elapsed / iterations
  
  console.log(`${name}:`)
  console.log(`  ${elapsed.toFixed(2)}ms total (${iterations} iterations)`)
  console.log(`  ${avg.toFixed(4)}ms average per iteration`)
}

// Run if executed directly
if (typeof process !== 'undefined' && process.argv[1]?.includes('benchmark')) {
  runBenchmarks()
}

export { runBenchmarks, benchmark }
