import { describe, it, expect } from 'vitest'
import { buildEnemyWavePlan, defineOptionalObjectives, describeEnemyWavePlan } from '../../../src/game/runContent.js'

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

  it('can escalate to a late-game warlord host', () => {
    let found = false
    for (let seed = 1; seed <= 64; seed++) {
      const plan = buildEnemyWavePlan(35, { seed, harsherRaids: false })
      if (plan.units.includes('goblin_warlord')) {
        found = true
        break
      }
    }
    expect(found).toBe(true)
  })

  it('offers a broader midgame objective set', () => {
    const objectives = defineOptionalObjectives()
    const ids = objectives.map((objective) => objective.id)
    expect(ids).toContain('market_charter')
    expect(ids).toContain('standing_host')
    expect(ids).toContain('breadbasket')
  })

  it('keeps caravan protection from auto-completing too early', () => {
    const protectCaravan = defineOptionalObjectives().find((objective) => objective.id === 'protect_caravan')
    const earlySession = {
      turn: 4,
      objects: new Map([['0,0,0', { owner: 'player', type: 'scout' }]]),
    }
    const midSession = {
      turn: 12,
      objects: new Map([['0,0,0', { owner: 'player', type: 'scout' }]]),
    }
    expect(protectCaravan.check(earlySession)).toBe(false)
    expect(protectCaravan.check(midSession)).toBe(true)
  })
})
