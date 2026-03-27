import { describe, it, expect } from 'vitest'
import { buildDecreeEvent, buildEnemyWavePlan, defineOptionalObjectives, describeEnemyWavePlan, getRosterForIdentity, pickDecreeChoices, pickEnemyFaction } from '../../../src/game/runContent.js'

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

  it('forces boss encounters on key late-wave turns', () => {
    const turn30 = buildEnemyWavePlan(30, { seed: 12345, harsherRaids: false })
    const turn40 = buildEnemyWavePlan(40, { seed: 12345, harsherRaids: false })
    expect(turn30.encounter).toBe('boss')
    expect(turn30.boss).toBe('goblin_warlord')
    expect(turn40.id).toBe('crownbreaker-siege')
  })

  it('returns faction-specific recruit rosters', () => {
    expect(getRosterForIdentity('guild_compact')).toContain('outrider')
    expect(getRosterForIdentity('frontier_march')).toContain('sentinel')
    expect(getRosterForIdentity('scholar_court')).toContain('sageguard')
  })

  it('picks deterministic enemy factions and exposes them in wave plans', () => {
    const first = pickEnemyFaction(18, { seed: 12345, identityId: 'guild_compact' })
    const second = pickEnemyFaction(18, { seed: 12345, identityId: 'guild_compact' })
    const plan = buildEnemyWavePlan(18, { seed: 12345, harsherRaids: false, identityId: 'guild_compact' })
    expect(second.id).toBe(first.id)
    expect(plan.enemyFactionId).toBeTruthy()
    expect(plan.enemyFactionName).toBeTruthy()
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

  it('lets standing host complete with faction frontline and ranged units', () => {
    const standingHost = defineOptionalObjectives().find((objective) => objective.id === 'standing_host')
    const session = {
      objects: new Map([
        ['0,0,0', { owner: 'player', type: 'sentinel' }],
        ['1,0,-1', { owner: 'player', type: 'sageguard' }],
      ]),
    }
    expect(standingHost.check(session)).toBe(true)
  })

  it('builds deterministic decree choices', () => {
    const first = pickDecreeChoices(12, 12345)
    const second = pickDecreeChoices(12, 12345)
    expect(second.map((choice) => choice.id)).toEqual(first.map((choice) => choice.id))
  })

  it('wraps decree choices into an event payload', () => {
    const event = buildDecreeEvent(12, 12345)
    expect(event.title).toContain('Decree')
    expect(event.options.length).toBe(3)
  })
})
