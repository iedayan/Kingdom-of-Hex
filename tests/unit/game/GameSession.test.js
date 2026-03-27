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

    it('provides a readable upcoming wave preview', () => {
      const preview = session.getUpcomingWavePreview()
      expect(preview.turn).toBeGreaterThanOrEqual(8)
      expect(preview.plan.units.length).toBeGreaterThan(0)
      expect(preview.summary).toContain(preview.plan.name)
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
      expect(session.resources.gold).toBe(18)
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

    it('supports alternate knowledge victories', () => {
      session.researched = new Set(['archery', 'steel_working', 'currency', 'ballistics'])
      session.addObject('1,0,-1', { type: 'library', owner: 'player', hp: 10 })
      session.addObject('0,1,-1', { type: 'library', owner: 'player', hp: 10 })
      expect(session._checkVictoryConditions()).toBe('knowledge')
    })
  })

  describe('turn reports', () => {
    it('builds an economy report after ending the turn', async () => {
      session.addObject('1,0,-1', { type: 'farm', owner: 'player', hp: 10 })
      session.addObject('0,1,-1', { type: 'market', owner: 'player', hp: 10 })
      session.spawnUnit('-1,0,1', 'scout', 'player')
      session.currentResearch = 'archery'
      vi.spyOn(session._enemyAISystem, 'processEnemyTurn').mockResolvedValue(undefined)

      await session.nextTurn()

      const report = session.getLastTurnReport()
      expect(report.turn).toBe(2)
      expect(report.gross.food).toBe(10)
      expect(report.marketConversions).toBe(1)
      expect(report.marketGoldGained).toBe(18)
      expect(report.upkeepPaid).toBe(2)
      expect(report.net.gold).toBe(20)
      expect(report.net.food).toBe(3)
      expect(report.research?.scienceSpent).toBe(2)
      expect(report.notes.some((note) => note.includes('Markets traded'))).toBe(true)
      expect(report.notes.some((note) => note.includes('Objective cleared'))).toBe(false)
    })

    it('flags starvation turns and low food warnings', async () => {
      session.resources.food = 0
      session.spawnUnit('1,0,-1', 'scout', 'player')
      vi.spyOn(session._enemyAISystem, 'processEnemyTurn').mockResolvedValue(undefined)

      await session.nextTurn()

      const report = session.getLastTurnReport()
      expect(report.starvation).toBe(true)
      expect(report.starvationHits).toBe(1)
      expect(report.warnings.some((warning) => warning.includes('Starvation hit'))).toBe(true)
    })
  })

  describe('strategic telegraphs', () => {
    it('builds deterministic upcoming raid telegraphs from map state', () => {
      app.city.grids.set('0,0', {
        gridRadius: 1,
        globalCenterCube: { q: 0, r: 0 },
        hexTiles: [
          { type: 0, gridX: 0, gridZ: 0 },
          { type: 0, gridX: 1, gridZ: 0 },
          { type: 0, gridX: 2, gridZ: 0 },
        ],
      })

      const first = session.getUpcomingRaidTelegraph(3)
      const second = session.getUpcomingRaidTelegraph(3)
      expect(second).toEqual(first)
      expect(first.turn).toBeGreaterThanOrEqual(8)
      expect(first.spawns.length).toBeGreaterThan(0)
    })

    it('anchors objective markers to relevant board pieces', () => {
      session.turn = 13
      session.addObject('1,0,-1', { type: 'farm', owner: 'player', hp: 10 })
      session.spawnUnit('2,0,-2', 'scout', 'player')

      const markers = session.getObjectiveMarkerData(10)
      const labels = markers.map((marker) => marker.label)

      expect(markers.some((marker) => marker.key === '1,0,-1')).toBe(true)
      expect(labels.some((label) => label.includes('Breadbasket'))).toBe(true)
    })
  })

  describe('decision support', () => {
    it('prioritizes ready units in actionable order', () => {
      session.spawnUnit('0,0,0', 'scout', 'player')
      session.spawnUnit('1,0,-1', 'archer', 'player')
      session.spawnUnit('2,0,-2', 'knight', 'player')

      const scout = session.objects.get('0,0,0')
      const archer = session.objects.get('1,0,-1')
      const knight = session.objects.get('2,0,-2')
      scout.turnCreated = 0
      archer.turnCreated = 0
      knight.turnCreated = 0
      scout.mpRemaining = 0
      archer.mpRemaining = 2
      knight.mpRemaining = 1

      const ordered = session.getActionablePlayerUnits()
      expect(ordered[0].key).toBe('1,0,-1')
      expect(ordered[1].key).toBe('2,0,-2')
      expect(ordered[2].key).toBe('0,0,0')
    })

    it('estimates visible enemy threat on a tile', () => {
      session.addObject('1,0,-1', { type: 'goblin_slinger', owner: 'enemy', atk: 2, range: 2 })
      session.addObject('0,1,-1', { type: 'goblin', owner: 'enemy', atk: 3, range: 1 })
      session.revealed.add('1,0,-1')
      session.revealed.add('0,1,-1')

      const preview = session.getThreatPreview('0,0,0', 'player')
      expect(preview.attackers).toBe(2)
      expect(preview.totalDamage).toBe(5)
    })

    it('warns before ending turn with ready units and food trouble', () => {
      session.resources.food = 1
      session.spawnUnit('0,0,0', 'scout', 'player')
      const scout = session.objects.get('0,0,0')
      scout.turnCreated = 0
      scout.mpRemaining = 2

      const warnings = session.getEndTurnWarnings()
      expect(warnings.some((warning) => warning.includes('still ready'))).toBe(true)
      expect(warnings.some((warning) => warning.includes('Food'))).toBe(true)
    })
  })

  describe('run branches', () => {
    it('offers decree turns at 12 and 24', () => {
      app.showEventModal = vi.fn()
      session.turn = 12
      session._maybeOfferDecree()
      expect(app.showEventModal).toHaveBeenCalledTimes(1)
      session._maybeOfferDecree()
      expect(app.showEventModal).toHaveBeenCalledTimes(1)
    })

    it('tracks multiple victory paths for the HUD', () => {
      session.resources.gold = 500
      session.researched = new Set(['archery', 'steel_working'])
      session.addObject('1,0,-1', { type: 'library', owner: 'player', hp: 10 })
      const tracks = session.getVictoryTracks()
      expect(tracks.map((track) => track.id)).toEqual(['treasury', 'knowledge', 'fortress'])
      expect(tracks.find((track) => track.id === 'treasury').percent).toBeGreaterThan(0)
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
