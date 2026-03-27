import {
  BufferGeometry,
  Float32BufferAttribute,
  LineSegments,
  LineBasicNodeMaterial,
  Color,
} from 'three/webgpu'
import { HexUtils } from '../../game/HexUtils.js'
import { HexTileGeometry } from '../HexTiles.js'

/**
 * Renders glowing perimeter lines around player-owned territory.
 */
export class HexBorders {
  constructor(scene) {
    this.scene = scene
    this.geometry = new BufferGeometry()
    this.material = new LineBasicNodeMaterial({
      color: new Color(0xd4a574), // var(--hx-accent-gold)
      transparent: true,
      opacity: 0.6,
      linewidth: 2
    })
    this.mesh = new LineSegments(this.geometry, this.material)
    this.mesh.renderOrder = 10 // Render on top of terrain
    this.scene.add(this.mesh)
  }

  update(ownedKeys, globalCells) {
    const positions = []
    const hexRadius = 2 / Math.sqrt(3)
    
    // For every owned tile, check its 6 neighbors
    for (const key of ownedKeys) {
      const cell = globalCells.get(key)
      if (!cell) continue

      const neighbors = HexUtils.getNeighbors(key)
      const { q, r, s } = HexUtils.parse(key)
      
      // World position of this hex center
      const worldPos = this.getWorldPosition(q, r, s, cell.level)

      for (let i = 0; i < 6; i++) {
        const neighborKey = neighbors[i]
        
        // DRAW LINE if: neighbor is NOT owned OR neighbor doesn't exist (map edge)
        if (!ownedKeys.has(neighborKey)) {
          // Get the two vertices of this hex edge
          // Hex vertices indices (flat-top hex): 
          // 0: 30deg, 1: 90deg, 2: 150deg, 3: 210deg, 4: 270deg, 5: 330deg
          const a1 = (i * 60 + 30) * Math.PI / 180
          const a2 = ((i + 1) * 60 + 30) * Math.PI / 180
          
          const x1 = worldPos.x + Math.cos(a1) * hexRadius
          const z1 = worldPos.z + Math.sin(a1) * hexRadius
          const x2 = worldPos.x + Math.cos(a2) * hexRadius
          const z2 = worldPos.z + Math.sin(a2) * hexRadius
          const y = worldPos.y + 0.05 // Slightly above surface

          positions.push(x1, y, z1, x2, y, z2)
        }
      }
    }

    if (positions.length > 0) {
      this.geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
      this.mesh.visible = true
    } else {
      this.mesh.visible = false
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
    return { x, y, z }
  }
}
