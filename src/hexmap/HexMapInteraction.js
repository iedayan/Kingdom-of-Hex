import {
  MeshBasicNodeMaterial,
  MeshBasicMaterial,
  Mesh,
  Group,
  RingGeometry,
  Raycaster,
  Vector3,
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  LineSegments,
  LineBasicNodeMaterial,
  DoubleSide,
} from 'three/webgpu'
import { CSS2DObject } from 'three/examples/jsm/Addons.js'
import { CAPITAL_CUBE_KEY, CAPITAL_SEAT_NAME } from '../game/goals.js'
import { cubeKey, cubeCoordsInRadius, offsetToCube, cubeToOffset, localToGlobalCoords } from './HexWFCCore.js'
import { TILE_LIST } from './HexTileData.js'
import { HexGridState } from './HexGrid.js'
import { log } from '../core/logging/gameConsole.js'
import { App } from '../App.js'
import { createPlayerBuilding } from '../game/buildingStats.js'
import { Sounds } from '../core/audio/Sounds.js'
import { HexUtils } from '../game/HexUtils.js'
import { BUILDINGS, UNITS } from '../game/GameData.js'
import { assessPlacement } from '../gameplay/map-rules/placementRules.js'

/**
 * HexMapInteraction — hover highlight and pointer event handling.
 * Constructor receives reference to parent HexMap.
 */
export class HexMapInteraction {
  constructor(hexMap) {
    this.hexMap = hexMap
    this.raycaster = new Raycaster()
    this.hoveredGrid = null
    this.hoveredCubeKey = null
    this.hoverHighlight = null
    this.hoverFill = null
    this.hasClicked = false
    /** @type {Group | null} */
    this.capitalMarker = null

    /** @type {string | null} */
    this.selectedUnitKey = null

    // Move preview (MP) visuals
    this.moveReachGroup = null
    this.moveReachMarkers = []
    this.movePathLine = null
    this.movePathGeom = null
    this.movePathMaxSegments = 24
  }

  initHoverHighlight() {
    const scene = this.hexMap.scene
    const hexRadius = 2 / Math.sqrt(3)
    const maxVerts = 19 * 6 * 2 * 3
    const positions = new Float32Array(maxVerts)
    const geom = new BufferGeometry()
    geom.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geom.setDrawRange(0, 0)

    const mat = new LineBasicNodeMaterial({ color: 0xffffff })
    mat.depthTest = false
    mat.depthWrite = false
    mat.transparent = true
    mat.blending = AdditiveBlending

    this.hoverHighlight = new LineSegments(geom, mat)
    this.hoverHighlight.renderOrder = 999
    this.hoverHighlight.frustumCulled = false
    this.hoverHighlight.visible = false
    scene.add(this.hoverHighlight)

    const fillCount = 19 * 6 * 3 * 3
    const fillPositions = new Float32Array(fillCount)
    const fillNormals = new Float32Array(fillCount)
    // All normals point up (Y+)
    for (let i = 1; i < fillCount; i += 3) fillNormals[i] = 1
    const fillGeom = new BufferGeometry()
    fillGeom.setAttribute('position', new Float32BufferAttribute(fillPositions, 3))
    fillGeom.setAttribute('normal', new Float32BufferAttribute(fillNormals, 3))
    fillGeom.setDrawRange(0, 0)

    const fillMat = new MeshBasicNodeMaterial({ color: 0xffffff })
    fillMat.depthTest = false
    fillMat.depthWrite = false
    fillMat.transparent = true
    fillMat.opacity = 0.3
    fillMat.side = 2

    this.hoverFill = new Mesh(fillGeom, fillMat)
    this.hoverFill.renderOrder = 998
    this.hoverFill.frustumCulled = false
    this.hoverFill.visible = false
    scene.add(this.hoverFill)

    // ---------- Move preview ----------
    // Reachable tiles markers (updated on unit selection)
    this.moveReachGroup = new Group()
    this.moveReachGroup.name = 'MoveReachableTiles'
    this.moveReachGroup.renderOrder = 503
    this.moveReachGroup.visible = false
    scene.add(this.moveReachGroup)

    const markerGeom = new RingGeometry(0.18, 0.32, 16)
    markerGeom.rotateX(-Math.PI / 2)
    const markerMat = new MeshBasicMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.22,
      depthTest: false,
      blending: AdditiveBlending,
    })
    this._moveReachMarkerGeom = markerGeom
    this._moveReachMarkerMat = markerMat

    // Path line (updated on hover)
    const pathSegments = this.movePathMaxSegments
    const maxVertices = pathSegments * 2 // 2 vertices per segment
    const pathPositions = new Float32Array(maxVertices * 3)
    const pathGeom = new BufferGeometry()
    pathGeom.setAttribute('position', new Float32BufferAttribute(pathPositions, 3))
    pathGeom.setDrawRange(0, 0)
    const pathMat = new LineBasicNodeMaterial({ color: 0xffeacf })
    pathMat.depthTest = false
    pathMat.depthWrite = false
    pathMat.transparent = true
    pathMat.blending = AdditiveBlending

    this.movePathGeom = pathGeom
    this.movePathLine = new LineSegments(pathGeom, pathMat)
    this.movePathLine.renderOrder = 502
    this.movePathLine.frustumCulled = false
    this.movePathLine.visible = false
    scene.add(this.movePathLine)
  }

  /** Persistent ring + label on the capital (crown) hex once terrain exists there. */
  initCapitalMarker() {
    const scene = this.hexMap.scene
    const group = new Group()
    group.name = 'CapitalMarker'
    group.visible = false
    group.renderOrder = 500
    group.userData.pulsePhase = 0

    const hexRadius = 2 / Math.sqrt(3)
    // Hex edge loop — same footprint as placement hover; always visible above terrain
    const outlineVerts = new Float32Array(6 * 2 * 3)
    const outlineGeom = new BufferGeometry()
    outlineGeom.setAttribute('position', new Float32BufferAttribute(outlineVerts, 3))
    let oi = 0
    const oy = 0.04
    for (let i = 0; i < 6; i++) {
      const a1 = (i * Math.PI) / 3
      const a2 = (((i + 1) % 6) * Math.PI) / 3
      outlineVerts[oi++] = Math.sin(a1) * hexRadius
      outlineVerts[oi++] = oy
      outlineVerts[oi++] = Math.cos(a1) * hexRadius
      outlineVerts[oi++] = Math.sin(a2) * hexRadius
      outlineVerts[oi++] = oy
      outlineVerts[oi++] = Math.cos(a2) * hexRadius
    }
    const outlineMat = new LineBasicNodeMaterial({ color: 0xffcc66 })
    outlineMat.depthTest = false
    outlineMat.depthWrite = false
    outlineMat.transparent = true
    outlineMat.opacity = 0.95
    outlineMat.blending = AdditiveBlending
    const outline = new LineSegments(outlineGeom, outlineMat)
    outline.renderOrder = 504
    outline.frustumCulled = false
    group.add(outline)
    group.userData.outline = outline

    const glowGeom = new RingGeometry(1.0, 1.48, 64)
    glowGeom.rotateX(-Math.PI / 2)
    const glow = new Mesh(
      glowGeom,
      new MeshBasicMaterial({
        color: 0xffead0,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        depthTest: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      })
    )
    glow.position.y = 0.02
    glow.renderOrder = 500

    const bandGeom = new RingGeometry(0.92, 1.18, 6)
    bandGeom.rotateX(-Math.PI / 2)
    const band = new Mesh(
      bandGeom,
      new MeshBasicMaterial({
        color: 0xf0c278,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        depthTest: false,
      })
    )
    band.position.y = 0.03
    band.renderOrder = 501

    const innerGeom = new RingGeometry(0.8, 0.94, 6)
    innerGeom.rotateX(-Math.PI / 2)
    const inner = new Mesh(
      innerGeom,
      new MeshBasicMaterial({
        color: 0xfff8ee,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
        depthTest: false,
      })
    )
    inner.position.y = 0.035
    inner.renderOrder = 502

    group.add(glow)
    group.add(band)
    group.add(inner)
    group.userData.glow = glow
    group.userData.band = band
    group.userData.inner = inner

    const div = document.createElement('div')
    div.className = 'hx-capital-tag'
    div.innerHTML = `<span class="hx-capital-tag__crown">♦</span> ${CAPITAL_SEAT_NAME}`
    const label = new CSS2DObject(div)
    label.position.set(0, 1.48, 0)
    group.add(label)

    this.capitalMarker = group
    scene.add(group)
  }

  tickCapitalMarker(dt) {
    const g = this.capitalMarker
    if (!g?.visible) return
    g.userData.pulsePhase = (g.userData.pulsePhase ?? 0) + dt * 1.25
    const t = g.userData.pulsePhase
    const w = 0.5 + 0.5 * Math.sin(t * 2.2)

    const glow = g.userData.glow
    if (glow) {
      const s = 1 + 0.09 * w
      glow.scale.setScalar(s)
      glow.material.opacity = 0.12 + 0.14 * w
    }
    const band = g.userData.band
    if (band) {
      band.material.opacity = 0.78 + 0.16 * w
    }
    const inner = g.userData.inner
    if (inner) {
      inner.material.opacity = 0.42 + 0.22 * w
    }
    const outline = g.userData.outline
    if (outline?.material) {
      outline.material.opacity = 0.82 + 0.13 * w
    }
  }

  /** Call after globalCells includes the capital tile (e.g. after WFC populate). */
  syncCapitalMarker() {
    if (!this.capitalMarker) return
    const cell = this.hexMap.globalCells.get(CAPITAL_CUBE_KEY)
    if (!cell) {
      this.capitalMarker.visible = false
      return
    }
    const level = cell.level ?? 0
    const [cq, cr, cs] = CAPITAL_CUBE_KEY.split(',').map(Number)
    const um = App.instance?.unitManager
    const xz = um ? um.getWorldPosition(cq, cr, cs, level) : new Vector3(0, 0, 0)
    // Match placement-hover outline height so rings sit on the tile surface, not inside mesh
    const y = level * 0.5 + 1.02
    this.capitalMarker.position.set(xz.x, y, xz.z)
    this.capitalMarker.visible = true
  }

  updateHoverHighlight(cq, cr, cs) {
    const key = cubeKey(cq, cr, cs)
    if (key === this.hoveredCubeKey) return
    this.hoveredCubeKey = key

    const hexWidth = 2
    const hexHeight = 2 / Math.sqrt(3) * 2
    const hexRadius = 2 / Math.sqrt(3)

    const cell = this.hexMap.globalCells.get(key)
    const game = App.instance.game
    const selectedId = App.instance.selectedBuilding
    const selectedUnitId = App.instance.selectedUnitType // New state

    let isValid = false
    const hasMoveMode = !!this.selectedUnitKey && !selectedId && !selectedUnitId
    const moveUnit = hasMoveMode ? game?.objects?.get(this.selectedUnitKey) : null

    if (cell && game && !game.objects.has(key)) {
      if (hasMoveMode && moveUnit?.owner === 'player') {
        const mpRemaining = typeof moveUnit.mpRemaining === 'number' ? moveUnit.mpRemaining : (typeof moveUnit.mp === 'number' ? moveUnit.mp : 0)
        const pathData = HexUtils.findPath(this.selectedUnitKey, key, App.instance)
        isValid = !!(pathData && pathData.cost <= mpRemaining)
        if (isValid) this._setMovePathPreview(key, pathData)
        else this._hideMovePathPreview()
      } else {
        const def = TILE_LIST[cell.type]
        const result = assessPlacement({
          selectedBuilding: selectedId,
          selectedUnitType: selectedUnitId,
          isOccupied: false,
          isOwned: game.isOwned(key),
          tileName: def.name,
          tileLevel: cell.level ?? 0,
        })
        isValid = result.isValid
        this._hideMovePathPreview()
      }
    } else {
      // Hovering occupied/void tiles: only show reachability markers, not a path.
      this._hideMovePathPreview()
    }

    const color = isValid ? 0x00ff00 : 0xff0000
    this.hoverHighlight.material.color.setHex(color)
    this.hoverFill.material.color.setHex(color)

    const positions = this.hoverHighlight.geometry.attributes.position.array
    const fillPositions = this.hoverFill.geometry.attributes.position.array
    let idx = 0
    let fIdx = 0

    // Only highlight the single hovered cell for placement clarity
    const offset = cubeToOffset(cq, cr, cs)
    const cx = offset.col * hexWidth + (Math.abs(offset.row) % 2) * hexWidth * 0.5
    const cz = offset.row * hexHeight * 0.75
    const y = (cell?.level || 0) * 0.5 + 1.01 // Slightly above surface

    for (let i = 0; i < 6; i++) {
      const a1 = i * Math.PI / 3
      const a2 = ((i + 1) % 6) * Math.PI / 3
      const x1 = cx + Math.sin(a1) * hexRadius
      const z1 = cz + Math.cos(a1) * hexRadius
      const x2 = cx + Math.sin(a2) * hexRadius
      const z2 = cz + Math.cos(a2) * hexRadius

      positions[idx++] = x1; positions[idx++] = y; positions[idx++] = z1
      positions[idx++] = x2; positions[idx++] = y; positions[idx++] = z2

      fillPositions[fIdx++] = cx; fillPositions[fIdx++] = y; fillPositions[fIdx++] = cz
      fillPositions[fIdx++] = x1; fillPositions[fIdx++] = y; fillPositions[fIdx++] = z1
      fillPositions[fIdx++] = x2; fillPositions[fIdx++] = y; fillPositions[fIdx++] = z2
    }

    this.hoverHighlight.geometry.attributes.position.needsUpdate = true
    this.hoverHighlight.geometry.setDrawRange(0, idx / 3)
    this.hoverHighlight.visible = true

    this.hoverFill.geometry.attributes.position.needsUpdate = true
    this.hoverFill.geometry.setDrawRange(0, fIdx / 3)
    this.hoverFill.visible = true
  }

  clearHoverHighlight() {
    if (this.hoveredCubeKey !== null) {
      this.hoveredCubeKey = null
      this.hoverHighlight.visible = false
      this.hoverFill.visible = false
      this._hideMovePathPreview()
    }
  }

  _cubeCenterXZ(cq, cr, cs) {
    // Match hover/placement coordinate math for alignment.
    const hexWidth = 2
    const hexHeight = (2 / Math.sqrt(3)) * 2
    const hexRadius = 2 / Math.sqrt(3)
    void hexRadius // (kept for parity; radius isn't needed for center)
    const offset = cubeToOffset(cq, cr, cs)
    const cx = offset.col * hexWidth + (Math.abs(offset.row) % 2) * hexWidth * 0.5
    const cz = offset.row * hexHeight * 0.75
    return { x: cx, z: cz }
  }

  _hideMovePathPreview() {
    if (this.movePathLine) this.movePathLine.visible = false
    this._movePathLastTargetKey = null
  }

  clearMoveReachableTiles() {
    if (this.moveReachMarkers?.length > 0 && this.moveReachGroup) {
      for (const m of this.moveReachMarkers) this.moveReachGroup.remove(m)
    }
    this.moveReachMarkers = []
    if (this.moveReachGroup) this.moveReachGroup.visible = false
  }

  clearMovePreview() {
    this.clearMoveReachableTiles()
    this._hideMovePathPreview()
  }

  // Compute reachable empty tiles within MP budget (terrain-aware cost).
  updateMoveReachableTiles() {
    const game = App.instance?.game
    if (!game || !this.moveReachGroup || !this.selectedUnitKey) {
      this.clearMoveReachableTiles()
      return
    }

    const unit = game.objects.get(this.selectedUnitKey)
    if (!unit || unit.owner !== 'player') {
      this.clearMoveReachableTiles()
      return
    }

    const mpRemaining = typeof unit.mpRemaining === 'number' ? unit.mpRemaining : (typeof unit.mp === 'number' ? unit.mp : 0)
    if (mpRemaining <= 0) {
      this.clearMoveReachableTiles()
      return
    }

    this.clearMoveReachableTiles()

    // Simple Dijkstra (small MP => small reachable set).
    const costSoFar = new Map()
    costSoFar.set(this.selectedUnitKey, 0)
    const frontier = [{ key: this.selectedUnitKey, cost: 0 }]

    const passableUnitTypes = new Set(['scout', 'archer', 'knight'])

    while (frontier.length > 0) {
      frontier.sort((a, b) => a.cost - b.cost)
      const cur = frontier.shift()
      if (cur.cost > mpRemaining) continue

      const neighbors = HexUtils.getNeighbors(cur.key)
      for (const nb of neighbors) {
        const cell = this.hexMap.globalCells.get(nb)
        if (!cell) continue

        // Block impassable blockers for intermediate traversal.
        if (game.objects.has(nb) && nb !== this.selectedUnitKey) {
          const obj = game.objects.get(nb)
          if (obj.owner !== 'player' || !passableUnitTypes.has(obj.type)) continue
        }

        const terrainCost = cell.level >= 1 ? 2 : 1
        const newCost = cur.cost + terrainCost
        if (newCost > mpRemaining) continue

        const prev = costSoFar.get(nb)
        if (!costSoFar.has(nb) || newCost < prev) {
          costSoFar.set(nb, newCost)
          frontier.push({ key: nb, cost: newCost })
        }
      }
    }

    // Add markers only on empty destinations.
    for (const [k, cost] of costSoFar.entries()) {
      if (k === this.selectedUnitKey) continue
      if (cost > mpRemaining) continue
      if (game.objects.has(k)) continue
      const cell = this.hexMap.globalCells.get(k)
      if (!cell) continue

      const { q, r, s } = HexUtils.parse(k)
      const { x, z } = this._cubeCenterXZ(q, r, s)
      const y = (cell.level || 0) * 0.5 + 1.08

      const marker = new Mesh(this._moveReachMarkerGeom, this._moveReachMarkerMat)
      marker.renderOrder = 503
      marker.position.set(x, y, z)
      this.moveReachMarkers.push(marker)
      this.moveReachGroup.add(marker)
    }

    this.moveReachGroup.visible = this.moveReachMarkers.length > 0
  }

  // Draw A* path line from selected unit to hovered target.
  _setMovePathPreview(targetKey, pathData) {
    if (!this.movePathLine || !this.movePathGeom) return
    if (!pathData?.path || !Array.isArray(pathData.path)) return

    const game = App.instance?.game
    if (!game) return

    // Avoid recomputing if it's the same target.
    if (this._movePathLastTargetKey === targetKey) return
    this._movePathLastTargetKey = targetKey

    const startKey = this.selectedUnitKey
    const keys = [startKey, ...pathData.path]

    const posAttr = this.movePathGeom.attributes.position
    const arr = posAttr.array

    // Limit segments for safety.
    const maxSegments = this.movePathMaxSegments
    const numSegments = Math.min(maxSegments, Math.max(0, keys.length - 1))

    let idx = 0
    for (let i = 0; i < numSegments; i++) {
      const aKey = keys[i]
      const bKey = keys[i + 1]
      const a = HexUtils.parse(aKey)
      const b = HexUtils.parse(bKey)

      const aCell = this.hexMap.globalCells.get(aKey)
      const bCell = this.hexMap.globalCells.get(bKey)
      const aLevel = aCell?.level || 0
      const bLevel = bCell?.level || 0

      const axz = this._cubeCenterXZ(a.q, a.r, a.s)
      const bxz = this._cubeCenterXZ(b.q, b.r, b.s)

      const ay = aLevel * 0.5 + 1.02
      const by = bLevel * 0.5 + 1.02

      // Segment endpoints
      arr[idx++] = axz.x; arr[idx++] = ay; arr[idx++] = axz.z
      arr[idx++] = bxz.x; arr[idx++] = by; arr[idx++] = bxz.z
    }

    posAttr.needsUpdate = true
    this.movePathGeom.setDrawRange(0, idx / 3)
    this.movePathLine.visible = true
  }

  onPointerMove(pointer, camera) {
    const hm = this.hexMap
    this.raycaster.setFromCamera(pointer, camera)

    const placeholderClickables = []
    for (const grid of hm.grids.values()) {
      if (grid.state === HexGridState.PLACEHOLDER) {
        placeholderClickables.push(...grid.getPlaceholderClickables())
      }
    }

    this.raycaster.setFromCamera(pointer, camera)

    let newHovered = null
    if (placeholderClickables.length > 0) {
      const intersects = this.raycaster.intersectObjects(placeholderClickables)
      if (intersects.length > 0) {
        const clickable = intersects[0].object
        if (clickable.userData.isPlaceholder) {
          const candidate = clickable.userData.owner?.group?.userData?.hexGrid ?? null
          newHovered = candidate?._clickQueued ? null : candidate
        }
      }
    }

    if (newHovered !== this.hoveredGrid) {
      if (this.hoveredGrid) {
        this.hoveredGrid.setHover(false)
      }
      this.hoveredGrid = newHovered
      if (newHovered) {
        newHovered.setHover(true)
        if (this.hasClicked) Sounds.play('roll', 1.0, 0.2, 0.5)
        document.body.style.cursor = 'pointer'
      } else {
        document.body.style.cursor = ''
      }
    }

    if ('ontouchstart' in window) {
      this.clearHoverHighlight()
      return
    }
    const hexMeshes = []
    const meshToGrid = new Map()
    for (const grid of hm.grids.values()) {
      if (grid.state === HexGridState.POPULATED && grid.hexMesh) {
        hexMeshes.push(grid.hexMesh)
        meshToGrid.set(grid.hexMesh, grid)
      }
    }

    if (hexMeshes.length > 0) {
      const intersects = this.raycaster.intersectObjects(hexMeshes)
      if (intersects.length > 0) {
        const hit = intersects[0]
        const grid = meshToGrid.get(hit.object)
        const batchId = hit.batchId ?? hit.instanceId
        if (grid && batchId !== undefined) {
          const tile = grid.hexTiles.find(t => t.instanceId === batchId)
          if (tile) {
            const globalCube = grid.globalCenterCube ?? { q: 0, r: 0, s: 0 }
            const global = localToGlobalCoords(tile.gridX, tile.gridZ, grid.gridRadius, globalCube)
            const globalCubeCoords = offsetToCube(global.col, global.row)
            this.updateHoverHighlight(globalCubeCoords.q, globalCubeCoords.r, globalCubeCoords.s)

            // Update Ghost Preview + context hint
            const unitManager = App.instance.unitManager
            const selectedId = App.instance.selectedBuilding || App.instance.selectedUnitType
            const game = App.instance.game
            const hoveredKey = cubeKey(globalCubeCoords.q, globalCubeCoords.r, globalCubeCoords.s)
            const hoveredObj = game?.objects?.get(hoveredKey)
            const occupiedMsg = hoveredObj ? this._describeObject(hoveredObj) : null
            if (unitManager && selectedId) {
              // Snap ghost to tile center
              const hexWidth = 2
              const hexHeight = 2 / Math.sqrt(3) * 2
              const cx = global.col * hexWidth + (Math.abs(global.row) % 2) * hexWidth * 0.5
              const cz = global.row * hexHeight * 0.75
              const y = tile.level * 0.5 + 1.0
              const snapPos = new Vector3(cx, y, cz)
              
              // Check validity for color + reason
              const cell = this.hexMap.globalCells.get(cubeKey(globalCubeCoords.q, globalCubeCoords.r, globalCubeCoords.s))
              let isValid = false
              if (cell && game) {
                const def = TILE_LIST[cell.type]
                const result = assessPlacement({
                  selectedBuilding: App.instance.selectedBuilding,
                  selectedUnitType: App.instance.selectedUnitType,
                  isOccupied: game.objects.has(hoveredKey),
                  isOwned: game.isOwned(hoveredKey),
                  tileName: def.name,
                  tileLevel: cell.level ?? 0,
                })
                isValid = result.isValid
                if (!isValid) {
                  const extra = occupiedMsg ? ` (${occupiedMsg})` : ''
                  App.instance.gameHud?.setContextHint(`${result.reason}${extra}`, 'error')
                } else {
                  App.instance.gameHud?.setContextHint(`Valid tile for ${selectedId}.`, 'success')
                }
              }

              unitManager.setPreview(selectedId, snapPos, isValid)
            } else if (game && this.selectedUnitKey) {
              unitManager?.setPreview(null)
              const actingUnit = game.objects.get(this.selectedUnitKey)
              if (hoveredObj && hoveredObj.owner !== actingUnit?.owner) {
                const preview = game._combatSystem?.previewAttack?.(this.selectedUnitKey, hoveredKey)
                if (preview?.canAttack) {
                  const text = `Attack ${this._describeObject(hoveredObj)} for ${preview.damage} (${preview.distance}/${preview.range})${preview.lethal ? ' KO' : `, ${preview.remainingHp} HP left`}`
                  App.instance.gameHud?.setContextHint(text, preview.lethal ? 'success' : 'info')
                } else if (preview?.reason) {
                  App.instance.gameHud?.setContextHint(preview.reason, 'error')
                }
              } else if (!hoveredObj) {
                const pathData = HexUtils.findPath(this.selectedUnitKey, hoveredKey, App.instance)
                const mpRemaining = typeof actingUnit?.mpRemaining === 'number' ? actingUnit.mpRemaining : (typeof actingUnit?.mp === 'number' ? actingUnit.mp : 0)
                if (pathData) {
                  const tone = pathData.cost <= mpRemaining ? 'success' : 'error'
                  const suffix = pathData.cost <= mpRemaining ? '' : ' · out of reach'
                  App.instance.gameHud?.setContextHint(`Move costs ${pathData.cost}/${mpRemaining} MP${suffix}`, tone)
                } else {
                  App.instance.gameHud?.setContextHint('')
                }
              } else if (occupiedMsg) {
                App.instance.gameHud?.setContextHint(occupiedMsg, 'info')
              } else {
                App.instance.gameHud?.setContextHint('')
              }
            } else if (unitManager) {
              unitManager.setPreview(null)
              if (occupiedMsg) App.instance.gameHud?.setContextHint(occupiedMsg, 'info')
              else App.instance.gameHud?.setContextHint('')
            }

            return
          }
        }
      }
    }

    if (App.instance.unitManager) App.instance.unitManager.setPreview(null)
    App.instance.gameHud?.setContextHint('')
    this.clearHoverHighlight()
  }

  onPointerDown(pointer, camera) {
    this.hasClicked = true
    const hm = this.hexMap
    const placeholderClickables = []
    for (const grid of hm.grids.values()) {
      if (grid.state === HexGridState.PLACEHOLDER) {
        placeholderClickables.push(...grid.getPlaceholderClickables())
      }
    }

    this.raycaster.setFromCamera(pointer, camera)

    if (placeholderClickables.length > 0) {
      const intersects = this.raycaster.intersectObjects(placeholderClickables)
      if (intersects.length > 0) {
        const clickable = intersects[0].object
        if (clickable.userData.isPlaceholder) {
          const ownerGrid = clickable.userData.owner?.group?.userData?.hexGrid
          if (ownerGrid && ownerGrid.onClick && !ownerGrid._clickQueued) {
            Sounds.play('pop', 1.0, 0.2, 0.7)
            ownerGrid.onClick()
            return true
          }
        }
      }
    }

    // Tactical Interaction (Selection, Building, Deployment)
    const hexMeshes = []
    const meshToGrid = new Map()
    for (const grid of hm.grids.values()) {
      if (grid.state === HexGridState.POPULATED && grid.hexMesh) {
        hexMeshes.push(grid.hexMesh)
        meshToGrid.set(grid.hexMesh, grid)
      }
    }
    if (hexMeshes.length > 0) {
      const intersects = this.raycaster.intersectObjects(hexMeshes)
      if (intersects.length > 0) {
        const hit = intersects[0]
        const grid = meshToGrid.get(hit.object)
        const batchId = hit.batchId ?? hit.instanceId
        if (grid && batchId !== undefined) {
          const tile = grid.hexTiles.find(t => t.instanceId === batchId)
          if (tile) {
            const def = TILE_LIST[tile.type]
            const globalCube = grid.globalCenterCube ?? { q: 0, r: 0, s: 0 }
            const global = localToGlobalCoords(tile.gridX, tile.gridZ, grid.gridRadius, globalCube)
            const row = global.row // row was missing from previous context scope but used in offsetToCube
            const cube = offsetToCube(global.col, row)
            const cKey = cubeKey(cube.q, cube.r, cube.s)

            // 1. Selection Logic
            const game = App.instance.game
            const unitManager = App.instance.unitManager
            if (game && unitManager.units.has(cKey) && game.objects.get(cKey)?.owner === 'player') {
              this.selectedUnitKey = cKey
              unitManager.selectUnit(cKey)
              this.updateMoveReachableTiles()
              log(`[GAME] Selected unit at ${cKey}`, 'color: blue')
              return false
            } else if (game && unitManager.units.has(cKey) && game.objects.get(cKey)?.owner !== 'player') {
              const target = game.objects.get(cKey)
              App.instance.gameHud?.setContextHint(`Enemy selected: ${this._describeObject(target)}`, 'error')
              Sounds.play('incorrect', 1.0, 0.2, 0.8)
              return false
            }

            // 2. Unit Action Logic (Move or Attack)
            if (this.selectedUnitKey && !game.objects.has(cKey)) {
               const unit = game.objects.get(this.selectedUnitKey)
               const pathData = HexUtils.findPath(this.selectedUnitKey, cKey, App.instance)
               
               const mpRemaining = typeof unit.mpRemaining === 'number' ? unit.mpRemaining : (typeof unit.mp === 'number' ? unit.mp : 0)
               if (mpRemaining > 0 && pathData && pathData.cost <= mpRemaining) {
                 game.moveUnit(this.selectedUnitKey, cKey, pathData.cost)
                 this.selectedUnitKey = cKey
                 unitManager.selectUnit(cKey)
                 this.updateMoveReachableTiles()
                 return false
               } else {
                  if (pathData) log(`[MOVE] Too far! Costs ${pathData.cost} MP (Unit has ${unit.mp}).`, 'color: orange')
                  this.selectedUnitKey = null
                  unitManager.selectUnit(null)
                  this.clearMovePreview()
               }
            } else if (this.selectedUnitKey && game.objects.has(cKey)) {
               const target = game.objects.get(cKey)
               if (target.owner !== 'player') {
                  const attacker = game.objects.get(this.selectedUnitKey)
                  const mpRemaining = typeof attacker.mpRemaining === 'number' ? attacker.mpRemaining : (typeof attacker.mp === 'number' ? attacker.mp : 0)
                  if (mpRemaining <= 0) {
                    log('[COMBAT] Unit has no actions remaining.', 'color: orange')
                    Sounds.play('incorrect', 1.0, 0.2, 0.8)
                    return false
                  }
                  const dist = HexUtils.distance(this.selectedUnitKey, cKey)
                  
                  if (dist <= (attacker.range || 1)) {
                    game.attack(this.selectedUnitKey, cKey)
                    this.updateMoveReachableTiles()
                    return false
                  }
               }
            }

            log(`[TILE INFO] (${global.col},${global.row}) ${def?.name || '?'} type=${tile.type} rot=${tile.rotation} level=${tile.level}`, 'color: blue')

            // 3. Building & Deployment Logic
            const selectedId = App.instance.selectedBuilding
            const selectedUnitType = App.instance.selectedUnitType
            
            if (game && !game.objects.has(cKey)) {
              let cost, canBuild = false, meshName = '', objType = '', isUnit = false
              
              if (selectedUnitType) {
                isUnit = true
                const sData = UNITS[selectedUnitType]
                cost = sData.cost
                canBuild = (def.name === 'GRASS')
                objType = selectedUnitType
              } else if (selectedId) {
                if (!game.isOwned(cKey)) {
                  log(`[GAME] LOCKED territory. Expand your borders!`, 'color: orange')
                  Sounds.play('incorrect', 1.0, 0.2, 0.8)
                  return false
                }
                const bData = BUILDINGS[selectedId]
                const isFlatGrass = (def.name === 'GRASS' && tile.level === 0)
                const isAnyGrass = (def.name === 'GRASS')

                if (selectedId === 'lumberjack' && isFlatGrass) {
                  cost = bData.cost; canBuild = true; meshName = 'building_home_B_yellow'; objType = 'lumberjack'
                } else if (selectedId === 'farm' && isFlatGrass) {
                  cost = bData.cost; canBuild = true; meshName = 'building_windmill_yellow'; objType = 'farm'
                } else if (selectedId === 'mine' && isAnyGrass) {
                  cost = bData.cost; canBuild = true; meshName = 'mine'; objType = 'mine'
                } else if (selectedId === 'market' && isFlatGrass) {
                  cost = bData.cost; canBuild = true; meshName = 'building_market_yellow'; objType = 'market'
                } else if (selectedId === 'tower' && isAnyGrass) {
                  cost = bData.cost; canBuild = true; meshName = 'building_tower_A_yellow'; objType = 'tower'
                } else if (selectedId === 'library' && isFlatGrass) {
                  cost = bData.cost; canBuild = true; meshName = 'building_church_yellow'; objType = 'library'
                }
              }

              if (canBuild) {
                if (game.canAfford(cost)) {
                  game.pay(cost)
                  if (isUnit) {
                    game.spawnUnit(cKey, objType, 'player')
                    App.instance.selectedUnitType = null
                  } else {

                    const placed = createPlayerBuilding(objType, 'player', tile.level)
                    game.objects.set(cKey, placed)
                    grid.decorations.clearDecorationsAt(tile.gridX, tile.gridZ)
                    const pos = grid.getTileLocalPosition(tile.gridX, tile.gridZ)
                    
                    const biomeVal = grid.biome === 'winter' ? 0.5 : (grid.biome === 'wasteland' ? 1.0 : 0.0)
                    grid.decorations._placeInstance(grid.decorations.mesh, grid.decorations.geomIds, meshName, pos.x, tile.level * 0.5 + 1.0, pos.z, Math.random() * Math.PI * 2, 1, tile.level, biomeVal)
                    App.instance.selectedBuilding = null
                  }
                  game.onUpdateUI()
                  Sounds.play('good', 1.0, 0.2, 0.8)
                } else {
                  log('[TIP] Not enough resources — check the top bar or end turn for income.', 'color: orange')
                  App.instance.gameHud?.setContextHint('Not enough resources for this placement.', 'error')
                  Sounds.play('incorrect', 1.0, 0.2, 0.8)
                }
              } else if (selectedId || selectedUnitType) {
                const result = assessPlacement({
                  selectedBuilding: selectedId,
                  selectedUnitType,
                  isOccupied: false,
                  isOwned: game.isOwned(cKey),
                  tileName: def.name,
                  tileLevel: tile.level ?? 0,
                })
                App.instance.gameHud?.setContextHint(result.reason || 'Invalid placement.', 'error')
                Sounds.play('incorrect', 1.0, 0.2, 0.8)
              }
            }
          }
        }
      }
    }
    return false
  }

  _describeObject(obj) {
    if (!obj) return 'Unknown'
    const owner = obj.owner === 'enemy' ? 'Enemy' : 'Ally'
    const type = String(obj.type || 'object')
    const label = type.charAt(0).toUpperCase() + type.slice(1)
    return `${owner} ${label}`
  }
}
