import { describe, it, expect } from 'vitest'
import {
  WIN_GOLD_GOAL,
  MAX_TURNS,
  CAPITAL_CUBE_KEY,
  capitalMissionLines,
} from '../../../src/game/goals.js'

describe('goals', () => {
  it('exports pacing constants', () => {
    expect(WIN_GOLD_GOAL).toBeGreaterThan(0)
    expect(MAX_TURNS).toBeGreaterThan(0)
  })

  it('capital key is valid cube string', () => {
    expect(CAPITAL_CUBE_KEY).toMatch(/^-?\d+,-?\d+,-?\d+$/)
  })

  it('capitalMissionLines matches key coordinates', () => {
    const m = capitalMissionLines()
    expect(m.title.length).toBeGreaterThan(0)
    expect(m.coords).toContain('·')
    expect(m.tooltip).toContain(String(WIN_GOLD_GOAL))
    expect(m.tooltip).toContain(String(MAX_TURNS))
  })
})
