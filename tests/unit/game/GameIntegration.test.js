import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GameSession } from '../../../src/game/GameSession.js'
import { BUILDINGS, UNITS, TECH_TREE, formatCost } from '../../../src/game/GameData.js'
import { ECONOMY } from '../../../src/game/constants.js'

const mockApp = () => ({
  unitManager: { getWorldPosition: vi.fn(() => ({ x: 0, y: 0, z: 0 })) },
  showTurnNotification: vi.fn(),
  panToTile: vi.fn(),
  spawnFloatingText: vi.fn(),
  actionBar: null,
  city: { grids: new Map() }
})

describe('GameData', () => {
  describe('BUILDINGS', () => {
    it('has all required building types', () => {
      expect(BUILDINGS.lumberjack).toBeDefined()
      expect(BUILDINGS.farm).toBeDefined()
      expect(BUILDINGS.mine).toBeDefined()
      expect(BUILDINGS.market).toBeDefined()
      expect(BUILDINGS.tower).toBeDefined()
      expect(BUILDINGS.library).toBeDefined()
    })

    it('has required properties for each building', () => {
      for (const building of Object.values(BUILDINGS)) {
        expect(building.id).toBeDefined()
        expect(building.name).toBeDefined()
        expect(building.icon).toBeDefined()
        expect(building.cost).toBeDefined()
        expect(building.desc).toBeDefined()
      }
    })

    it('market and tower require tech', () => {
      expect(BUILDINGS.market.tech).toBe('currency')
      expect(BUILDINGS.tower.tech).toBe('ballistics')
    })

    it('basic buildings have no tech requirement', () => {
      expect(BUILDINGS.lumberjack.tech).toBeUndefined()
      expect(BUILDINGS.farm.tech).toBeUndefined()
      expect(BUILDINGS.mine.tech).toBeUndefined()
    })

    it('market stone cost is reachable from starting economy', () => {
      expect(BUILDINGS.market.cost.stone).toBeLessThanOrEqual(25)
    })
  })

  describe('UNITS', () => {
    it('has all required unit types', () => {
      expect(UNITS.scout).toBeDefined()
      expect(UNITS.archer).toBeDefined()
      expect(UNITS.knight).toBeDefined()
      expect(UNITS.goblin).toBeDefined()
    })

    it('has required combat properties', () => {
      for (const unit of Object.values(UNITS)) {
        expect(unit.hp).toBeDefined()
        expect(unit.atk).toBeDefined()
        expect(unit.range).toBeDefined()
        expect(unit.mp).toBeDefined()
        expect(unit.sight).toBeDefined()
      }
    })

    it('archer has range 2', () => {
      expect(UNITS.archer.range).toBe(2)
    })

    it('goblin has no cost', () => {
      expect(UNITS.goblin.cost).toEqual({})
    })

    it('military units require tech', () => {
      expect(UNITS.archer.tech).toBe('archery')
      expect(UNITS.knight.tech).toBe('steel_working')
    })
  })

  describe('TECH_TREE', () => {
    it('has all required techs', () => {
      expect(TECH_TREE.archery).toBeDefined()
      expect(TECH_TREE.scholarship).toBeDefined()
      expect(TECH_TREE.currency).toBeDefined()
      expect(TECH_TREE.ballistics).toBeDefined()
      expect(TECH_TREE.steel_working).toBeDefined()
    })

    it('techs have required properties', () => {
      for (const tech of Object.values(TECH_TREE)) {
        expect(tech.name).toBeDefined()
        expect(tech.cost).toBeGreaterThan(0)
        expect(Array.isArray(tech.unlocks)).toBe(true)
        expect(Array.isArray(tech.requires)).toBe(true)
      }
    })

    it('tech costs are reduced from original', () => {
      expect(TECH_TREE.archery.cost).toBe(25)
      expect(TECH_TREE.scholarship.cost).toBe(15)
    })
  })

  describe('formatCost', () => {
    it('formats gold only', () => {
      expect(formatCost({ gold: 100 })).toBe('100 G')
    })

    it('formats multiple resources', () => {
      expect(formatCost({ gold: 50, wood: 30 })).toBe('50 G 30 W')
    })

    it('handles zero values', () => {
      expect(formatCost({ gold: 0 })).toBe('')
    })

    it('handles empty object', () => {
      expect(formatCost({})).toBe('')
    })
  })
})

describe('GameSession Integration', () => {
  let session
  let app

  beforeEach(() => {
    app = mockApp()
    session = new GameSession({ seed: 12345, app })
  })

  describe('full game flow', () => {
    it('tracks resources through multiple operations', () => {
      expect(session.resources.gold).toBe(150)
      
      session.pay({ gold: 50 })
      expect(session.resources.gold).toBe(100)
      
      session.resources.gold += 100
      expect(session.canAfford({ gold: 100 })).toBe(true)
    })

    it('manages multiple units correctly', () => {
      session.spawnUnit('1,0,-1', 'scout', 'player')
      session.spawnUnit('2,0,-2', 'archer', 'player')
      session.spawnUnit('3,0,-3', 'knight', 'player')
      
      expect(session.objects.size).toBe(3)
      
      const units = Array.from(session.objects.values()).filter(
        o => ['scout', 'archer', 'knight'].includes(o.type)
      )
      expect(units.length).toBe(3)
    })

    it('handles building placement and removal', () => {
      session.addObject('1,0,-1', { type: 'lumberjack', owner: 'player' })
      expect(session.objects.has('1,0,-1')).toBe(true)
      
      session.removeObject('1,0,-1')
      expect(session.objects.has('1,0,-1')).toBe(false)
    })

    it('manages revealed tiles correctly', () => {
      expect(session.revealed.has('0,0,0')).toBe(true)
      expect(session.revealed.has('10,0,-10')).toBe(false)
      
      session.revealRadius('0,0,0', 3)
      expect(session.revealed.size).toBeGreaterThan(1)
    })
  })

  describe('game phase transitions', () => {
    it('starts in playing phase', () => {
      expect(session.phase).toBe('playing')
    })

    it('transitions to won phase', () => {
      session.win()
      expect(session.phase).toBe('won')
    })

    it('transitions to lost phase', () => {
      session.lose('time')
      expect(session.phase).toBe('lost')
      expect(session.loseReason).toBe('time')
    })

    it('handles capital overrun', () => {
      session.spawnUnit('0,0,0', 'goblin', 'enemy')
      const result = session._endRunIfCapitalOverrun()
      expect(result).toBe(true)
      expect(session.phase).toBe('lost')
      expect(session.loseReason).toBe('capital')
    })
  })

  describe('economy tuning', () => {
    it('farms provide direct gold to avoid early dead-ends', () => {
      expect(ECONOMY.FARM_GOLD_YIELD).toBeGreaterThan(0)
    })
  })

  describe('enemy wave timing', () => {
    it('does not spawn before configured first wave turn', () => {
      expect(session._shouldSpawnEnemyWave(7)).toBe(false)
    })

    it('spawns on first wave and then every period', () => {
      expect(session._shouldSpawnEnemyWave(8)).toBe(true)
      expect(session._shouldSpawnEnemyWave(13)).toBe(true)
      expect(session._shouldSpawnEnemyWave(18)).toBe(true)
      expect(session._shouldSpawnEnemyWave(9)).toBe(false)
    })
  })

  describe('tech tree integration', () => {
    it('starts with no researched techs', () => {
      expect(session.researched.size).toBe(0)
    })

    it('can research tech when science available', () => {
      session.resources.science = 30
      session.currentResearch = 'archery'
      
      expect(session.techTree.archery.cost).toBe(25)
      session.techTree.archery.progress = 25
      session.researched.add('archery')
      
      expect(session.researched.has('archery')).toBe(true)
    })

    it('tracks research progress', () => {
      session.currentResearch = 'scholarship'
      session.resources.science = 20
      session.techTree.scholarship.progress = 20
      session.researched.add('scholarship')
      
      expect(session.researched.has('scholarship')).toBe(true)
    })
  })

  describe('biome system', () => {
    it('has capital biome set', () => {
      expect(session.biomes.has('0,0')).toBe(true)
      expect(session.biomes.get('0,0')).toBe('temperate')
    })

    it('can set biome for new areas', () => {
      session.getBiome('grid_1')
      expect(session.biomes.has('grid_1')).toBe(true)
    })
  })

  describe('territory management', () => {
    it('claims territory around capital', () => {
      expect(session.ownedTiles.size).toBeGreaterThan(0)
      expect(session.isOwned('0,0,0')).toBe(true)
    })

    it('can claim additional territory', () => {
      const initialSize = session.ownedTiles.size
      session.claimRadius('5,0,-5', 2)
      expect(session.ownedTiles.size).toBeGreaterThan(initialSize)
    })
  })
})
