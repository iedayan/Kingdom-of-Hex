import { Vector3 } from 'three/webgpu'
import { Line } from 'three/webgpu'
import { BufferGeometry } from 'three/webgpu'
import { Mesh } from 'three/webgpu'
import { RingGeometry } from 'three/webgpu'
import { MeshBasicMaterial } from 'three/webgpu'
import { LineBasicMaterial } from 'three/webgpu'
import { DoubleSide } from 'three/webgpu'
import { EventBus } from '../../core/events/EventBus.js'
import { getAttackDamage } from '../../gameplay/map-rules/biomeModifiers.js'

export class EnemyIntentSystem {
  constructor(app) {
    this.app = app
    this.container = null
    this.intents = new Map()
    this.visuals = []
  }

  mount() {
    this.container = document.createElement('div')
    this.container.id = 'enemy-intent-panel'
    this.container.style.cssText = `
      position: fixed;
      top: 80px;
      left: 20px;
      z-index: var(--hx-z-hud);
      display: flex;
      flex-direction: column;
      gap: 6px;
      pointer-events: none;
      max-width: 200px;
    `
    document.body.appendChild(this.container)

    EventBus.on('enemyIntentCalculate', () => {
      this.calculateIntents()
    })

    EventBus.on('turnEnd', () => {
      this.clearVisuals()
      this.intents.clear()
      if (this.container) this.container.innerHTML = ''
    })
  }

  calculateIntents() {
    const session = this.app?.game
    if (!session) return

    this.intents.clear()
    this.clearVisuals()

    const enemies = Array.from(session.objects.entries())
      .filter(([_, o]) => o.owner === 'enemy')
    
    const towerKeys = this._getPlayerTowerKeys(session)
    const towerNeighborSet = this._buildTowerNeighborSet(session, towerKeys)

    for (const [cKey, obj] of enemies) {
      const intent = this._calculateIntent(session, cKey, obj, towerNeighborSet)
      if (intent) {
        this.intents.set(cKey, intent)
      }
    }

    this.render()
  }

  _getPlayerTowerKeys(session) {
    return Array.from(session.objects.entries())
      .filter(([_, o]) => o?.type === 'tower' && o?.owner === 'player')
      .map(([key]) => key)
  }

  _buildTowerNeighborSet(session, towerKeys) {
    const set = new Set()
    for (const tk of towerKeys) {
      for (const n of session.getNeighbors(tk)) {
        set.add(n)
      }
    }
    return set
  }

  _calculateIntent(session, cKey, obj, towerNeighborSet) {
    const ai = session._enemyAISystem
    const neighbors = session.getNeighbors(cKey)
    const attackRange = Math.max(1, obj?.range || 1)
    const adjacentTargets = ai?._getTargetsInRange?.(cKey, attackRange) ?? neighbors.filter(n => {
      const t = session.objects.get(n)
      return t && t.owner === 'player'
    })

    if (adjacentTargets.length > 0) {
      const target = ai?._chooseTarget?.(adjacentTargets, cKey, obj) ?? this._chooseTarget(session, adjacentTargets)
      const targetObj = session.objects.get(target)
      const damage = getAttackDamage(session, this.app, cKey, obj, target, targetObj)
      const lethal = damage >= (targetObj?.hp ?? Infinity)
      return {
        type: 'attack',
        target,
        damage,
        lethal,
        attacker: obj.type,
        targetType: targetObj?.type,
        targetName: this._getDisplayName(targetObj?.type),
        icon: this._getAttackIcon(obj.type),
      }
    }

    const bestMove = ai?._chooseMove?.(neighbors, towerNeighborSet, cKey, obj) ?? this._chooseMove(session, cKey, obj, towerNeighborSet)
    if (bestMove) {
      return {
        type: 'move',
        destination: bestMove,
        icon: obj.type === 'goblin_slinger' ? '↗' : '→',
        attacker: obj.type,
      }
    }

    return null
  }

  _chooseTarget(session, targets) {
    return targets.slice().sort((a, b) => {
      const A = session.objects.get(a)
      const B = session.objects.get(b)
      
      const towerA = A?.type === 'tower' ? 1 : 0
      const towerB = B?.type === 'tower' ? 1 : 0
      if (towerA !== towerB) return towerB - towerA

      const hpA = A?.hp ?? 9999
      const hpB = B?.hp ?? 9999
      return hpA - hpB
    })[0]
  }

  _chooseMove(session, cKey, obj, towerNeighborSet) {
    const neighbors = session.getNeighbors(cKey)
    const candidates = neighbors.filter(n => !session.objects.has(n))
    if (candidates.length === 0) return null

    let best = null
    let bestScore = Infinity

    for (const toKey of candidates) {
      const dist = this._distanceToCapital(toKey)
      const towerThreat = towerNeighborSet.has(toKey) ? 1 : 0
      const adjacentPlayerCount = this._countAdjacentPlayer(session, toKey)

      const score = dist * 10 + towerThreat * 6 - adjacentPlayerCount * 0.5
      if (score < bestScore) {
        bestScore = score
        best = toKey
      }
    }
    return best
  }

  _distanceToCapital(cKey) {
    const [q1, r1] = cKey.split(',').map(Number)
    const [q2, r2] = [0, 0]
    return Math.max(Math.abs(q1 - q2), Math.abs(r1 - r2), Math.abs(-q1 - r1 - (-q2 - r2)))
  }

  _countAdjacentPlayer(session, cKey) {
    return session.getNeighbors(cKey).reduce((acc, nb) => {
      const t = session.objects.get(nb)
      return acc + (t && t.owner === 'player' ? 1 : 0)
    }, 0)
  }

  _getDisplayName(type) {
    const names = {
      scout: 'Scout',
      archer: 'Archer',
      knight: 'Knight',
      lumberjack: 'Lumberjack',
      farm: 'Farm',
      mine: 'Mine',
      market: 'Market',
      tower: 'Tower',
      library: 'Library'
    }
    return names[type] || type
  }

  _getAttackIcon(type) {
    const icons = {
      goblin: '⚔️',
      goblin_raider: '🗡️',
      goblin_brute: '🪓',
      goblin_slinger: '🏹',
    }
    return icons[type] || '⚔️'
  }

  render() {
    if (!this.container) return
    
    this.container.innerHTML = ''
    
    if (this.intents.size === 0) {
      this.container.style.display = 'none'
      return
    }
    
    this.container.style.display = 'flex'

    const header = document.createElement('div')
    header.style.cssText = `
      font-size: 10px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.5);
      letter-spacing: 2px;
      text-transform: uppercase;
      padding: 4px 0;
    `
    header.textContent = 'Enemy Intent'
    this.container.appendChild(header)

    for (const [cKey, intent] of this.intents) {
      const card = document.createElement('div')
      card.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        background: rgba(15, 18, 24, 0.92);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 6px;
        font-size: 11px;
        color: #fff;
        font-family: system-ui;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      `

      if (intent.type === 'attack') {
        card.innerHTML = `
          <span style="font-size: 14px;">${intent.icon}</span>
          <span style="color: ${intent.lethal ? '#fca5a5' : '#ef4444'}; font-weight: bold;">-${intent.damage}${intent.lethal ? ' KO' : ''}</span>
          <span style="color: rgba(255,255,255,0.7);">→</span>
          <span style="color: #4ade80;">${intent.targetName}</span>
        `
        
        this._drawAttackVisual(cKey, intent.target)
      } else if (intent.type === 'move') {
        card.innerHTML = `
          <span style="font-size: 14px;">${intent.icon}</span>
          <span style="color: rgba(255,255,255,0.5);">${this._getDisplayName(intent.attacker)} moving</span>
        `
        
        this._drawMoveVisual(cKey, intent.destination)
      }

      this.container.appendChild(card)
    }
  }

  _drawAttackVisual(fromKey, toKey) {
    if (!this.app?.unitManager) return
    
    const from = fromKey.split(',').map(Number)
    const to = toKey.split(',').map(Number)
    
    const fromPos = this.app.unitManager.getWorldPosition(from[0], from[1], from[2], 1)
    const toPos = this.app.unitManager.getWorldPosition(to[0], to[1], to[2], 1)
    
    const scene = this.app.scene
    const material = new LineBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.6 })
    const geometry = new BufferGeometry().setFromPoints([
      new Vector3(fromPos.x, fromPos.y + 0.5, fromPos.z),
      new Vector3(toPos.x, toPos.y + 0.5, toPos.z)
    ])
    const line = new Line(geometry, material)
    line.renderOrder = 1000
    scene.add(line)
    
    this.visuals.push(line)
  }

  _drawMoveVisual(fromKey, toKey) {
    if (!this.app?.unitManager) return
    
    const to = toKey.split(',').map(Number)
    
    const toPos = this.app.unitManager.getWorldPosition(to[0], to[1], to[2], 1)
    
    const scene = this.app.scene
    const geometry = new RingGeometry(0.3, 0.5, 16)
    geometry.rotateX(-Math.PI / 2)
    const material = new MeshBasicMaterial({ 
      color: 0xffa500, 
      transparent: true, 
      opacity: 0.5,
      side: DoubleSide
    })
    const ring = new Mesh(geometry, material)
    ring.position.set(toPos.x, toPos.y + 0.1, toPos.z)
    ring.renderOrder = 999
    scene.add(ring)
    
    this.visuals.push(ring)
  }

  clearVisuals() {
    const scene = this.app?.scene
    if (!scene) return
    
    for (const visual of this.visuals) {
      scene.remove(visual)
      if (visual.geometry) visual.geometry.dispose()
      if (visual.material) visual.material.dispose()
    }
    this.visuals = []
  }

  dispose() {
    this.clearVisuals()
    if (this.container?.parentElement) {
      this.container.parentElement.removeChild(this.container)
    }
  }
}
