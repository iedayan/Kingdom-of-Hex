import { describe, it, expect } from 'vitest'
import { 
  GOBLIN_FIRST_WAVE_TURN, 
  GOBLIN_WAVE_PERIOD,
  shouldSpawnGoblinWave, 
  goblinCountForWave,
  collectEmptyGrassTiles,
  pickGoblinSpawnTile
} from '../../../../src/gameplay/map-rules/enemyWaves.js'
import { HexUtils } from '../../../../src/game/HexUtils.js'

describe('enemyWaves', () => {
  describe('shouldSpawnGoblinWave', () => {
    it('does not spawn before first wave turn', () => {
      expect(shouldSpawnGoblinWave(1)).toBe(false)
      expect(shouldSpawnGoblinWave(2)).toBe(false)
    })

    it('spawns on first wave turn', () => {
      expect(shouldSpawnGoblinWave(GOBLIN_FIRST_WAVE_TURN)).toBe(true)
    })

    it('spawns every wave period after first', () => {
      expect(shouldSpawnGoblinWave(GOBLIN_FIRST_WAVE_TURN + GOBLIN_WAVE_PERIOD)).toBe(true)
      expect(shouldSpawnGoblinWave(GOBLIN_FIRST_WAVE_TURN + GOBLIN_WAVE_PERIOD * 2)).toBe(true)
    })

    it('does not spawn between wave turns', () => {
      expect(shouldSpawnGoblinWave(GOBLIN_FIRST_WAVE_TURN + 1)).toBe(false)
      expect(shouldSpawnGoblinWave(GOBLIN_FIRST_WAVE_TURN + GOBLIN_WAVE_PERIOD - 1)).toBe(false)
    })
  })

  describe('goblinCountForWave', () => {
    it('returns 1 for early waves', () => {
      const count = goblinCountForWave(5)
      expect(count).toBe(1)
    })

    it('can return 1-2 for mid waves', () => {
      const counts = new Set()
      for (let i = 0; i < 100; i++) {
        counts.add(goblinCountForWave(15))
      }
      expect(counts.has(1) || counts.has(2)).toBe(true)
    })

    it('can return up to 3 for late waves', () => {
      let hasThree = false
      for (let i = 0; i < 1000; i++) {
        if (goblinCountForWave(30) === 3) {
          hasThree = true
          break
        }
      }
      expect(hasThree).toBe(true)
    })

    it('never exceeds 3', () => {
      for (let turn = 1; turn < 100; turn++) {
        expect(goblinCountForWave(turn)).toBeLessThanOrEqual(3)
      }
    })
  })

  describe('collectEmptyGrassTiles', () => {
    it('returns empty array when no grids', () => {
      const tiles = collectEmptyGrassTiles({}, new Map())
      expect(tiles).toEqual([])
    })

    it('returns empty array for invalid city', () => {
      expect(collectEmptyGrassTiles(null, new Map())).toEqual([])
      expect(collectEmptyGrassTiles(undefined, new Map())).toEqual([])
    })

    it('excludes capital hex', () => {
      const mockGrid = {
        hexTiles: [{ type: 0, gridX: 0, gridZ: 0 }],
        gridRadius: 0,
        globalCenterCube: { q: 0, r: 0 }
      }
      const city = { grids: new Map([[0, mockGrid]]) }
      const objects = new Map()
      const tiles = collectEmptyGrassTiles(city, objects)
      expect(tiles.some(t => t.key === '0,0,0')).toBe(false)
    })

    it('excludes occupied hexes', () => {
      const mockGrid = {
        hexTiles: [
          { type: 0, gridX: 0, gridZ: 0 },
          { type: 0, gridX: 1, gridZ: 0 },
          { type: 0, gridX: 2, gridZ: 0 }
        ],
        gridRadius: 5,
        globalCenterCube: { q: 0, r: 0 }
      }
      const city = { grids: new Map([[0, mockGrid]]) }
      const objects = new Map([['0,0,0', { type: 'scout' }]])
      const tiles = collectEmptyGrassTiles(city, objects)
      expect(tiles.some(t => t.key === '0,0,0')).toBe(false)
    })
  })

  describe('pickGoblinSpawnTile', () => {
    const mockSession = {
      objects: new Map([['0,0,0', { owner: 'player' }]])
    }

    it('returns null for empty tiles', () => {
      expect(pickGoblinSpawnTile([], mockSession)).toBeNull()
    })

    it('returns a tile when available', () => {
      const tiles = [{ key: '3,0,-3', q: 3, r: 0, s: -3 }]
      const result = pickGoblinSpawnTile(tiles, mockSession)
      expect(result).toBeDefined()
      expect(result.key).toBe('3,0,-3')
    })

    it('returns random tile when no player units', () => {
      const emptySession = { objects: new Map() }
      const tiles = [
        { key: '1,0,-1', q: 1, r: 0, s: -1 },
        { key: '2,0,-2', q: 2, r: 0, s: -2 }
      ]
      const result = pickGoblinSpawnTile(tiles, emptySession)
      expect(tiles.some(t => t.key === result.key)).toBe(true)
    })
  })
})
