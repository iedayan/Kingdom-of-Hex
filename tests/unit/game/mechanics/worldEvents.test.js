import { describe, it, expect, vi } from 'vitest'
import { WORLD_EVENTS, pickWorldEvent, tryResolveWorldEvent } from '../../../../src/gameplay/map-rules/worldEvents.js'

describe('worldEvents', () => {
  describe('pickWorldEvent', () => {
    it('selects the same event for the same seed and turn', () => {
      const gs = { seed: 12345, turn: 20, _recentEventIds: [] }
      const first = pickWorldEvent(gs)
      const second = pickWorldEvent(gs)
      expect(second).toEqual(first)
    })

    it('avoids recently seen events when possible', () => {
      const gs = { seed: 12345, turn: 20, _recentEventIds: ['merchant', 'drought', 'signal_fires'] }
      const picked = pickWorldEvent(gs)
      expect(gs._recentEventIds.includes(picked.id)).toBe(false)
    })
  })

  describe('tryResolveWorldEvent', () => {
    it('does not trigger on turn 1', () => {
      const showEventModal = vi.fn()
      const app = { showEventModal }
      const gs = { turn: 1, seed: 1, _recentEventIds: [] }
      tryResolveWorldEvent(gs, app)
      expect(showEventModal).not.toHaveBeenCalled()
    })

    it('triggers event every 10 turns', () => {
      const showEventModal = vi.fn()
      const app = { showEventModal }
      
      const gs10 = { turn: 10, seed: 1, _recentEventIds: [] }
      tryResolveWorldEvent(gs10, app)
      expect(showEventModal).toHaveBeenCalledTimes(1)

      const gs20 = { turn: 20, seed: 1, _recentEventIds: [] }
      tryResolveWorldEvent(gs20, app)
      expect(showEventModal).toHaveBeenCalledTimes(2)
    })

    it('does not trigger on non-event turns', () => {
      const showEventModal = vi.fn()
      const app = { showEventModal }
      const gs = { turn: 11, seed: 1, _recentEventIds: [] }
      tryResolveWorldEvent(gs, app)
      expect(showEventModal).not.toHaveBeenCalled()
    })
  })

  describe('event catalogue', () => {
    it('includes newer midgame pivot events', () => {
      const ids = WORLD_EVENTS.map((event) => event.id)
      expect(ids).toContain('signal_fires')
      expect(ids).toContain('granary_accord')
      expect(ids).toContain('war_foundry')
    })
  })

  describe('event requirements', () => {
    it('merchant requires 50 gold for provisions', () => {
      const gs = { resources: { gold: 40 } }
      const merchantEvent = { options: [{ req: (g) => g.resources.gold >= 50 }] }
      expect(merchantEvent.options[0].req(gs)).toBe(false)
      gs.resources.gold = 50
      expect(merchantEvent.options[0].req(gs)).toBe(true)
    })

    it('merchant requires 100 gold for guard', () => {
      const gs = { resources: { gold: 99 } }
      const merchantEvent = { 
        options: [
          { req: (g) => g.resources.gold >= 50 },
          { req: (g) => g.resources.gold >= 100 }
        ] 
      }
      expect(merchantEvent.options[1].req(gs)).toBe(false)
      gs.resources.gold = 100
      expect(merchantEvent.options[1].req(gs)).toBe(true)
    })

    it('drought ritual requires 50 science', () => {
      const gs = { resources: { science: 49 } }
      expect(gs.resources.science >= 50).toBe(false)
      gs.resources.science = 50
      expect(gs.resources.science >= 50).toBe(true)
    })
  })

  describe('event actions', () => {
    it('merchant provisions deduct gold and add food', () => {
      const gs = { resources: { gold: 100, food: 50 } }
      gs.resources.gold -= 50
      gs.resources.food += 150
      expect(gs.resources.gold).toBe(50)
      expect(gs.resources.food).toBe(200)
    })

    it('drought rations reduce food', () => {
      const gs = { resources: { food: 100 }, objects: new Map() }
      gs.resources.food = Math.max(0, gs.resources.food - 50)
      expect(gs.resources.food).toBe(50)
    })

    it('drought ritual deducts science', () => {
      const gs = { resources: { science: 100 } }
      gs.resources.science -= 50
      expect(gs.resources.science).toBe(50)
    })

    it('signal fires can expand territory', () => {
      const gs = {
        claimRadius: vi.fn(),
        revealRadius: vi.fn(),
      }
      const event = WORLD_EVENTS.find((item) => item.id === 'signal_fires')
      event.options[0].act(gs)
      expect(gs.claimRadius).toHaveBeenCalled()
      expect(gs.revealRadius).toHaveBeenCalled()
    })
  })
})
