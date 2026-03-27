import { describe, it, expect, vi, beforeEach } from 'vitest'
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

describe('CombatSystem', () => {
  let session
  let app
  let combat

  beforeEach(() => {
    app = mockApp()
    session = new GameSession({ seed: 12345, app })
    combat = session._combatSystem = new CombatSystem(session, app)
  })

  describe('attack', () => {
    it('deals attacker ATK as damage', async () => {
      session.spawnUnit('0,0,0', 'knight', 'player')
      session.spawnUnit('1,0,-1', 'goblin', 'enemy')
      await combat.attack('0,0,0', '1,0,-1')
      expect(session.objects.has('1,0,-1')).toBe(false)
    })

    it('prevents player attack with no MP', async () => {
      session.spawnUnit('0,0,0', 'knight', 'player')
      session.spawnUnit('1,0,-1', 'goblin', 'enemy')
      const knight = session.objects.get('0,0,0')
      knight.mpRemaining = 0
      await combat.attack('0,0,0', '1,0,-1')
      const goblin = session.objects.get('1,0,-1')
      expect(goblin.hp).toBe(6)
    })

    it('consumes all MP on attack', async () => {
      session.spawnUnit('0,0,0', 'knight', 'player')
      session.spawnUnit('1,0,-1', 'goblin', 'enemy')
      await combat.attack('0,0,0', '1,0,-1')
      const knight = session.objects.get('0,0,0')
      expect(knight.mpRemaining).toBe(0)
    })

    it('marks unit as moved after attack', async () => {
      session.spawnUnit('0,0,0', 'knight', 'player')
      session.spawnUnit('1,0,-1', 'goblin', 'enemy')
      await combat.attack('0,0,0', '1,0,-1')
      const knight = session.objects.get('0,0,0')
      expect(knight.movedThisTurn).toBe(true)
    })

    it('enemy attacks do not consume MP', async () => {
      session.spawnUnit('0,0,0', 'goblin', 'enemy')
      session.spawnUnit('1,0,-1', 'scout', 'player')
      const goblin = session.objects.get('0,0,0')
      goblin.mpRemaining = 2
      await combat.attack('0,0,0', '1,0,-1')
      expect(goblin.mpRemaining).toBe(2)
    })
  })

  describe('projectile firing', () => {
    it('fires arrow for archer', async () => {
      session.spawnUnit('0,0,0', 'archer', 'player')
      session.spawnUnit('2,0,-2', 'goblin', 'enemy')
      await combat.attack('0,0,0', '2,0,-2')
      expect(app.unitManager.fireProjectile).toHaveBeenCalledWith('0,0,0', '2,0,-2', 'arrow')
    })

    it('does not fire projectile for melee', async () => {
      session.spawnUnit('0,0,0', 'knight', 'player')
      session.spawnUnit('1,0,-1', 'goblin', 'enemy')
      await combat.attack('0,0,0', '1,0,-1')
      expect(app.unitManager.fireProjectile).not.toHaveBeenCalled()
    })
  })

  describe('XP and leveling', () => {
    it('grants 5 XP on kill', async () => {
      session.spawnUnit('0,0,0', 'knight', 'player')
      session.spawnUnit('1,0,-1', 'goblin', 'enemy')
      await combat.attack('0,0,0', '1,0,-1')
      const knight = session.objects.get('0,0,0')
      expect(knight.xp).toBe(5)
    })

    it('grants 2 XP on hit without kill', async () => {
      session.spawnUnit('0,0,0', 'knight', 'player')
      session.addObject('1,0,-1', { type: 'goblin', owner: 'enemy', hp: 100, maxHp: 100 })
      await combat.attack('0,0,0', '1,0,-1')
      const knight = session.objects.get('0,0,0')
      expect(knight.xp).toBe(2)
    })

    it('levels up knight at rank 2 threshold', async () => {
      session.spawnUnit('0,0,0', 'knight', 'player')
      const knight = session.objects.get('0,0,0')
      knight.xp = 25
      session.checkLevelUp('0,0,0', knight)
      expect(knight.rank).toBe(2)
      expect(knight.maxHp).toBe(22)
    })

    it('levels up knight at rank 3 from rank 2', async () => {
      session.spawnUnit('0,0,0', 'knight', 'player')
      const knight = session.objects.get('0,0,0')
      knight.rank = 2
      knight.maxHp = 22
      knight.xp = 50
      session.checkLevelUp('0,0,0', knight)
      expect(knight.rank).toBe(3)
      expect(knight.maxHp).toBe(24)
    })

    it('does not level beyond rank 3', async () => {
      session.spawnUnit('0,0,0', 'knight', 'player')
      const knight = session.objects.get('0,0,0')
      knight.rank = 3
      knight.xp = 100
      session.checkLevelUp('0,0,0', knight)
      expect(knight.rank).toBe(3)
    })

    it('increases attack on level up', async () => {
      session.spawnUnit('0,0,0', 'knight', 'player')
      const knight = session.objects.get('0,0,0')
      knight.xp = 25
      session.checkLevelUp('0,0,0', knight)
      expect(knight.atk).toBe(7)
    })
  })

  describe('bounty', () => {
    it('awards gold for goblin kill', async () => {
      session.resources.gold = 0
      session.spawnUnit('0,0,0', 'knight', 'player')
      session.spawnUnit('1,0,-1', 'goblin', 'enemy')
      await combat.attack('0,0,0', '1,0,-1')
      expect(session.resources.gold).toBeGreaterThan(0)
    })

    it('scales bounty by enemy type', async () => {
      session.resources.gold = 0
      session.spawnUnit('0,0,0', 'knight', 'player')
      session.addObject('1,0,-1', { type: 'goblin_brute', owner: 'enemy', hp: 1, maxHp: 10 })
      await combat.attack('0,0,0', '1,0,-1')
      expect(session.resources.gold).toBe(32)
    })
  })

  describe('tower attacks', () => {
    it('deals tower damage to enemy', async () => {
      session.addObject('0,0,0', { type: 'tower', owner: 'player', hp: 100, atk: 4, mp: 99, mpRemaining: 99 })
      session.addObject('1,0,-1', { type: 'goblin', owner: 'enemy', hp: 10, maxHp: 10, atk: 3 })
      await combat.attack('0,0,0', '1,0,-1')
      const goblin = session.objects.get('1,0,-1')
      expect(goblin.hp).toBeLessThan(10)
    })
  })

  describe('edge cases', () => {
    it('handles attack on non-existent attacker', async () => {
      session.spawnUnit('0,0,0', 'goblin', 'enemy')
      await combat.attack('999,0,-999', '0,0,0')
      expect(session.objects.get('0,0,0').hp).toBe(6)
    })

    it('handles attack on non-existent target', async () => {
      session.spawnUnit('0,0,0', 'knight', 'player')
      await combat.attack('0,0,0', '999,0,-999')
      expect(session.objects.get('0,0,0')).toBeDefined()
    })
  })
})
