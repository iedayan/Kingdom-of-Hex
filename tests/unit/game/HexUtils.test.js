import { describe, it, expect } from 'vitest'
import { HexUtils } from '../../../src/game/HexUtils.js'

describe('HexUtils', () => {
  describe('parse', () => {
    it('parses cube coordinates correctly', () => {
      const coord = HexUtils.parse('1,-2,1')
      expect(coord.q).toBe(1)
      expect(coord.r).toBe(-2)
      expect(coord.s).toBe(1)
    })

    it('handles negative coordinates', () => {
      const coord = HexUtils.parse('-3,2,1')
      expect(coord.q).toBe(-3)
      expect(coord.r).toBe(2)
      expect(coord.s).toBe(1)
    })

    it('handles zero coordinates', () => {
      const coord = HexUtils.parse('0,0,0')
      expect(coord.q).toBe(0)
      expect(coord.r).toBe(0)
      expect(coord.s).toBe(0)
    })
  })

  describe('key', () => {
    it('creates consistent key from coordinates', () => {
      expect(HexUtils.key(1, -2, 1)).toBe('1,-2,1')
    })

    it('matches parse round-trip', () => {
      const coord = { q: 5, r: -3, s: -2 }
      const parsed = HexUtils.parse(HexUtils.key(coord.q, coord.r, coord.s))
      expect(parsed).toEqual(coord)
    })
  })

  describe('distance', () => {
    it('calculates distance to self as 0', () => {
      expect(HexUtils.distance('0,0,0', '0,0,0')).toBe(0)
    })

    it('calculates neighbor distance as 1', () => {
      const neighbors = HexUtils.getNeighbors('0,0,0')
      for (const n of neighbors) {
        expect(HexUtils.distance('0,0,0', n)).toBe(1)
      }
    })

    it('calculates distant coordinates', () => {
      expect(HexUtils.distance('0,0,0', '5,0,-5')).toBe(5)
    })

    it('is symmetric', () => {
      expect(HexUtils.distance('1,2,-3', '5,-2,-3')).toBe(
        HexUtils.distance('5,-2,-3', '1,2,-3')
      )
    })
  })

  describe('getNeighbors', () => {
    it('returns 6 neighbors', () => {
      expect(HexUtils.getNeighbors('0,0,0').length).toBe(6)
    })

    it('contains correct neighbor directions', () => {
      const neighbors = HexUtils.getNeighbors('0,0,0')
      expect(neighbors).toContain('1,-1,0')
      expect(neighbors).toContain('-1,1,0')
      expect(neighbors).toContain('1,0,-1')
      expect(neighbors).toContain('-1,0,1')
      expect(neighbors).toContain('0,1,-1')
      expect(neighbors).toContain('0,-1,1')
    })

    it('works for offset coordinates', () => {
      const neighbors = HexUtils.getNeighbors('5,5,-10')
      expect(neighbors.length).toBe(6)
    })
  })

  describe('getStepTowards', () => {
    it('returns one step closer to target', () => {
      const step = HexUtils.getStepTowards('0,0,0', '3,0,-3')
      expect(HexUtils.distance('0,0,0', step)).toBe(1)
    })

    it('reduces distance to target', () => {
      const target = '10,0,-10'
      const step = HexUtils.getStepTowards('0,0,0', target)
      expect(HexUtils.distance(step, target)).toBeLessThan(
        HexUtils.distance('0,0,0', target)
      )
    })

    it('returns a valid neighbor when target is same as start', () => {
      const step = HexUtils.getStepTowards('5,5,-10', '5,5,-10')
      expect(HexUtils.distance('5,5,-10', step)).toBeLessThanOrEqual(1)
    })

    it('handles immediate neighbor target', () => {
      const step = HexUtils.getStepTowards('0,0,0', '1,-1,0')
      expect(HexUtils.distance('0,0,0', step)).toBe(1)
    })
  })

  describe('findPath', () => {
    it('returns null for invalid target', () => {
      const mockApp = { city: { globalCells: new Map() } }
      const result = HexUtils.findPath('0,0,0', '999,0,-999', mockApp)
      expect(result).toBeNull()
    })
  })
})
