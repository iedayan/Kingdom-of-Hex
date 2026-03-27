import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPlaytestRunSummary, clearPlaytestRuns, getPlaytestRuns, installPlaytestTools, recordPlaytestRun } from '../../../src/game/playtestHistory.js'

describe('playtestHistory', () => {
  let storage

  beforeEach(() => {
    storage = {}
    global.localStorage = {
      getItem: vi.fn((key) => storage[key] || null),
      setItem: vi.fn((key, value) => { storage[key] = value }),
      removeItem: vi.fn((key) => { delete storage[key] }),
    }
  })

  it('builds a structured run summary from game state', () => {
    const summary = buildPlaytestRunSummary({
      seed: 12345,
      turn: 18,
      runModifier: 'scholar_court',
      loseReason: null,
      victoryReason: 'knowledge',
      resources: { gold: 420, food: 36, wood: 52, stone: 40, science: 18 },
      runStats: { enemyKills: 12, wavesFaced: 3, objectivesCompleted: 2 },
      chosenDecrees: ['martial_code'],
      researched: new Set(['archery', 'scholarship']),
      objectives: [
        { title: 'Breadbasket', completed: true, failed: false },
        { title: 'Standing Host', completed: false, failed: true },
      ],
      getVictoryTracks() {
        return [
          { id: 'treasury', label: 'Treasury', percent: 42, completed: false, value: 420, target: 1000 },
          { id: 'knowledge', label: 'Knowledge', percent: 67, completed: false, value: 4, target: 6 },
        ]
      },
    }, {
      victory: true,
      victoryReason: 'knowledge',
    })

    expect(summary.result).toBe('win')
    expect(summary.identity.name).toBe('Scholar Court')
    expect(summary.decrees).toEqual(['Martial Code'])
    expect(summary.completedObjectives).toEqual(['Breadbasket'])
    expect(summary.failedObjectives).toEqual(['Standing Host'])
    expect(summary.bestTrack.label).toBe('Knowledge')
  })

  it('records and trims playtest runs in storage', () => {
    for (let i = 0; i < 32; i++) {
      recordPlaytestRun({
        seed: i,
        turn: i + 1,
        resources: { gold: i },
        runStats: { enemyKills: i },
        objectives: [],
        chosenDecrees: [],
        researched: new Set(),
        getVictoryTracks() { return [] },
      }, { victory: i % 2 === 0 }, global.localStorage)
    }

    const runs = getPlaytestRuns(global.localStorage)
    expect(runs).toHaveLength(30)
    expect(runs[0].seed).toBe('2')
    expect(runs.at(-1).seed).toBe('31')
  })

  it('installs browser helpers and clears history', () => {
    const scope = {}
    installPlaytestTools(scope, global.localStorage)
    recordPlaytestRun({
      seed: 99,
      turn: 9,
      resources: { gold: 99 },
      runStats: {},
      objectives: [],
      chosenDecrees: [],
      researched: new Set(),
      getVictoryTracks() { return [] },
    }, { victory: false }, global.localStorage)

    expect(scope.HX_PLAYTEST.runs()).toHaveLength(1)
    scope.HX_PLAYTEST.clear()
    expect(getPlaytestRuns(global.localStorage)).toEqual([])
    clearPlaytestRuns(global.localStorage)
    expect(global.localStorage.removeItem).toHaveBeenCalled()
  })
})
