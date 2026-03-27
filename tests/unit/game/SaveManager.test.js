import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SaveManager } from '../../../src/game/SaveManager.js'

describe('SaveManager', () => {
  let saveManager
  let storage

  beforeEach(() => {
    storage = {}
    global.localStorage = {
      getItem: vi.fn((key) => storage[key] || null),
      setItem: vi.fn((key, value) => { storage[key] = value }),
      removeItem: vi.fn((key) => { delete storage[key] })
    }
    saveManager = new SaveManager()
    saveManager.load()
  })

  describe('initialization', () => {
    it('creates default save data', () => {
      expect(saveManager.data).toBeDefined()
      expect(saveManager.data.runs).toBe(0)
      expect(saveManager.data.wins).toBe(0)
      expect(saveManager.data.lp).toBe(0)
    })

    it('has correct upgrade structure', () => {
      expect(saveManager.data.upgrades.starting_scout).toBe(0)
      expect(saveManager.data.upgrades.science_focus).toBe(0)
      expect(saveManager.data.upgrades.fortified_walls).toBe(0)
    })

    it('has stats structure', () => {
      expect(saveManager.data.stats.total_gold).toBe(0)
      expect(saveManager.data.stats.total_kills).toBe(0)
    })

    it('stores current save version', () => {
      expect(saveManager.data.version).toBeGreaterThanOrEqual(1)
    })
  })

  describe('version guardrails', () => {
    it('resets when save version is newer than supported', () => {
      storage.hexgame_save_v1 = JSON.stringify({
        version: 999,
        lp: 123,
        runs: 2,
        wins: 1,
        upgrades: {},
        stats: {},
      })
      const reloaded = new SaveManager()
      expect(reloaded.data.lp).toBe(0)
      expect(reloaded.data.runs).toBe(0)
    })

    it('drops invalid session payloads on load', () => {
      storage.hexgame_save_v1 = JSON.stringify({
        version: 1,
        lp: 0,
        runs: 1,
        wins: 0,
        upgrades: {},
        stats: {},
        session: 'bad-session',
      })
      const reloaded = new SaveManager()
      expect(reloaded.data.session).toBeNull()
    })
  })

  describe('saveSession', () => {
    it('saves game state', () => {
      saveManager.saveSession({ turn: 5, resources: { gold: 100 } })
      expect(saveManager.data.session).toBeDefined()
      expect(saveManager.data.session.turn).toBe(5)
    })

    it('overwrites previous session', () => {
      saveManager.saveSession({ turn: 5 })
      saveManager.saveSession({ turn: 10 })
      expect(saveManager.data.session.turn).toBe(10)
    })
  })

  describe('clearSession', () => {
    it('removes session data', () => {
      saveManager.saveSession({ turn: 5 })
      saveManager.clearSession()
      expect(saveManager.data.session).toBeNull()
    })
  })

  describe('addLP', () => {
    it('increments loyalty points', () => {
      saveManager.addLP(10)
      expect(saveManager.data.lp).toBe(10)
    })

    it('floors fractional amounts', () => {
      saveManager.addLP(10.7)
      expect(saveManager.data.lp).toBe(10)
    })

    it('accumulates LP', () => {
      saveManager.addLP(10)
      saveManager.addLP(20)
      expect(saveManager.data.lp).toBe(30)
    })
  })

  describe('buyUpgrade', () => {
    it('purchases upgrade when affordable', () => {
      saveManager.data.lp = 100
      const result = saveManager.buyUpgrade('starting_scout', 50)
      expect(result).toBe(true)
      expect(saveManager.data.upgrades.starting_scout).toBe(1)
      expect(saveManager.data.lp).toBe(50)
    })

    it('fails when not affordable', () => {
      saveManager.data.lp = 30
      const result = saveManager.buyUpgrade('starting_scout', 50)
      expect(result).toBe(false)
      expect(saveManager.data.upgrades.starting_scout).toBe(0)
    })

    it('increments upgrade level', () => {
      saveManager.data.lp = 200
      saveManager.buyUpgrade('science_focus', 50)
      saveManager.buyUpgrade('science_focus', 50)
      expect(saveManager.data.upgrades.science_focus).toBe(2)
    })
  })

  describe('getUpgradeBonus', () => {
    it('returns upgrade level for science_focus', () => {
      saveManager.data.upgrades.science_focus = 3
      expect(saveManager.getUpgradeBonus('science_focus')).toBe(3)
    })

    it('returns upgrade level * 2 for fortified_walls', () => {
      saveManager.data.upgrades.fortified_walls = 2
      expect(saveManager.getUpgradeBonus('fortified_walls')).toBe(4)
    })

    it('returns 0 or 1 for starting_scout', () => {
      saveManager.data.upgrades.starting_scout = 0
      expect(saveManager.getUpgradeBonus('starting_scout')).toBe(0)
      saveManager.data.upgrades.starting_scout = 1
      expect(saveManager.getUpgradeBonus('starting_scout')).toBe(1)
    })

    it('returns 0 for unknown upgrade', () => {
      expect(saveManager.getUpgradeBonus('unknown')).toBe(0)
    })
  })
})
