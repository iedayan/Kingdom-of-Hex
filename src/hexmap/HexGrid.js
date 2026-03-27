import {
  Object3D,
  BatchedMesh,
  Group,
  AxesHelper,
  BufferGeometry,
  Float32BufferAttribute,
  LineSegments,
  LineBasicMaterial,
  Color,
  ArrowHelper,
  Vector3,
} from 'three/webgpu'
import { CSS2DObject } from 'three/examples/jsm/Addons.js'
import gsap from 'gsap'
import { TILE_LIST, HexDir } from './HexTileData.js'
import { HexTile, HexTileGeometry, isInHexRadius } from './HexTiles.js'
import { Decorations } from './Decorations.js'
import { HexGridHelper } from './HexGridHelper.js'
import { Placeholder } from './Placeholder.js'
import { cubeToOffset, globalToLocalGrid } from './HexWFCCore.js'
import {
  hideAllInstances as _hideAllInstances,
  animateTileDrop as _animateTileDrop,
  animatePlacements as _animatePlacements,
  animateDecoration as _animateDecoration,
} from './HexGridAnimation.js'

const LEVEL_HEIGHT = 0.5

export const HexGridState = {
  PLACEHOLDER: 'placeholder',
  POPULATED: 'populated',
}

export class HexGrid {
  static SHOW_SLOPE_ARROWS = false

  constructor(scene, material, gridRadius, worldOffset = { x: 0, z: 0 }, biome = 'temperate') {
    this.scene = scene
    this.material = material
    this.gridRadius = gridRadius
    this.worldOffset = worldOffset
    this.biome = biome

    this.group = new Group()
    this.group.position.set(worldOffset.x, 0, worldOffset.z)
    this.group.userData.hexGrid = this
    this.scene.add(this.group)

    this.state = HexGridState.PLACEHOLDER

    this.hexWidth = 2
    this.hexHeight = 2 / Math.sqrt(3) * 2

    this.hexTiles = []
    this.hexGrid = null
    this.hexMesh = null
    this.decorations = null
    this.gridHelper = null
    this.placeholder = null
    this.axesHelper = null
    this.outline = null

    this.onClick = null

    this.dummy = new Object3D()

    this._rotationAngles = [0, 1, 2, 3, 4, 5].map(r => -r * Math.PI / 3)
    this._activeAnimations = []
    this._outlineFadeTimer = null
    this._initialized = false
  }

  /**
   * Initialize the grid (creates placeholder and helper, but doesn't populate tiles yet)
   * @param {Map} geometries - HexTileGeometry.geoms (optional, only needed for population)
   * @param {Object} options
   * @param {boolean} options.hidden - Start with placeholder hidden
   */
  async init(geometries = null, { hidden = false } = {}) {
    try {
      this.axesHelper = new AxesHelper(5)
      this.axesHelper.position.set(0, 2, 0)
      this.group.add(this.axesHelper)

      this.createOutline()

      const gridKey = this.gridCoords ? `${this.gridCoords.x},${this.gridCoords.z}` : '?'
      this.gridLabel = this.createGridLabel(gridKey)
      this.group.add(this.gridLabel)

      this.placeholder = new Placeholder(this.gridRadius, this.hexWidth, this.hexHeight)
      this.placeholder.group.userData.hexGrid = this
      this.group.add(this.placeholder.group)

      this.gridHelper = new HexGridHelper(this.gridRadius, this.hexWidth, this.hexHeight)
      this.gridHelper.create()
      this.gridHelper.hide()
      this.group.add(this.gridHelper.group)

      if (hidden) {
        this.placeholder?.hide()
        if (this.outline) this.outline.visible = false
      } else {
        this.updateVisibility()
      }

      if (geometries && geometries.size > 0) {
        const success = await this.initMeshes(geometries)
        if (!success) throw new Error('Failed to initialize meshes')
      }

      this._initialized = true
      return true
    } catch (error) {
      console.error('HexGrid.init failed:', error)
      return false
    }
  }

  /**
   * Initialize BatchedMesh for tiles (called before population)
   * @param {Map} geometries - HexTileGeometry.geoms
   */
  async initMeshes(geometries) {
    if (!geometries || geometries.size === 0) {
      console.warn('HexGrid.initMeshes: No geometries provided')
      return false
    }

    // Calculate total vertices/indices for BatchedMesh
    let totalV = 0
    let totalI = 0
    for (const geom of geometries.values()) {
      if (!geom) continue
      totalV += geom.attributes.position.count
      totalI += geom.index ? geom.index.count : 0
    }
    // Include bottom fill geometry
    if (HexTileGeometry.bottomGeom) {
      totalV += HexTileGeometry.bottomGeom.attributes.position.count
      totalI += HexTileGeometry.bottomGeom.index ? HexTileGeometry.bottomGeom.index.count : 0
    }

    const maxInstances = 217 * 2 + 16  // 217 tiles + 217 bottom fills + dummy + headroom

    // Create BatchedMesh for hex tiles (positioned at 0,0,0 local - group handles offset)
    this.hexMesh = new BatchedMesh(maxInstances, totalV * 2, totalI * 2, this.material)
    this.hexMesh.sortObjects = false
    this.hexMesh.receiveShadow = true
    this.hexMesh.castShadow = true
    this.hexMesh.frustumCulled = false
    this.group.add(this.hexMesh)

    // Register geometries in BatchedMesh
    this.geomIds = new Map()
    for (const [type, geom] of geometries) {
      if (geom) {
        const geomId = this.hexMesh.addGeometry(geom)
        this.geomIds.set(type, geomId)
      }
    }

    // Register bottom fill geometry
    this.bottomGeomId = null
    this.bottomFills = new Map()  // `gridX,gridZ` -> instanceId
    if (HexTileGeometry.bottomGeom) {
      this.bottomGeomId = this.hexMesh.addGeometry(HexTileGeometry.bottomGeom)
    }

    // Initialize color buffer with a dummy white instance (fixes WebGPU color sync issue)
    // This ensures setColorAt is called before first render
    const firstGeomId = this.geomIds.values().next().value
    if (firstGeomId !== undefined) {
      const WHITE = new Color(0xffffff)
      this.hexMesh._dummyInstanceId = this.hexMesh.addInstance(firstGeomId)
      this.hexMesh.setColorAt(this.hexMesh._dummyInstanceId, WHITE)
      this.dummy.position.set(0, -1000, 0)
      this.dummy.scale.setScalar(0)
      this.dummy.updateMatrix()
      this.hexMesh.setMatrixAt(this.hexMesh._dummyInstanceId, this.dummy.matrix)
    }

    // Initialize decorations for this grid (pass worldOffset for noise sampling)
    this.decorations = new Decorations(this.group, this.worldOffset)
    await this.decorations.init(this.material)

    return true
  }

  /**
   * Create outline showing grid boundary (always visible, renders through terrain)
   */
  createOutline() {
    const d = this.gridRadius * 2 + 1
    const halfW = (d * this.hexWidth) / 2
    const halfH = (d * this.hexHeight * 0.75) / 2

    // 6 vertices of flat-top hex
    const verts = [
      halfW, 0, 0,
      halfW * 0.5, 0, -halfH,
      -halfW * 0.5, 0, -halfH,
      -halfW, 0, 0,
      -halfW * 0.5, 0, halfH,
      halfW * 0.5, 0, halfH,
    ]
    const lineVerts = []
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6
      lineVerts.push(verts[i*3], verts[i*3+1], verts[i*3+2])
      lineVerts.push(verts[j*3], verts[j*3+1], verts[j*3+2])
    }

    const geom = new BufferGeometry()
    geom.setAttribute('position', new Float32BufferAttribute(lineVerts, 3))
    const material = new LineBasicMaterial({ color: 0xffffff, transparent: true })
    material.depthTest = false
    material.depthWrite = false  // Exclude from AO (no depth contribution)

    this.outline = new LineSegments(geom, material)
    this.outline.position.set(0, 1, 0)
    this.outline.renderOrder = 999
    this.group.add(this.outline)
  }

  /**
   * Update visibility based on current state
   */
  updateVisibility() {
    if (this.state === HexGridState.PLACEHOLDER) {
      this.placeholder?.show()
      this.gridHelper?.hide()
    } else {
      this.fadeOut()
      // gridHelper visibility controlled separately via setHelperVisible()
    }
  }

  /**
   * Set helper visibility (works for both POPULATED and PLACEHOLDER states)
   */
  setHelperVisible(visible) {
    if (this.gridHelper) {
      if (visible) {
        this.gridHelper.show()
      } else {
        this.gridHelper.hide()
      }
    }
  }

  /**
   * Set hover state on placeholder button
   */
  setHover(isHovered) {
    this.placeholder?.setHover(isHovered)
  }

  /**
   * Get the placeholder button for raycasting
   */
  getPlaceholderButton() {
    return this.placeholder?.getButton()
  }

  /**
   * Get all placeholder clickables (button + triangles) for raycasting
   */
  getPlaceholderClickables() {
    return this.placeholder?.getClickables() ?? []
  }

  /**
   * Create always-visible grid coordinate label
   */
  createGridLabel(gridKey) {
    const div = document.createElement('div')
    div.className = 'grid-label'
    div.textContent = gridKey
    div.style.cssText = `
      color: yellow;
      font-family: monospace;
      font-size: 16px;
      font-weight: bold;
      background: rgba(0,0,0,0.7);
      padding: 4px 8px;
      border-radius: 4px;
      white-space: nowrap;
      pointer-events: none;
    `
    const label = new CSS2DObject(div)
    label.position.set(0, 3, 0)
    label.visible = false  // Hidden by default
    return label
  }

  /**
   * Set grid label visibility
   */
  setGridLabelVisible(visible) {
    if (this.gridLabel) {
      this.gridLabel.visible = visible
    }
  }

  /**
   * Update placeholder triangle indicators for neighbor directions
   * @param {number[]} directions - Array of directions (0-5) that have populated neighbors
   */
  setPlaceholderNeighbors(directions) {
    this.placeholder?.setNeighborDirections(directions)
  }

  /**
   * Get local position of a tile within this grid's group
   */
  getTileLocalPosition(gridX, gridZ) {
    return HexTileGeometry.getWorldPosition(
      gridX - this.gridRadius,
      gridZ - this.gridRadius
    )
  }

  /**
   * Fade in placeholder and outline from invisible
   * @param {number} delay - ms to wait before starting fade
   */
  fadeIn(delay = 0) {
    if (this.placeholder) {
      this.placeholder.fadeIn(delay)
    }
    if (this.outline) {
      clearTimeout(this._outlineFadeTimer)
      gsap.killTweensOf(this.outline.material)
      this.outline.visible = false
      this._outlineFadeTimer = setTimeout(() => {
        if (!this.outline) return
        this.outline.visible = true
        this.outline.material.opacity = 0
        gsap.to(this.outline.material, {
          opacity: 1,
          duration: 0.3,
          ease: 'power2.out',
        })
      }, delay)
    }
  }

  /**
   * Fade out placeholder (outline visibility is controlled separately via GUI)
   */
  fadeOut() {
    this.placeholder?.fadeOut()
  }

  /**
   * Populate from cube-coordinate WFC results
   * @param {Array} tiles - [{q,r,s,type,rotation,level}] solved tiles in global cube coords
   * @param {Array} collapseOrder - [{q,r,s,type,rotation,level}] in WFC collapse order for animation
   * @param {Object} globalCenterCube - {q,r,s} grid center in global cube coords
   * @param {Object} options - { animate, animateDelay }
   */
  async populateFromCubeResults(tiles, collapseOrder, globalCenterCube, options = {}) {
    try {
      if (!this.hexMesh) {
        const success = await this.initMeshes(HexTileGeometry.geoms)
        if (!success) throw new Error('Failed to initialize meshes')
      }

      const baseSize = this.gridRadius * 2 + 1
      this.hexTiles = []
      this.hexGrid = Array.from({ length: baseSize }, () => Array(baseSize).fill(null))

      const placements = []
      for (const tile of tiles) {
        const { gridX, gridZ } = globalToLocalGrid(tile, globalCenterCube, this.gridRadius)
        placements.push({
          gridX, gridZ,
          type: tile.type,
          rotation: tile.rotation,
          level: tile.level,
        })
      }

      const localCollapseOrder = collapseOrder.map(tile => {
        const { gridX, gridZ } = globalToLocalGrid(tile, globalCenterCube, this.gridRadius)
        return {
          gridX, gridZ,
          type: tile.type,
          rotation: tile.rotation,
          level: tile.level,
        }
      })

      this.state = HexGridState.POPULATED
      this.updateVisibility()

      for (const placement of placements) {
        this.placeTile(placement)
      }
      this.updateMatrices()
      this.populateDecorations()

      if (HexTile.debugLevelColors) {
        this.updateTileColors()
      }

      const animate = options.animate ?? false
      const animateDelay = options.animateDelay ?? 20

      if (animate) {
        if (this.decorations) {
          for (const fan of this.decorations.windmillFans) {
            fan.tween?.pause()
          }
        }
        this.hideAllInstances()
        this.animationDone = new Promise(resolve => {
          this.animatePlacements(localCollapseOrder, animateDelay, resolve)
        })
      } else {
        this.animationDone = Promise.resolve()
      }

      const animDuration = animate ? localCollapseOrder.length * animateDelay : 0
      return animDuration
    } catch (error) {
      console.error('HexGrid.populateFromCubeResults failed:', error)
      return 0
    }
  }

  /**
   * Place a single tile
   */
  placeTile(placement) {
    const gridRadius = this.gridRadius
    const offsetCol = placement.gridX - gridRadius
    const offsetRow = placement.gridZ - gridRadius
    if (!isInHexRadius(offsetCol, offsetRow, gridRadius)) return null

    if (!this.hexGrid || placement.gridX < 0 || placement.gridX >= this.hexGrid.length ||
        placement.gridZ < 0 || placement.gridZ >= this.hexGrid[0].length) {
      console.warn(`[HexGrid] Tile placement out of bounds: (${placement.gridX}, ${placement.gridZ})`)
      return null
    }

    const tile = new HexTile(placement.gridX, placement.gridZ, placement.type, placement.rotation)
    tile.level = placement.level ?? 0
    tile.updateLevelColor()

    const biomeVal = this.biome === 'winter' ? 0.5 : (this.biome === 'wasteland' ? 1.0 : 0.0)
    tile.color.g = biomeVal
    tile.color.b = 0.0

    this.hexGrid[placement.gridX][placement.gridZ] = tile
    this.hexTiles.push(tile)

    if (this.hexMesh && this.geomIds.has(placement.type)) {
      const geomId = this.geomIds.get(placement.type)
      tile.instanceId = this.hexMesh.addInstance(geomId)
      this.hexMesh.setColorAt(tile.instanceId, tile.color)
      this.dummy.scale.setScalar(0)
      this.dummy.updateMatrix()
      this.hexMesh.setMatrixAt(tile.instanceId, this.dummy.matrix)
    }

    return tile
  }

  /**
   * Replace an existing tile with a different type/rotation
   * Used by neighbor tile replacement and rebuild-wfc
   */
  replaceTile(gridX, gridZ, newType, newRotation, newLevel = 0) {
    if (!this.hexGrid) return null
    const oldTile = this.hexGrid[gridX]?.[gridZ]
    if (!oldTile) {
      console.warn(`[replaceTile] No tile at (${gridX}, ${gridZ})`)
      return null
    }

    // Kill any running drop animation on this tile
    if (oldTile._anim) {
      gsap.killTweensOf(oldTile._anim)
      oldTile._anim = null
    }

    // Update tile data
    oldTile.type = newType
    oldTile.rotation = newRotation
    oldTile.level = newLevel
    oldTile.updateLevelColor()
    const biomeVal = this.biome === 'winter' ? 0.5 : (this.biome === 'wasteland' ? 1.0 : 0.0)
    oldTile.color.g = biomeVal
    oldTile.color.b = 0.0

    // Update BatchedMesh geometry
    if (this.hexMesh && this.geomIds.has(newType) && oldTile.instanceId !== undefined) {
      const newGeomId = this.geomIds.get(newType)
      this.hexMesh.setGeometryIdAt(oldTile.instanceId, newGeomId)
      this.hexMesh.setColorAt(oldTile.instanceId, oldTile.color)

      // Update matrix for new rotation
      const offsetCol = gridX - this.gridRadius
      const offsetRow = gridZ - this.gridRadius
      const pos = HexTileGeometry.getWorldPosition(offsetCol, offsetRow)
      this.dummy.position.set(pos.x, oldTile.level * LEVEL_HEIGHT, pos.z)
      this.dummy.rotation.y = -oldTile.rotation * Math.PI / 3
      this.dummy.scale.setScalar(1)
      this.dummy.updateMatrix()
      this.hexMesh.setMatrixAt(oldTile.instanceId, this.dummy.matrix)

      // Update bottom fill
      const fillKey = `${gridX},${gridZ}`
      const existingFillId = this.bottomFills.get(fillKey)
      if (existingFillId !== undefined) {
        this.hexMesh.deleteInstance(existingFillId)
        this.bottomFills.delete(fillKey)
      }
      if (newLevel >= 1 && this.bottomGeomId !== null) {
        const fillId = this.hexMesh.addInstance(this.bottomGeomId)
        this.hexMesh.setColorAt(fillId, oldTile.color)
        const tileY = newLevel * LEVEL_HEIGHT
        this.dummy.position.set(pos.x, tileY, pos.z)
        this.dummy.rotation.y = 0
        this.dummy.scale.set(1, tileY, 1)
        this.dummy.updateMatrix()
        this.hexMesh.setMatrixAt(fillId, this.dummy.matrix)
        this.bottomFills.set(fillKey, fillId)
      }
    }

    return oldTile
  }

  hideAllInstances() { _hideAllInstances(this) }
  animateTileDrop(tile, opts) { _animateTileDrop(this, tile, opts) }
  animatePlacements(collapseOrder, delay, onComplete) {
    const wrappedComplete = (...args) => {
      this._activeAnimations = this._activeAnimations.filter(a => a !== anim)
      onComplete?.(...args)
    }
    const anim = _animatePlacements(this, collapseOrder, delay, wrappedComplete)
    this._activeAnimations.push(anim)
    return anim
  }
  animateDecoration(items, onAllComplete) { _animateDecoration(this, items, onAllComplete) }

  /**
   * Update all tile matrices
   */
  updateMatrices() {
    if (!this.hexMesh || !this.hexTiles) return

    const dummy = this.dummy
    const rotationAngles = this._rotationAngles
    const gridRadius = this.gridRadius

    for (const fillId of this.bottomFills.values()) {
      this.hexMesh.deleteInstance(fillId)
    }
    this.bottomFills = new Map()

    for (const tile of this.hexTiles) {
      if (tile.instanceId === null) continue

      const pos = HexTileGeometry.getWorldPosition(
        tile.gridX - gridRadius,
        tile.gridZ - gridRadius
      )
      dummy.position.set(pos.x, tile.level * LEVEL_HEIGHT, pos.z)
      dummy.scale.set(1, 1, 1)
      dummy.rotation.y = rotationAngles[tile.rotation]
      dummy.updateMatrix()

      this.hexMesh.setMatrixAt(tile.instanceId, dummy.matrix)
      this.hexMesh.setVisibleAt(tile.instanceId, true)

      if (tile.level >= 1 && this.bottomGeomId !== null) {
        const fillId = this.hexMesh.addInstance(this.bottomGeomId)
        this.hexMesh.setColorAt(fillId, tile.color)
        const tileY = tile.level * LEVEL_HEIGHT
        dummy.position.set(pos.x, tileY, pos.z)
        dummy.rotation.y = 0
        dummy.scale.set(1, tileY, 1)
        dummy.updateMatrix()
        this.hexMesh.setMatrixAt(fillId, dummy.matrix)
        this.bottomFills.set(`${tile.gridX},${tile.gridZ}`, fillId)
      }
    }
  }

  /**
   * Populate decorations (trees, buildings, bridges)
   */
  populateDecorations() {
    if (!this.decorations) return
    this.decorations.populateBuildings(this.hexTiles, this.hexGrid, this.gridRadius)
    this.decorations.populate(this.hexTiles, this.gridRadius)
    this.decorations.populateFlowers(this.hexTiles, this.gridRadius)
    this.decorations.populateRocks(this.hexTiles, this.gridRadius)
    this.decorations.populateHillsAndMountains(this.hexTiles, this.gridRadius)
    this.decorations.populateBridges(this.hexTiles, this.gridRadius)
    this.decorations.populateWaterlilies(this.hexTiles, this.gridRadius)
  }

  /**
   * Update all tile colors (for debug level visualization toggle)
   */
  updateTileColors() {
    if (!this.hexMesh) return
    for (const tile of this.hexTiles) {
      tile.updateLevelColor()
      if (tile.instanceId !== null) {
        this.hexMesh.setColorAt(tile.instanceId, tile.color)
      }
    }
    this.updateSlopeArrows()
  }

  // Pointy-top hex direction unit vectors in XZ plane (+X=east, +Z=south)
  static HEX_DIR_VECTORS = {
    NE: new Vector3(0.5, 0, -Math.sqrt(3) / 2),
    E:  new Vector3(1, 0, 0),
    SE: new Vector3(0.5, 0, Math.sqrt(3) / 2),
    SW: new Vector3(-0.5, 0, Math.sqrt(3) / 2),
    W:  new Vector3(-1, 0, 0),
    NW: new Vector3(-0.5, 0, -Math.sqrt(3) / 2),
  }

  /**
   * Add/remove slope direction arrows for debug level visualization
   */
  updateSlopeArrows() {
    // Remove existing arrows
    if (this.slopeArrows) {
      for (const arrow of this.slopeArrows) this.group.remove(arrow)
    }
    this.slopeArrows = []

    if (!HexGrid.SHOW_SLOPE_ARROWS) return

    for (const tile of this.hexTiles) {
      if (!tile.isSlope()) continue

      const highEdges = tile.getHighEdges()
      if (!highEdges || highEdges.size === 0) continue

      // Average high edge directions to get slope direction
      const dir = new Vector3()
      for (const edge of highEdges) {
        const v = HexGrid.HEX_DIR_VECTORS[edge]
        dir.x += v.x
        dir.z += v.z
      }
      dir.normalize()

      const pos = HexTileGeometry.getWorldPosition(
        tile.gridX - this.gridRadius,
        tile.gridZ - this.gridRadius
      )
      const baseDef = TILE_LIST[tile.type]
      const increment = baseDef.levelIncrement ?? 1
      const topY = (tile.level + increment) * LEVEL_HEIGHT + 1.0 + 0.3

      const origin = new Vector3(pos.x, topY, pos.z)
      const arrow = new ArrowHelper(dir, origin, 1.0, 0xffffff, 0.3, 0.15)
      this.group.add(arrow)
      this.slopeArrows.push(arrow)
    }
  }

  /**
   * Clear all tiles
   */
  clearTiles() {
    if (this.hexMesh) {
      for (const tile of this.hexTiles) {
        if (tile.instanceId !== null) {
          this.hexMesh.deleteInstance(tile.instanceId)
        }
      }
      for (const fillId of this.bottomFills.values()) {
        this.hexMesh.deleteInstance(fillId)
      }
    }
    this.bottomFills = new Map()
    this.hexTiles = []
    this.hexGrid = null
  }

  /**
   * Dispose of all resources
   */
  dispose() {
    if (this._outlineFadeTimer) {
      clearTimeout(this._outlineFadeTimer)
      this._outlineFadeTimer = null
    }

    for (const anim of this._activeAnimations) {
      if (anim?.kill) anim.kill()
    }
    this._activeAnimations = []

    gsap.killTweensOf(this.outline)

    this.clearTiles()

    if (this.decorations) {
      this.decorations.dispose()
      this.decorations = null
    }

    if (this.gridHelper) {
      this.gridHelper.dispose()
      this.gridHelper = null
    }

    if (this.placeholder) {
      this.placeholder.dispose()
      this.placeholder = null
    }

    if (this.axesHelper) {
      this.axesHelper.dispose()
      this.axesHelper = null
    }

    if (this.gridLabel) {
      this.gridLabel.element?.remove()
      this.gridLabel = null
    }

    if (this.outline) {
      this.outline.geometry?.dispose()
      this.outline.material?.dispose()
      this.outline = null
    }

    if (this.hexMesh) {
      this.hexMesh.dispose()
      this.hexMesh = null
    }

    this.scene.remove(this.group)

    this.geomIds?.clear()
    this._initialized = false
  }
}
