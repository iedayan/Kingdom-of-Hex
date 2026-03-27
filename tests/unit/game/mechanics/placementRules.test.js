import { describe, it, expect } from 'vitest'
import { assessPlacement } from '../../../../src/gameplay/map-rules/placementRules.js'

describe('placementRules', () => {
  it('rejects placement when no selection is active', () => {
    const res = assessPlacement({
      selectedBuilding: null,
      selectedUnitType: null,
      isOccupied: false,
      isOwned: true,
      tileName: 'GRASS',
      tileLevel: 0,
    })
    expect(res.isValid).toBe(false)
    expect(res.reason).toContain('Select')
  })

  it('rejects occupied tiles with clear reason', () => {
    const res = assessPlacement({
      selectedBuilding: 'farm',
      selectedUnitType: null,
      isOccupied: true,
      isOwned: true,
      tileName: 'GRASS',
      tileLevel: 0,
    })
    expect(res.isValid).toBe(false)
    expect(res.reason).toContain('occupied')
  })

  it('rejects buildings in unowned territory', () => {
    const res = assessPlacement({
      selectedBuilding: 'farm',
      selectedUnitType: null,
      isOccupied: false,
      isOwned: false,
      tileName: 'GRASS',
      tileLevel: 0,
    })
    expect(res.isValid).toBe(false)
    expect(res.reason).toContain('Expand')
  })

  it('accepts mines on any owned grass', () => {
    const res = assessPlacement({
      selectedBuilding: 'mine',
      selectedUnitType: null,
      isOccupied: false,
      isOwned: true,
      tileName: 'GRASS',
      tileLevel: 0,
    })
    expect(res.isValid).toBe(true)
  })

  it('rejects unit deploy on non-grass tile', () => {
    const res = assessPlacement({
      selectedBuilding: null,
      selectedUnitType: 'scout',
      isOccupied: false,
      isOwned: true,
      tileName: 'WATER',
      tileLevel: 0,
    })
    expect(res.isValid).toBe(false)
    expect(res.reason).toContain('Units')
  })
})
