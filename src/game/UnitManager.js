import { Group, Vector3, RingGeometry, MeshBasicMaterial, Mesh, Color, CylinderGeometry, SphereGeometry } from 'three/webgpu'
import { CSS2DObject } from 'three/examples/jsm/Addons.js'
import gsap from 'gsap'
import { Decorations } from '../hexmap/Decorations.js'
import { HexTileGeometry } from '../hexmap/HexTiles.js'
import { App } from '../App.js'

/**
 * Manages visual representation and smooth animations of units (Scouts, Goblins, etc.)
 */
export class UnitManager {
  constructor(scene, hexMap) {
    this.scene = scene
    this.hexMap = hexMap
    this.units = new Map() // cubeKey -> { group, mesh, data }
    
    // Selection highlight
    const ringGeom = new RingGeometry(0.8, 1.0, 32)
    ringGeom.rotateX(-Math.PI / 2)
    const ringMat = new MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.5 })
    this.selectionRing = new Mesh(ringGeom, ringMat)
    this.selectionRing.visible = false
    this.scene.add(this.selectionRing)

    this.previewMesh = null
  }

  setPreview(type, worldPos, isValid) {
    if (!type) {
      if (this.previewMesh) {
        this.scene.remove(this.previewMesh)
        this.previewMesh = null
      }
      return
    }

    if (!this.previewMesh || this.previewMesh.userData.type !== type) {
      if (this.previewMesh) this.scene.remove(this.previewMesh)
      
      let meshName = 'building_tower_A_yellow'
      if (type.startsWith('goblin')) meshName = 'fort'
      if (type === 'scout') meshName = 'building_well_yellow'
      if (type === 'archer') meshName = 'building_church_yellow'
      if (type === 'knight') meshName = 'building_tower_A_yellow'
      if (type === 'lumberjack') meshName = 'building_home_B_yellow'
      if (type === 'farm') meshName = 'building_windmill_yellow'
      if (type === 'mine') meshName = 'mine'
      if (type === 'market') meshName = 'building_market_yellow'
      if (type === 'tower') meshName = 'building_tower_A_yellow'
      if (type === 'library') meshName = 'building_church_yellow'

      const geom = Decorations.cachedGeoms.get(meshName)
      if (geom) {
        this.previewMesh = new Mesh(geom, this.hexMap.roadMaterial.clone())
        this.previewMesh.material.transparent = true
        this.previewMesh.material.opacity = 0.5
        this.previewMesh.userData.type = type
        this.scene.add(this.previewMesh)
      }
    }

    if (this.previewMesh) {
      this.previewMesh.position.copy(worldPos)
      this.previewMesh.material.color.setHex(isValid ? 0x00ff00 : 0xff0000)
      this.previewMesh.visible = true
    }
  }

  spawnUnit(cKey, type, owner) {
    const coords = cKey.split(',').map(Number)
    const q = coords[0], r = coords[1], s = coords[2]
    
    let level = 0
    const cell = this.hexMap.globalCells.get(cKey)
    if (cell) level = cell.level

    const worldPos = this.getWorldPosition(q, r, s, level)
    const group = new Group()
    group.position.copy(worldPos)
    this.scene.add(group)

    let meshName = 'building_tower_A_yellow'
    if (type.startsWith('goblin')) meshName = 'fort'
    if (type === 'scout') meshName = 'building_well_yellow'
    if (type === 'archer') meshName = 'building_church_yellow'
    if (type === 'knight') meshName = 'building_tower_A_yellow'
    
    const geom = Decorations.cachedGeoms.get(meshName)
    if (geom) {
      const ownerColor = owner === 'enemy' ? 0xff6b6b : 0x7dd3fc
      const material = this.hexMap.roadMaterial.clone()
      material.color = new Color(ownerColor)
      const mesh = new Mesh(geom, material)
      mesh.castShadow = true
      mesh.receiveShadow = true
      group.add(mesh)
      
      group.scale.setScalar(0)
      gsap.to(group.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'back.out(1.7)' })

      const hpDiv = document.createElement('div')
      hpDiv.style.cssText = `background:rgba(0,0,0,0.7); color:#ff4444; font-family:'Inter',sans-serif; font-weight:bold; font-size:10px; padding:2px 4px; border-radius:4px; pointer-events:none; border:1px solid #ff4444; white-space:nowrap;`
      hpDiv.textContent = 'HP: 10/10'
      const label = new CSS2DObject(hpDiv)
      label.position.set(0, 1.5, 0)
      group.add(label)
      group.userData.hpLabel = hpDiv

      const ownerDiv = document.createElement('div')
      const ownerText = owner === 'enemy' ? 'ENEMY' : 'ALLY'
      const ownerAccent = owner === 'enemy' ? '#ff6b6b' : '#7dd3fc'
      ownerDiv.style.cssText = `background:rgba(0,0,0,0.75); color:${ownerAccent}; font-family:'Inter',sans-serif; font-weight:800; font-size:10px; letter-spacing:0.06em; padding:1px 5px; border-radius:999px; pointer-events:none; border:1px solid ${ownerAccent}; white-space:nowrap;`
      ownerDiv.textContent = ownerText
      const ownerLabel = new CSS2DObject(ownerDiv)
      ownerLabel.position.set(0, 2.9, 0)
      group.add(ownerLabel)
      group.userData.ownerLabel = ownerDiv
    }

    const unitEntry = { group, type, owner, cKey, level }
    this.units.set(cKey, unitEntry)
    this.updateVisibility()
    return unitEntry
  }

  updateVisibility() {
    const revealed = App.instance?.game?.revealed
    if (!revealed) return
    for (const [cKey, unit] of this.units.entries()) {
      const isVisible = revealed.has(cKey)
      unit.group.visible = isVisible
      if (this.selectionRing.visible && this.selectionRing.userData.ownerKey === cKey && !isVisible) {
        this.selectionRing.visible = false
      }
    }
  }

  updateHP(cKey, current, max, rank = 1) {
    const unit = this.units.get(cKey)
    if (unit && unit.group.userData.hpLabel) {
      const star = rank > 1 ? `★${rank} ` : ''
      unit.group.userData.hpLabel.textContent = `${star}HP: ${current}/${max}`
    }
  }

  animateHit(cKey) {
    const unit = this.units.get(cKey)
    if (!unit) return
    const originalX = unit.group.position.x
    gsap.to(unit.group.position, {
      x: originalX + 0.1, duration: 0.05, yoyo: true, repeat: 5,
      onComplete: () => { if(unit.group) unit.group.position.x = originalX }
    })
  }

  async fireProjectile(fromKey, toKey, type = 'arrow') {
    const f = fromKey.split(',').map(Number)
    const t = toKey.split(',').map(Number)
    
    // Get world positions
    const fromPos = this.getWorldPosition(f[0], f[1], f[2], 1)
    const toPos = this.getWorldPosition(t[0], t[1], t[2], 1)
    
    // Create projectile mesh
    let geom, mat
    if (type === 'bolt') {
      geom = new SphereGeometry(0.1, 8, 8)
      mat = new MeshBasicMaterial({ color: 0x00ffff })
    } else {
      geom = new CylinderGeometry(0.02, 0.02, 0.5)
      geom.rotateX(Math.PI / 2)
      mat = new MeshBasicMaterial({ color: 0xffcc00 })
    }
    
    const projectile = new Mesh(geom, mat)
    projectile.position.copy(fromPos)
    projectile.lookAt(toPos)
    this.scene.add(projectile)
    
    // Animate arc
    const dist = fromPos.distanceTo(toPos)
    const duration = Math.max(0.3, dist * 0.15)
    
    return new Promise(resolve => {
      gsap.to(projectile.position, {
        x: toPos.x,
        z: toPos.z,
        duration: duration,
        ease: 'none'
      })
      
      // Arc height
      gsap.to(projectile.position, {
        y: toPos.y + 1.5,
        duration: duration / 2,
        ease: 'power1.out',
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          this.scene.remove(projectile)
          resolve()
        }
      })
    })
  }

  moveUnit(fromKey, toKey, onComplete) {
    const unit = this.units.get(fromKey)
    if (!unit) return
    const coords = toKey.split(',').map(Number)
    let level = 0
    const cell = this.hexMap.globalCells.get(toKey)
    if (cell) level = cell.level
    const targetPos = this.getWorldPosition(coords[0], coords[1], coords[2], level)

    gsap.to(unit.group.position, {
      x: targetPos.x, z: targetPos.z, duration: 0.6, ease: 'power2.inOut',
      onComplete: () => {
        this.units.delete(fromKey)
        unit.cKey = toKey
        unit.level = level
        this.units.set(toKey, unit)
        this.updateVisibility()
        if (onComplete) onComplete()
      }
    })
    gsap.to(unit.group.position, { y: targetPos.y, duration: 0.6, ease: 'power1.inOut' })
  }

  removeUnit(cKey) {
    const unit = this.units.get(cKey)
    if (unit) {
      gsap.to(unit.group.scale, {
        x: 0, y: 0, z: 0, duration: 0.3, onComplete: () => {
          unit.group.traverse((child) => {
            if (child.material?.dispose) child.material.dispose()
          })
          this.scene.remove(unit.group)
          this.units.delete(cKey)
        }
      })
    }
  }

  getWorldPosition(q, r, s, level) {
    const col = q + (r - (r & 1)) / 2
    const row = r
    const hexWidth = 2
    const hexHeight = 2 / Math.sqrt(3) * 2
    const x = col * hexWidth + (Math.abs(row) % 2) * hexWidth * 0.5
    const z = row * hexHeight * 0.75
    const y = level * 0.5 + 1.0
    return new Vector3(x, y, z)
  }

  selectUnit(cKey) {
    const unit = this.units.get(cKey)
    if (unit && unit.group.visible) {
      this.selectionRing.visible = true
      this.selectionRing.position.copy(unit.group.position)
      this.selectionRing.position.y -= 0.9
      this.selectionRing.userData.ownerKey = cKey
      
      this.updateUnitPips(cKey)
    } else {
      this.selectionRing.visible = false
      this.hideUnitPips()
    }
  }

  updateUnitPips(cKey) {
    const game = App.instance?.game
    const unit = this.units.get(cKey)
    if (!unit || !game) return
    
    const gameUnit = game.objects.get(cKey)
    if (!gameUnit) return
    
    const mp = gameUnit.mpRemaining ?? gameUnit.mp ?? 0
    const maxMp = gameUnit.mp ?? 3
    
    if (!unit.group.userData.mpLabel) {
      const mpDiv = document.createElement('div')
      mpDiv.style.cssText = `
        background: rgba(0,0,0,0.7);
        color: #60a5fa;
        font-family: 'Inter', sans-serif;
        font-weight: bold;
        font-size: 10px;
        padding: 2px 4px;
        border-radius: 4px;
        pointer-events: none;
        border: 1px solid #60a5fa;
        white-space: nowrap;
      `
      const label = new CSS2DObject(mpDiv)
      label.position.set(0, 2.2, 0)
      unit.group.add(label)
      unit.group.userData.mpLabel = mpDiv
    }
    
    let pips = ''
    for (let i = 0; i < maxMp; i++) {
      pips += i < mp ? '●' : '○'
    }
    unit.group.userData.mpLabel.textContent = `MP: ${pips}`
  }

  hideUnitPips() {
    for (const [cKey, unit] of this.units.entries()) {
      if (unit.group.userData.mpLabel) {
        unit.group.userData.mpLabel.textContent = ''
      }
    }
  }
}
