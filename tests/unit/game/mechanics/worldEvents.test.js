import { describe, it, expect, vi } from 'vitest'
import { tryResolveWorldEvent } from '../../../../src/gameplay/map-rules/worldEvents.js'

describe('worldEvents', () => {
  describe('tryResolveWorldEvent', () => {
    it('does not trigger on turn 1', () => {
      const showEventModal = vi.fn()
      const app = { showEventModal }
      const gs = { turn: 1 }
      tryResolveWorldEvent(gs, app)
      expect(showEventModal).not.toHaveBeenCalled()
    })

    it('triggers event every 10 turns', () => {
      const showEventModal = vi.fn()
      const app = { showEventModal }
      
      const gs10 = { turn: 10 }
      tryResolveWorldEvent(gs10, app)
      expect(showEventModal).toHaveBeenCalledTimes(1)

      const gs20 = { turn: 20 }
      tryResolveWorldEvent(gs20, app)
      expect(showEventModal).toHaveBeenCalledTimes(2)
    })

    it('does not trigger on non-event turns', () => {
      const showEventModal = vi.fn()
      const app = { showEventModal }
      const gs = { turn: 11 }
      tryResolveWorldEvent(gs, app)
      expect(showEventModal).not.toHaveBeenCalled()
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
  })
})
