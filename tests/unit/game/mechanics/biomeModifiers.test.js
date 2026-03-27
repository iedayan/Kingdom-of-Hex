import { describe, it, expect } from 'vitest'
import { productionMultiplier, scaleYield, getAttackDamage } from '../../../../src/gameplay/map-rules/biomeModifiers.js'

describe('biomeModifiers', () => {
  describe('productionMultiplier', () => {
    it('returns 1 for temperate biome', () => {
      expect(productionMultiplier('temperate', 'lumberjack')).toBe(1)
      expect(productionMultiplier('temperate', 'farm')).toBe(1)
      expect(productionMultiplier('temperate', 'mine')).toBe(1)
    })

    it('applies winter penalties to farms', () => {
      expect(productionMultiplier('winter', 'farm')).toBe(0.72)
    })

    it('applies winter bonuses to mines', () => {
      expect(productionMultiplier('winter', 'mine')).toBe(1.08)
    })

    it('applies winter bonuses to libraries', () => {
      expect(productionMultiplier('winter', 'library')).toBe(1.12)
    })

    it('applies wasteland penalties to farms', () => {
      expect(productionMultiplier('wasteland', 'farm')).toBe(0.62)
    })

    it('applies wasteland bonuses to mines', () => {
      expect(productionMultiplier('wasteland', 'mine')).toBe(1.28)
    })

    it('falls back to temperate for unknown biome', () => {
      expect(productionMultiplier('unknown', 'lumberjack')).toBe(1)
    })

    it('falls back to 1 for unknown building type', () => {
      expect(productionMultiplier('temperate', 'unknown')).toBe(1)
    })
  })

  describe('scaleYield', () => {
    it('returns original amount with mult 1', () => {
      expect(scaleYield(10, 1)).toBe(10)
    })

    it('scales up with multiplier > 1', () => {
      expect(scaleYield(10, 1.5)).toBe(15)
    })

    it('scales down with multiplier < 1', () => {
      expect(scaleYield(10, 0.8)).toBe(8)
    })

    it('rounds to nearest integer', () => {
      expect(scaleYield(10, 1.25)).toBe(13)
    })

    it('never returns negative', () => {
      expect(scaleYield(10, -0.5)).toBe(0)
      expect(scaleYield(10, 0)).toBe(0)
    })

    it('handles zero base amount', () => {
      expect(scaleYield(0, 5)).toBe(0)
    })
  })

  describe('getAttackDamage', () => {
    it('adds high ground damage for attackers above the target', () => {
      const session = { getBiome: () => 'temperate' }
      const app = {
        city: {
          globalCells: new Map([
            ['0,0,0', { gridKey: '0,0', level: 3 }],
            ['1,0,-1', { gridKey: '0,0', level: 1 }],
          ]),
        },
      }

      const damage = getAttackDamage(
        session,
        app,
        '0,0,0',
        { type: 'knight', atk: 6, level: 3 },
        '1,0,-1',
        { type: 'goblin', hp: 6, level: 1 }
      )

      expect(damage).toBe(8)
    })

    it('gives goblin brutes bonus damage against towers', () => {
      const session = { getBiome: () => 'temperate' }
      const app = { city: { globalCells: new Map() } }

      const damage = getAttackDamage(
        session,
        app,
        '0,0,0',
        { type: 'goblin_brute', atk: 4 },
        '1,0,-1',
        { type: 'tower', hp: 28 }
      )

      expect(damage).toBe(7)
    })

    it('reduces ranged damage into towers for non-brutes', () => {
      const session = { getBiome: () => 'temperate' }
      const app = { city: { globalCells: new Map() } }

      const damage = getAttackDamage(
        session,
        app,
        '0,0,0',
        { type: 'archer', atk: 4 },
        '1,0,-1',
        { type: 'tower', hp: 28 }
      )

      expect(damage).toBe(2)
    })
  })
})
