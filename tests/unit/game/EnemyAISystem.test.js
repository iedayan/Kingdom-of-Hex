import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EnemyAISystem } from '../../../src/game/EnemyAISystem.js'
import { CombatSystem } from '../../../src/game/CombatSystem.js'
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

describe('EnemyAISystem', () => {
  let session
  let app
  let combat
  let ai

  beforeEach(() => {
    app = mockApp()
    session = new GameSession({ seed: 12345, app })
    combat = new CombatSystem(session, app)
    ai = new EnemyAISystem(session, app, combat)
    vi.clearAllMocks()
  })

  describe('_getPlayerTowerKeys', () => {
    it('returns empty array with no towers', () => {
      expect(ai._getPlayerTowerKeys()).toEqual([])
    })

    it('returns keys for player towers', () => {
      session.addObject('1,0,-1', { type: 'tower', owner: 'player' })
      const keys = ai._getPlayerTowerKeys()
      expect(keys).toContain('1,0,-1')
    })

    it('excludes enemy towers', () => {
      session.addObject('1,0,-1', { type: 'tower', owner: 'enemy' })
      expect(ai._getPlayerTowerKeys()).toEqual([])
    })
  })

  describe('_buildTowerNeighborSet', () => {
    it('returns empty set with no towers', () => {
      const set = ai._buildTowerNeighborSet([])
      expect(set.size).toBe(0)
    })

    it('includes neighbor keys of towers', () => {
      session.addObject('0,0,0', { type: 'tower', owner: 'player' })
      const set = ai._buildTowerNeighborSet(['0,0,0'])
      expect(set.size).toBe(6)
    })
  })

  describe('_getAdjacentTargets', () => {
    it('returns empty array with no adjacent targets', () => {
      session.spawnUnit('0,0,0', 'goblin', 'enemy')
      expect(ai._getAdjacentTargets(['1,0,-1'])).toEqual([])
    })

    it('returns adjacent player objects', () => {
      session.spawnUnit('0,0,0', 'goblin', 'enemy')
      session.spawnUnit('1,0,-1', 'scout', 'player')
      const targets = ai._getAdjacentTargets(['1,0,-1'])
      expect(targets).toContain('1,0,-1')
    })

    it('excludes enemy objects', () => {
      session.spawnUnit('0,0,0', 'goblin', 'enemy')
      session.spawnUnit('1,0,-1', 'goblin', 'enemy')
      expect(ai._getAdjacentTargets(['1,0,-1'])).toEqual([])
    })
  })

  describe('_chooseTarget', () => {
    it('prioritizes lethal targets over tougher structures', () => {
      session.addObject('1,0,-1', { type: 'tower', owner: 'player', hp: 28, maxHp: 28 })
      session.addObject('0,1,-1', { type: 'scout', owner: 'player', hp: 2, maxHp: 10 })
      const target = ai._chooseTarget(['1,0,-1', '0,1,-1'], '0,0,0', { type: 'goblin', atk: 3 })
      expect(target).toBe('0,1,-1')
    })

    it('prioritizes towers over other targets', () => {
      session.addObject('1,0,-1', { type: 'tower', owner: 'player', hp: 50 })
      session.addObject('0,1,-1', { type: 'scout', owner: 'player', hp: 10 })
      const target = ai._chooseTarget(['1,0,-1', '0,1,-1'])
      expect(target).toBe('1,0,-1')
    })

    it('prioritizes closer to capital', () => {
      session.addObject('5,0,-5', { type: 'scout', owner: 'player', hp: 10 })
      session.addObject('1,0,-1', { type: 'scout', owner: 'player', hp: 10 })
      const target = ai._chooseTarget(['5,0,-5', '1,0,-1'])
      expect(target).toBe('1,0,-1')
    })

    it('prioritizes lower HP when same distance', () => {
      session.addObject('1,0,-1', { type: 'scout', owner: 'player', hp: 5 })
      session.addObject('0,1,-1', { type: 'scout', owner: 'player', hp: 10 })
      const target = ai._chooseTarget(['1,0,-1', '0,1,-1'])
      expect(target).toBe('1,0,-1')
    })
  })

  describe('_chooseMove', () => {
    it('returns null with no valid moves', () => {
      session.spawnUnit('0,0,0', 'goblin', 'enemy')
      session.addObject('1,0,-1', { type: 'scout', owner: 'player' })
      const move = ai._chooseMove(['1,0,-1'], new Set())
      expect(move).toBeNull()
    })

    it('prefers moves closer to capital', () => {
      session.spawnUnit('3,0,-3', 'goblin', 'enemy')
      const move = ai._chooseMove(['2,0,-2', '4,0,-4'], new Set())
      expect(move).toBe('2,0,-2')
    })

    it('avoids tower neighbors', () => {
      session.spawnUnit('2,0,-2', 'goblin', 'enemy')
      session.addObject('1,0,-1', { type: 'tower', owner: 'player' })
      const neighbors = session.getNeighbors('2,0,-2')
      const move = ai._chooseMove(neighbors, new Set(['1,0,-1']))
      expect(move).not.toBe('1,0,-1')
    })

    it('returns valid move even with threats', () => {
      session.spawnUnit('2,0,-2', 'goblin', 'enemy')
      const neighbors = session.getNeighbors('2,0,-2')
      const move = ai._chooseMove(neighbors, new Set())
      expect(move).toBeDefined()
    })

    it('chooses moves deterministically for the same board state', () => {
      session.spawnUnit('2,0,-2', 'goblin_raider', 'enemy')
      session.addObject('1,0,-1', { type: 'farm', owner: 'player', hp: 10 })
      const neighbors = session.getNeighbors('2,0,-2')
      const first = ai._chooseMove(neighbors, new Set(), '2,0,-2', { type: 'goblin_raider', range: 1 })
      const second = ai._chooseMove(neighbors, new Set(), '2,0,-2', { type: 'goblin_raider', range: 1 })
      expect(second).toBe(first)
    })
  })

  describe('_countAdjacentPlayer', () => {
    it('returns 0 with no adjacent players', () => {
      expect(ai._countAdjacentPlayer('0,0,0')).toBe(0)
    })

    it('counts adjacent player objects', () => {
      session.addObject('1,0,-1', { type: 'scout', owner: 'player' })
      expect(ai._countAdjacentPlayer('0,0,0')).toBe(1)
    })

    it('excludes enemy objects', () => {
      session.addObject('1,0,-1', { type: 'goblin', owner: 'enemy' })
      expect(ai._countAdjacentPlayer('0,0,0')).toBe(0)
    })
  })

  describe('_checkCapitalOverrun', () => {
    it('returns false when capital is not overrun', () => {
      expect(ai._checkCapitalOverrun()).toBe(false)
    })

    it('triggers lose when enemy on capital', () => {
      session.spawnUnit('0,0,0', 'goblin', 'enemy')
      expect(ai._checkCapitalOverrun()).toBe(true)
      expect(session.phase).toBe('lost')
      expect(session.loseReason).toBe('capital')
    })
  })

  describe('camera behavior', () => {
    it('does not force camera pan during enemy turns', async () => {
      session.spawnUnit('2,0,-2', 'goblin', 'enemy')
      session.revealed.add('2,0,-2')
      const delaySpy = vi.spyOn(ai, '_delay').mockResolvedValue(undefined)

      await ai.processEnemyTurn()

      expect(app.panToTile).not.toHaveBeenCalled()
      delaySpy.mockRestore()
    })
  })
})
