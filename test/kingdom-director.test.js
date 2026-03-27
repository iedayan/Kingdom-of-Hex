import test from 'node:test'
import assert from 'node:assert/strict'

import { TileType } from '../src/hexmap/HexTileData.js'
import {
  KingdomDirector,
  parseKingdomConfig,
  summarizeWorldState,
} from '../src/game/KingdomDirector.js'

test('parseKingdomConfig reads replay params from the URL query', () => {
  const config = parseKingdomConfig('?seed=4242&realm=crown-road&threat=black-sails')

  assert.deepEqual(config, {
    seed: 4242,
    realmId: 'crown-road',
    threatId: 'black-sails',
  })
})

test('summarizeWorldState counts terrain categories and unique decoration tiles', () => {
  const summary = summarizeWorldState({
    globalCells: [
      { q: 0, r: 0, s: 0, type: TileType.ROAD_A, level: 0 },
      { q: 1, r: -1, s: 0, type: TileType.RIVER_CROSSING_A, level: 0 },
      { q: 1, r: 0, s: -1, type: TileType.COAST_A, level: 0 },
      { q: 0, r: 1, s: -1, type: TileType.WATER, level: 0 },
      { q: -1, r: 1, s: 0, type: TileType.GRASS_CLIFF, level: 0 },
      { q: -1, r: 0, s: 1, type: TileType.GRASS, level: 3 },
    ],
    grids: [
      {
        state: 'populated',
        hexTiles: [{ id: 1 }],
        decorations: {
          buildings: [
            { tile: { id: 10 }, meshName: 'building_house' },
            { tile: { id: 11 }, meshName: 'building_windmill_yellow' },
            { tile: { id: 11 }, meshName: 'building_windmill_top_yellow' },
          ],
          bridges: [{ tile: { id: 20 } }],
          mountains: [{ tile: { id: 30 } }],
          trees: [{ tile: { id: 40 } }, { tile: { id: 40 } }],
        },
      },
    ],
  })

  assert.equal(summary.tiles, 6)
  assert.equal(summary.builtGrids, 1)
  assert.equal(summary.roads, 2)
  assert.equal(summary.rivers, 1)
  assert.equal(summary.coast, 1)
  assert.equal(summary.water, 1)
  assert.equal(summary.highland, 2)
  assert.equal(summary.cliffs, 1)
  assert.equal(summary.crossings, 1)
  assert.equal(summary.buildings, 1)
  assert.equal(summary.windmills, 1)
  assert.equal(summary.bridges, 1)
  assert.equal(summary.mountains, 1)
  assert.equal(summary.trees, 1)
})

test('KingdomDirector replay logic stays deterministic for the same seed and actions', () => {
  const cells = [
    { q: 0, r: 0, s: 0, type: TileType.ROAD_A, level: 0 },
    { q: 1, r: -1, s: 0, type: TileType.COAST_A, level: 0 },
    { q: 1, r: 0, s: -1, type: TileType.COAST_B, level: 0 },
    { q: 0, r: 1, s: -1, type: TileType.RIVER_A, level: 0 },
    { q: -1, r: 1, s: 0, type: TileType.GRASS_CLIFF, level: 0 },
  ]
  const summary = {
    tiles: 900,
    builtGrids: 4,
    roads: 88,
    rivers: 34,
    coast: 126,
    water: 120,
    grass: 402,
    highland: 140,
    cliffs: 26,
    crossings: 8,
    buildings: 7,
    windmills: 2,
    bridges: 3,
    mountains: 6,
    trees: 20,
  }

  const runActions = () => {
    const director = new KingdomDirector({
      seed: 9001,
      realmId: 'crown-road',
      threatId: 'ash-raiders',
    })
    const results = []

    for (const actionType of ['expand', 'expand', 'rebuild', 'expand']) {
      const outcome = director.applyAction({ actionType, summary, cells })
      results.push({
        turn: outcome.state.turn,
        threatMeter: outcome.state.threatMeter,
        prestige: outcome.state.prestige,
        objectiveText: outcome.state.objectiveText,
        effectLabels: outcome.state.activeEffects.map(effect => effect.label),
        incursion: outcome.incursion?.targetKey ?? null,
        event: outcome.event?.id ?? null,
      })
    }

    return {
      results,
      solveOptions: director.getSolveOptions(),
    }
  }

  const first = runActions()
  const second = runActions()

  assert.deepEqual(second, first)
  assert.ok(first.results[2].event)
  assert.ok(first.solveOptions.weightBiases[TileType.ROAD_A] > 1)
  assert.ok(first.results[3].incursion)
})
