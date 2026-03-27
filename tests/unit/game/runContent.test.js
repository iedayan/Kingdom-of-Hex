import { describe, it, expect } from 'vitest'
import { buildEnemyWavePlan, describeEnemyWavePlan } from '../../../src/game/runContent.js'

describe('runContent wave planning', () => {
  it('builds deterministic wave plans from the same seed and turn', () => {
    const first = buildEnemyWavePlan(18, { seed: 12345, harsherRaids: false })
    const second = buildEnemyWavePlan(18, { seed: 12345, harsherRaids: false })
    expect(second).toEqual(first)
  })

  it('adds reinforcements for harsher raids', () => {
    const normal = buildEnemyWavePlan(18, { seed: 12345, harsherRaids: false })
    const harsher = buildEnemyWavePlan(18, { seed: 12345, harsherRaids: true })
    expect(harsher.units.length).toBeGreaterThan(normal.units.length)
  })

  it('describes wave plans for the HUD', () => {
    const text = describeEnemyWavePlan({
      name: 'Brute Push',
      units: ['goblin_brute', 'goblin_slinger'],
    })
    expect(text).toContain('Brute Push')
    expect(text).toContain('brute')
    expect(text).toContain('slinger')
  })
})
