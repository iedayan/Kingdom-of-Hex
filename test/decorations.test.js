import test from 'node:test'
import assert from 'node:assert/strict'

import { setSeed } from '../src/SeededRandom.js'
import { Decorations } from '../src/hexmap/Decorations.js'
import { MountainMeshNames } from '../src/hexmap/DecorationDefs.js'
import { TileType } from '../src/hexmap/HexTileData.js'

function createDecorations() {
  return new Decorations({ add() {}, remove() {}, userData: { hexGrid: {} } })
}

test('clearDecorationsAt removes windmill fan tracking and stops its tween', () => {
  const decorations = createDecorations()
  const deleted = []
  let killed = 0

  decorations.mesh = {
    deleteInstance(instanceId) {
      deleted.push(instanceId)
    },
  }
  decorations.windmillFans = [
    {
      instanceId: 10,
      tile: { gridX: 1, gridZ: 2 },
      tween: { kill() { killed++ } },
    },
  ]
  decorations.buildings = [
    { instanceId: 10, tile: { gridX: 1, gridZ: 2 } },
  ]

  decorations.clearDecorationsAt(1, 2)

  assert.equal(killed, 1)
  assert.equal(decorations.windmillFans.length, 0)
  assert.equal(decorations.buildings.length, 0)
  assert.deepEqual(deleted, [10])
})

test('repopulateTilesAt keeps mountain placement rules aligned with initial generation', () => {
  const decorations = createDecorations()
  let addMountainCalls = 0

  setSeed(7)
  decorations.mesh = {}
  decorations.geomIds = new Map()
  decorations.clearDecorationsAt = () => {}
  decorations.addMountainAt = () => {
    addMountainCalls++
    decorations.mountains.push({ instanceId: 1, rotationY: 0 })
  }

  decorations.repopulateTilesAt([
    { id: 1, type: TileType.GRASS, level: 2, gridX: 8, gridZ: 8, rotation: 0 },
  ], 8, [], { animate: false })

  assert.equal(addMountainCalls, 0)
})

test('populateHillsAndMountains stores the actual rotation used for mountains', () => {
  const decorations = createDecorations()
  let capturedRotation = null

  setSeed(7)
  decorations.mesh = {}
  decorations.geomIds = new Map(MountainMeshNames.map(name => [name, 1]))
  decorations._placeInstance = (...args) => {
    capturedRotation = args[6]
    return 7
  }

  decorations.populateHillsAndMountains([
    { id: 1, type: TileType.GRASS_CLIFF, level: 0, gridX: 8, gridZ: 8 },
  ], 8)

  assert.equal(decorations.mountains.length, 1)
  assert.equal(decorations.mountains[0].rotationY, capturedRotation)
})
