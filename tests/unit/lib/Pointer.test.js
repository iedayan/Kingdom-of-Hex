import { describe, it, expect } from 'vitest'
import { toNdc } from '../../../src/core/input/Pointer.js'

describe('Pointer.toNdc', () => {
  it('normalizes using the canvas rectangle, not window size', () => {
    const rect = { left: 100, top: 50, width: 800, height: 600 }
    const center = toNdc(500, 350, rect)
    expect(center.x).toBeCloseTo(0)
    expect(center.y).toBeCloseTo(0)
  })

  it('maps top-left of canvas to (-1, 1)', () => {
    const rect = { left: 100, top: 50, width: 800, height: 600 }
    const topLeft = toNdc(100, 50, rect)
    expect(topLeft.x).toBeCloseTo(-1)
    expect(topLeft.y).toBeCloseTo(1)
  })
})
