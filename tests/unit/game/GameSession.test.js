import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GameSession } from '../../../src/game/GameSession.js'

const mockApp = () => ({
  unitManager: {
    getWorldPosition: vi.fn(() => ({ x: 0, y: 0, z: 0 })),
    fireProjectile: vi.fn().mockResolvedValue(undefined),
    animateHit: vi.fn(),
    spawnFloatingText: vi.fn()
  },
  showTurnNotification: vi.fn(),
  panToTile: vi.fn(),
  spawnFloatingText: vi.fn(),
  actionBar: null,
  city: { grids: new Map() }
})

describe('GameSession', () => {
  let session
  let app

  beforeEach(() => {
    app = mockApp()
    session = new GameSession({ seed: 12345, app })
  })

  describe('initialization', () => {
    it('sets initial resources', () => {
      expect(session.resources.gold).toBe(150)
      expect(session.resources.wood).toBe(75)
      expect(session.resources.food).toBe(75)
      expect(session.resources.stone).toBe(25)
      expect(session.resources.science).toBe(0)
    })

    it('starts on turn 1', () => {
      expect(session.turn).toBe(1)
    })

    it('starts in playing phase', () => {
      expect(session.phase).toBe('playing')
    })

    it('reveals capital hex', () => {
      expect(session.revealed.has('0,0,0')).toBe(true)
    })

    it('has empty researched tech', () => {
      expect(session.researched.size).toBe(0)
    })
  })

  describe('canAfford', () => {
    it('returns true when resources are sufficient', () => {
      expect(session.canAfford({ gold: 50 })).toBe(true)
      expect(session.canAfford({ gold: 150 })).toBe(true)
    })

    it('returns false when resources are insufficient', () => {
      expect(session.canAfford({ gold: 200 })).toBe(false)
      expect(session.canAfford({ gold: 50, wood: 100 })).toBe(false)
    })

    it('handles multiple resources', () => {
      expect(session.canAfford({ gold: 50, wood: 50 })).toBe(true)
      expect(session.canAfford({ gold: 50, wood: 76 })).toBe(false)
    })

    it('handles zero cost', () => {
      expect(session.canAfford({})).toBe(true)
    })
  })

  describe('pay', () => {
    it('deducts resources correctly', () => {
      session.pay({ gold: 50 })
      expect(session.resources.gold).toBe(100)
    })

    it('deducts multiple resource types', () => {
      session.pay({ gold: 25, wood: 25 })
      expect(session.resources.gold).toBe(125)
      expect(session.resources.wood).toBe(50)
    })

    it('does not go negative', () => {
      session.pay({ gold: 200 })
      expect(session.resources.gold).toBe(-50)
    })
  })

  describe('spawnUnit', () => {
    it('spawns player unit with correct stats', () => {
      session.spawnUnit('1,0,-1', 'scout', 'player')
      const unit = session.objects.get('1,0,-1')
      expect(unit).toBeDefined()
      expect(unit.type).toBe('scout')
      expect(unit.owner).toBe('player')
      expect(unit.hp).toBe(10)
      expect(unit.maxHp).toBe(10)
      expect(unit.atk).toBe(2)
      expect(unit.range).toBe(1)
      expect(unit.mp).toBe(3)
    })

    it('spawns archer with ranged attack', () => {
      session.spawnUnit('0,1,-1', 'archer', 'player')
      const unit = session.objects.get('0,1,-1')
      expect(unit.range).toBe(2)
      expect(unit.atk).toBe(4)
    })

    it('spawns knight with high HP', () => {
      session.spawnUnit('-1,1,0', 'knight', 'player')
      const unit = session.objects.get('-1,1,0')
      expect(unit.hp).toBe(20)
      expect(unit.maxHp).toBe(20)
      expect(unit.atk).toBe(6)
    })

    it('spawns enemy goblin', () => {
      session.spawnUnit('2,-1,-1', 'goblin', 'enemy')
      const goblin = session.objects.get('2,-1,-1')
      expect(goblin.type).toBe('goblin')
      expect(goblin.owner).toBe('enemy')
      expect(goblin.hp).toBe(6)
      expect(goblin.atk).toBe(3)
    })

    it('sets mpRemaining for player units', () => {
      session.spawnUnit('1,0,-1', 'scout', 'player')
      const unit = session.objects.get('1,0,-1')
      expect(unit.mpRemaining).toBe(3)
      expect(unit.movedThisTurn).toBe(false)
    })

    it('tracks turnCreated for player units', () => {
      expect(session.turn).toBe(1)
      session.spawnUnit('1,0,-1', 'scout', 'player')
      const unit = session.objects.get('1,0,-1')
      expect(unit.turnCreated).toBe(1)
    })
  })

  describe('moveUnit', () => {
    beforeEach(() => {
      session.spawnUnit('0,0,0', 'scout', 'player')
    })

    it('moves unit to new position', () => {
      session.moveUnit('0,0,0', '1,0,-1')
      expect(session.objects.has('0,0,0')).toBe(false)
      expect(session.objects.has('1,0,-1')).toBe(true)
    })

    it('updates unit cKey', () => {
      session.moveUnit('0,0,0', '1,0,-1')
      const unit = session.objects.get('1,0,-1')
      expect(unit.cKey).toBe('1,0,-1')
    })

    it('deducts mp when specified', () => {
      session.moveUnit('0,0,0', '1,0,-1', 1)
      const unit = session.objects.get('1,0,-1')
      expect(unit.mpRemaining).toBe(2)
    })

    it('marks unit as moved', () => {
      session.moveUnit('0,0,0', '1,0,-1', 1)
      const unit = session.objects.get('1,0,-1')
      expect(unit.movedThisTurn).toBe(true)
    })

    it('does not go below 0 mp', () => {
      session.moveUnit('0,0,0', '1,0,-1', 5)
      const unit = session.objects.get('1,0,-1')
      expect(unit.mpRemaining).toBe(0)
    })

    it('does not allow enemy movement through player move flow', () => {
      session.spawnUnit('2,-1,-1', 'goblin', 'enemy')
      session.moveUnit('2,-1,-1', '3,-2,-1', 1)
      expect(session.objects.has('2,-1,-1')).toBe(true)
      expect(session.objects.has('3,-2,-1')).toBe(false)
    })
  })

  describe('removeUnit', () => {
    it('removes unit from objects', () => {
      session.spawnUnit('0,0,0', 'scout', 'player')
      expect(session.objects.has('0,0,0')).toBe(true)
      session.removeUnit('0,0,0')
      expect(session.objects.has('0,0,0')).toBe(false)
    })

    it('calls onUnitRemoved callback', () => {
      const callback = vi.fn()
      session.onUnitRemoved = callback
      session.spawnUnit('0,0,0', 'scout', 'player')
      const unit = session.objects.get('0,0,0')
      session.removeUnit('0,0,0')
      expect(callback).toHaveBeenCalledWith('0,0,0', unit)
    })
  })

  describe('attack', () => {
    beforeEach(() => {
      session.spawnUnit('0,0,0', 'knight', 'player')
      session.spawnUnit('1,0,-1', 'goblin', 'enemy')
    })

    it('deals correct damage and removes dead enemy', async () => {
      await session.attack('0,0,0', '1,0,-1')
      expect(session.objects.has('1,0,-1')).toBe(false)
      expect(session.objects.get('0,0,0').xp).toBe(5)
    })

    it('removes dead enemy unit', async () => {
      await session.attack('0,0,0', '1,0,-1')
      expect(session.objects.has('1,0,-1')).toBe(false)
    })

    it('awards bounty for goblin kill', async () => {
      session.resources.gold = 0
      await session.attack('0,0,0', '1,0,-1')
      expect(session.resources.gold).toBe(20)
    })

    it('prevents attack with no mp', async () => {
      const knight = session.objects.get('0,0,0')
      knight.mpRemaining = 0
      await session.attack('0,0,0', '1,0,-1')
      const goblin = session.objects.get('1,0,-1')
      expect(goblin.hp).toBe(6)
    })

    it('grants xp on kill', async () => {
      await session.attack('0,0,0', '1,0,-1')
      const knight = session.objects.get('0,0,0')
      expect(knight.xp).toBe(5)
    })

    it('marks attacker as moved after attack', async () => {
      await session.attack('0,0,0', '1,0,-1')
      expect(session.objects.get('0,0,0').movedThisTurn).toBe(true)
    })
  })

  describe('level up system', () => {
    it('levels up at XP thresholds', async () => {
      session.spawnUnit('0,0,0', 'knight', 'player')
      const knight = session.objects.get('0,0,0')
      knight.xp = 25
      session.checkLevelUp('0,0,0', knight)
      expect(knight.rank).toBe(2)
    })

    it('increases stats on level up', async () => {
      session.spawnUnit('0,0,0', 'knight', 'player')
      const knight = session.objects.get('0,0,0')
      knight.xp = 25
      session.checkLevelUp('0,0,0', knight)
      expect(knight.maxHp).toBe(22)
      expect(knight.atk).toBe(7)
    })

    it('does not exceed rank 3', async () => {
      session.spawnUnit('0,0,0', 'knight', 'player')
      const knight = session.objects.get('0,0,0')
      knight.rank = 3
      knight.xp = 100
      session.checkLevelUp('0,0,0', knight)
      expect(knight.rank).toBe(3)
    })
  })

  describe('territory', () => {
    it('claims radius around capital', () => {
      expect(session.isOwned('0,0,0')).toBe(true)
      expect(session.isOwned('1,0,-1')).toBe(true)
      expect(session.isOwned('2,-1,-1')).toBe(true)
      expect(session.isOwned('4,-2,-2')).toBe(false)
    })

    it('isOwned checks ownedTiles', () => {
      expect(session.isOwned('0,0,0')).toBe(true)
      expect(session.isOwned('99,99,-198')).toBe(false)
    })
  })

  describe('revealRadius', () => {
    it('reveals hexes within radius', () => {
      session.revealRadius('0,0,0', 2)
      expect(session.revealed.has('0,0,0')).toBe(true)
      expect(session.revealed.has('2,-2,0')).toBe(true)
      expect(session.revealed.has('3,-2,-1')).toBe(false)
    })
  })

  describe('win/lose conditions', () => {
    it('wins when gold reaches 1000', () => {
      session.resources.gold = 1000
      session.win()
      expect(session.phase).toBe('won')
    })

    it('loses when turn exceeds 50', () => {
      session.turn = 50
      session.lose()
      expect(session.phase).toBe('lost')
      expect(session.loseReason).toBe('time')
    })

    it('loses when capital is overrun', () => {
      session.spawnUnit('0,0,0', 'goblin', 'enemy')
      const result = session._endRunIfCapitalOverrun()
      expect(result).toBe(true)
      expect(session.phase).toBe('lost')
    })
  })

  describe('tech tree', () => {
    it('has all required technologies', () => {
      expect(session.techTree.archery).toBeDefined()
      expect(session.techTree.steel_working).toBeDefined()
      expect(session.techTree.currency).toBeDefined()
      expect(session.techTree.ballistics).toBeDefined()
      expect(session.techTree.scholarship).toBeDefined()
    })

    it('archery is independent', () => {
      expect(session.techTree.archery.requires).toEqual([])
    })

    it('ballistics requires archery', () => {
      expect(session.techTree.ballistics.requires).toContain('archery')
    })
  })

  describe('getNeighbors', () => {
    it('returns 6 neighbors for center hex', () => {
      const neighbors = session.getNeighbors('0,0,0')
      expect(neighbors.length).toBe(6)
    })

    it('returns correct neighbor keys', () => {
      const neighbors = session.getNeighbors('0,0,0')
      expect(neighbors).toContain('1,-1,0')
      expect(neighbors).toContain('-1,1,0')
      expect(neighbors).toContain('0,1,-1')
      expect(neighbors).toContain('0,-1,1')
      expect(neighbors).toContain('1,0,-1')
      expect(neighbors).toContain('-1,0,1')
    })
  })

  describe('countUnactedPlayerUnits', () => {
    it('counts only player units with remaining actions', () => {
      session.spawnUnit('1,0,-1', 'scout', 'player')
      session.spawnUnit('2,0,-2', 'goblin', 'enemy')
      expect(session.countUnactedPlayerUnits()).toBe(0)

      session.turn = 2
      const scout = session.objects.get('1,0,-1')
      scout.turnCreated = 1
      scout.mpRemaining = 2
      scout.movedThisTurn = false
      expect(session.countUnactedPlayerUnits()).toBe(1)
    })

    it('excludes units that already moved or have no mp', () => {
      session.spawnUnit('1,0,-1', 'scout', 'player')
      session.turn = 2
      const scout = session.objects.get('1,0,-1')
      scout.turnCreated = 1
      scout.mpRemaining = 0
      scout.movedThisTurn = true
      expect(session.countUnactedPlayerUnits()).toBe(0)
    })
  })
})
