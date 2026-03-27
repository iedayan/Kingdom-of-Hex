import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ResearchSystem } from '../../../src/game/ResearchSystem.js'
import { GameSession } from '../../../src/game/GameSession.js'

const mockApp = () => ({
  unitManager: { getWorldPosition: vi.fn(() => ({ x: 0, y: 0, z: 0 })) },
  showTurnNotification: vi.fn(),
  panToTile: vi.fn(),
  spawnFloatingText: vi.fn(),
  actionBar: null,
  city: { grids: new Map() }
})

describe('ResearchSystem', () => {
  let session
  let research

  beforeEach(() => {
    session = new GameSession({ seed: 12345, app: mockApp() })
    research = new ResearchSystem(session)
  })

  describe('canResearch', () => {
    it('returns true for unresearched tech with no requirements', () => {
      expect(research.canResearch('archery')).toBe(true)
      expect(research.canResearch('scholarship')).toBe(true)
    })

    it('returns false for already researched tech', () => {
      session.researched.add('archery')
      expect(research.canResearch('archery')).toBe(false)
    })

    it('returns false for tech with unmet requirements', () => {
      expect(research.canResearch('ballistics')).toBe(false)
    })

    it('returns true for tech with met requirements', () => {
      session.researched.add('archery')
      expect(research.canResearch('ballistics')).toBe(true)
    })

    it('returns false for unknown tech', () => {
      expect(research.canResearch('unknown_tech')).toBe(false)
    })
  })

  describe('startResearch', () => {
    it('starts research for valid tech', () => {
      expect(research.startResearch('archery')).toBe(true)
      expect(session.currentResearch).toBe('archery')
    })

    it('returns false for invalid tech', () => {
      expect(research.startResearch('unknown')).toBe(false)
    })

    it('returns false for already researched tech', () => {
      session.researched.add('archery')
      expect(research.startResearch('archery')).toBe(false)
    })

    it('returns false for tech with unmet requirements', () => {
      expect(research.startResearch('ballistics')).toBe(false)
    })
  })

  describe('processResearch', () => {
    it('does nothing with no active research', () => {
      session.currentResearch = null
      expect(research.processResearch()).toBeNull()
    })

    it('does nothing with no science', () => {
      session.currentResearch = 'archery'
      session.resources.science = 0
      expect(research.processResearch()).toBeNull()
    })

    it('accumulates science progress', () => {
      session.currentResearch = 'archery'
      session.resources.science = 10
      research.processResearch()
      expect(session.techTree.archery.progress).toBe(10)
      expect(session.resources.science).toBe(0)
    })

    it('completes research when cost is met', () => {
      session.currentResearch = 'scholarship'
      session.techTree.scholarship.progress = 10
      session.resources.science = 10
      expect(research.processResearch()).toBe('scholarship')
      expect(session.researched.has('scholarship')).toBe(true)
      expect(session.currentResearch).toBeNull()
    })

    it('caps science at needed amount', () => {
      session.currentResearch = 'scholarship'
      session.resources.science = 100
      research.processResearch()
      expect(session.resources.science).toBe(85)
    })
  })

  describe('getUnlockedBuildings', () => {
    it('returns empty array with no research', () => {
      expect(research.getUnlockedBuildings()).toEqual([])
    })

    it('returns unlocked buildings after research', () => {
      session.researched.add('archery')
      expect(research.getUnlockedBuildings()).toContain('archer')
    })

    it('returns unique buildings only', () => {
      session.researched.add('archery')
      session.researched.add('currency')
      const unlocked = research.getUnlockedBuildings()
      expect(unlocked.length).toBe(new Set(unlocked).size)
    })
  })

  describe('getAvailableTechs', () => {
    it('lists all available techs', () => {
      const available = research.getAvailableTechs()
      expect(available.length).toBe(5)
    })

    it('marks researched techs as unavailable', () => {
      session.researched.add('archery')
      const available = research.getAvailableTechs()
      expect(available.find(t => t.key === 'archery')).toBeUndefined()
    })

    it('marks techs without requirements as available', () => {
      const archery = research.getAvailableTechs().find(t => t.key === 'archery')
      expect(archery.meetsRequirements).toBe(true)
    })

    it('marks techs without requirements as unavailable', () => {
      const ballistics = research.getAvailableTechs().find(t => t.key === 'ballistics')
      expect(ballistics.meetsRequirements).toBe(false)
    })

    it('marks current research as in progress', () => {
      session.currentResearch = 'archery'
      const available = research.getAvailableTechs()
      const archery = available.find(t => t.key === 'archery')
      expect(archery.isResearching).toBe(true)
    })

    it('includes progress for techs', () => {
      session.currentResearch = 'archery'
      session.techTree.archery.progress = 15
      const archery = research.getAvailableTechs().find(t => t.key === 'archery')
      expect(archery.progress).toBe(15)
    })
  })

  describe('getResearchProgress', () => {
    it('returns null with no active research', () => {
      expect(research.getResearchProgress()).toBeNull()
    })

    it('returns progress info for active research', () => {
      session.currentResearch = 'archery'
      session.techTree.archery.progress = 10
      const progress = research.getResearchProgress()
      expect(progress.key).toBe('archery')
      expect(progress.cost).toBe(25)
      expect(progress.progress).toBe(10)
      expect(progress.percent).toBe(40)
    })
  })
})
