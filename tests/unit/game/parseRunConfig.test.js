import { describe, it, expect } from 'vitest'
import { parseRunConfigFromSearch } from '../../../src/game/parseRunConfig.js'

describe('parseRunConfigFromSearch', () => {
  it('returns null seed when missing', () => {
    expect(parseRunConfigFromSearch('')).toEqual({ seed: null })
    expect(parseRunConfigFromSearch('?foo=1')).toEqual({ seed: null })
  })

  it('parses integer seed', () => {
    expect(parseRunConfigFromSearch('?seed=42')).toEqual({ seed: 42 })
    expect(parseRunConfigFromSearch('?seed=-3')).toEqual({ seed: 3 })
    expect(parseRunConfigFromSearch('?seed=3.7')).toEqual({ seed: 3 })
  })

  it('invalid numeric seed becomes null', () => {
    expect(parseRunConfigFromSearch('?seed=nan')).toEqual({ seed: null })
    expect(parseRunConfigFromSearch('?seed=')).toEqual({ seed: null })
  })
})
