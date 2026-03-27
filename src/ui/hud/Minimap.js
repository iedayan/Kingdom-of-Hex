import { EventBus } from '../../core/events/EventBus.js'

export class Minimap {
  constructor(app) {
    this.app = app
    this.container = null
    this.canvas = null
    this.ctx = null
    this.width = 180
    this.height = 180
    this.visible = true
    this.minimized = false
    this.updateInterval = null
    this.hovered = false
    
    this.colors = {
      unexplored: '#1a1d24',
      explored: '#2d3748',
      owned: '#4a5568',
      capital: '#ffd700',
      playerUnit: '#4ade80',
      enemyUnit: '#ef4444',
      building: '#60a5fa',
      grid: 'rgba(255,255,255,0.1)',
    }
  }

  mount() {
    this.container = document.createElement('div')
    this.container.id = 'minimap'
    this.container.style.cssText = `
      position: fixed;
      bottom: 100px;
      right: 20px;
      z-index: var(--hx-z-hud);
      background: rgba(15, 18, 24, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      overflow: hidden;
      transition: all 0.3s ease;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    `

    this.header = document.createElement('div')
    this.header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 10px;
      background: rgba(255, 255, 255, 0.05);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      cursor: move;
    `
    
    const title = document.createElement('span')
    title.textContent = 'MAP'
    title.style.cssText = `
      font-size: 10px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.6);
      letter-spacing: 2px;
    `
    
    const toggleBtn = document.createElement('button')
    toggleBtn.innerHTML = '−'
    toggleBtn.style.cssText = `
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.6);
      cursor: pointer;
      font-size: 16px;
      padding: 0 4px;
      line-height: 1;
    `
    toggleBtn.onclick = (e) => {
      e.stopPropagation()
      this.toggleMinimize()
    }
    
    this.header.appendChild(title)
    this.header.appendChild(toggleBtn)
    this.container.appendChild(this.header)

    this.canvas = document.createElement('canvas')
    this.canvas.width = this.width
    this.canvas.height = this.height
    this.canvas.style.cssText = `
      display: block;
      cursor: pointer;
    `
    this.ctx = this.canvas.getContext('2d')
    this.container.appendChild(this.canvas)

    this.canvas.onclick = (e) => this.onClick(e)
    this.canvas.onmousemove = () => this.hovered = true
    this.canvas.onmouseleave = () => this.hovered = false

    document.body.appendChild(this.container)
    
    this.updateInterval = setInterval(() => this.render(), 500)
    
    EventBus.on('unitMoved', () => this.render())
    EventBus.on('unitSpawned', () => this.render())
    EventBus.on('unitRemoved', () => this.render())
    
    this.render()
  }

  toggleMinimize() {
    this.minimized = !this.minimized
    if (this.minimized) {
      this.canvas.style.display = 'none'
      this.container.style.height = 'auto'
    } else {
      this.canvas.style.display = 'block'
      this.container.style.height = 'auto'
    }
  }

  onClick(e) {
    if (!this.app || !this.app.game) return
    
    const rect = this.canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    
    const bounds = this.getMapBounds()
    const worldX = bounds.minX + x * (bounds.maxX - bounds.minX)
    const worldZ = bounds.minZ + y * (bounds.maxZ - bounds.minZ)
    
    this.app.panToTile(`${worldX},0,${worldZ}`, 0.5)
  }

  getMapBounds() {
    const game = this.app?.game
    if (!game) return { minX: -50, maxX: 50, minZ: -50, maxZ: 50 }
    
    let minX = Infinity, maxX = -Infinity
    let minZ = Infinity, maxZ = -Infinity
    
    for (const key of game.revealed) {
      const [x, , z] = key.split(',').map(Number)
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minZ = Math.min(minZ, z)
      maxZ = Math.max(maxZ, z)
    }
    
    const padding = 5
    return {
      minX: minX - padding,
      maxX: maxX + padding,
      minZ: minZ - padding,
      maxZ: maxZ + padding
    }
  }

  worldToMinimap(x, z, bounds) {
    const rangeX = bounds.maxX - bounds.minX || 1
    const rangeZ = bounds.maxZ - bounds.minZ || 1
    const px = ((x - bounds.minX) / rangeX) * this.width
    const pz = ((z - bounds.minZ) / rangeZ) * this.height
    return { px, pz }
  }

  render() {
    if (!this.ctx || !this.app?.game) return
    
    const ctx = this.ctx
    const game = this.app.game
    const bounds = this.getMapBounds()
    
    ctx.fillStyle = this.colors.unexplored
    ctx.fillRect(0, 0, this.width, this.height)
    
    ctx.strokeStyle = this.colors.grid
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 6; i++) {
      const x = (i / 6) * this.width
      const y = (i / 6) * this.height
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, this.height)
      ctx.moveTo(0, y)
      ctx.lineTo(this.width, y)
      ctx.stroke()
    }
    
    for (const key of game.revealed) {
      const [x, , z] = key.split(',').map(Number)
      const { px, pz } = this.worldToMinimap(x, z, bounds)
      const isOwned = game.ownedTiles.has(key)
      
      ctx.fillStyle = isOwned ? this.colors.owned : this.colors.explored
      ctx.fillRect(px - 2, pz - 2, 4, 4)
    }
    
    const capital = this.worldToMinimap(0, 0, bounds)
    ctx.fillStyle = this.colors.capital
    ctx.beginPath()
    ctx.arc(capital.px, capital.pz, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1
    ctx.stroke()
    
    for (const [key, obj] of game.objects) {
      if (obj.owner !== 'player') continue
      if (!['scout', 'archer', 'knight'].includes(obj.type)) continue
      
      const [x, , z] = key.split(',').map(Number)
      const { px, pz } = this.worldToMinimap(x, z, bounds)
      
      ctx.fillStyle = this.colors.playerUnit
      ctx.beginPath()
      ctx.arc(px, pz, 3, 0, Math.PI * 2)
      ctx.fill()
    }
    
    for (const [key, obj] of game.objects) {
      if (obj.owner !== 'enemy') continue
      
      const [x, , z] = key.split(',').map(Number)
      const { px, pz } = this.worldToMinimap(x, z, bounds)
      
      ctx.fillStyle = this.colors.enemyUnit
      ctx.beginPath()
      ctx.arc(px, pz, 4, 0, Math.PI * 2)
      ctx.fill()
    }
    
    if (this.app.camera && !this.hovered) {
      const target = this.app.controls.target
      const { px, pz } = this.worldToMinimap(target.x, target.z, bounds)
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
      ctx.lineWidth = 2
      ctx.strokeRect(px - 8, pz - 6, 16, 12)
    }
  }

  dispose() {
    if (this.updateInterval) clearInterval(this.updateInterval)
    if (this.container?.parentElement) {
      this.container.parentElement.removeChild(this.container)
    }
  }
}
