import { HexUtils } from './HexUtils.js'
import { CAPITAL_CUBE_KEY } from './goals.js'
import { log } from '../core/logging/gameConsole.js'
import { getAttackDamage } from '../gameplay/map-rules/biomeModifiers.js'
import { COMBAT } from './constants.js'

export class EnemyAISystem {
  constructor(session, app, combatSystem) {
    this.session = session
    this.app = app
    this.combatSystem = combatSystem
  }

  async processEnemyTurn() {
    const enemies = Array.from(this.session.objects.entries())
      .filter(([_, o]) => o.owner === 'enemy')
    
    if (enemies.length === 0) return

    const towerKeys = this._getPlayerTowerKeys()
    const towerNeighborSet = this._buildTowerNeighborSet(towerKeys)
    const visibleEnemies = enemies.filter(([key]) => this.session.revealed.has(key))

    if (visibleEnemies.length > 0) {
      this.app.showTurnNotification('Enemies Advancing', 1500)
      await this._delay(800)
    }

    for (const [cKey, obj] of enemies) {
      await this._processEnemy(cKey, obj, towerNeighborSet)
    }

    await this._processTowerAttacks()
  }

  _getPlayerTowerKeys() {
    return Array.from(this.session.objects.entries())
      .filter(([_, o]) => o?.type === 'tower' && o?.owner === 'player')
      .map(([key]) => key)
  }

  _buildTowerNeighborSet(towerKeys) {
    const set = new Set()
    for (const tk of towerKeys) {
      for (const n of this.session.getNeighbors(tk)) {
        set.add(n)
      }
    }
    return set
  }

  async _processEnemy(cKey, obj, towerNeighborSet) {
    const neighbors = this.session.getNeighbors(cKey)
    const attackRange = Math.max(1, obj?.range || 1)
    const adjacentTargets = this._getTargetsInRange(cKey, attackRange)

    if (adjacentTargets.length > 0) {
      const target = this._chooseTarget(adjacentTargets, cKey, obj)
      await this.combatSystem.attack(cKey, target)
      await this._delay(800)
      if (this._checkCapitalOverrun()) return
      return
    }

    const bestMove = this._chooseMove(neighbors, towerNeighborSet, cKey, obj)
    if (bestMove) {
      this.session.moveUnit(cKey, bestMove)
      await this._delay(500)
      if (this._checkCapitalOverrun()) return
    }
  }

  _getTargetsInRange(originKey, range) {
    if (range <= 1) {
      return this.session.getNeighbors(originKey).filter(n => {
        const t = this.session.objects.get(n)
        return t && t.owner === 'player'
      })
    }
    const out = []
    for (const [key, obj] of this.session.objects.entries()) {
      if (obj.owner !== 'player') continue
      if (HexUtils.distance(originKey, key) <= range) out.push(key)
    }
    return out
  }

  // Backward-compatible helper kept for tests and legacy call sites.
  _getAdjacentTargets(neighbors) {
    return neighbors.filter(n => {
      const t = this.session.objects.get(n)
      return t && t.owner === 'player'
    })
  }

  _chooseTarget(targets, attackerKey = null, attacker = null) {
    return targets.slice().sort((a, b) => {
      const A = this.session.objects.get(a)
      const B = this.session.objects.get(b)

      const damageA = attacker ? getAttackDamage(this.session, this.app, attackerKey, attacker, a, A) : 0
      const damageB = attacker ? getAttackDamage(this.session, this.app, attackerKey, attacker, b, B) : 0
      const lethalA = damageA >= (A?.hp ?? Infinity) ? 1 : 0
      const lethalB = damageB >= (B?.hp ?? Infinity) ? 1 : 0
      if (lethalA !== lethalB) return lethalB - lethalA

      const threatA = COMBAT.TARGET_PRIORITIES?.[A?.type] ?? 0
      const threatB = COMBAT.TARGET_PRIORITIES?.[B?.type] ?? 0
      if (threatA !== threatB) return threatB - threatA

      const distA = HexUtils.distance(a, CAPITAL_CUBE_KEY)
      const distB = HexUtils.distance(b, CAPITAL_CUBE_KEY)
      if (distA !== distB) return distA - distB

      const hpA = A?.hp ?? 9999
      const hpB = B?.hp ?? 9999
      if (hpA !== hpB) return hpA - hpB

      return a.localeCompare(b)
    })[0]
  }

  _chooseMove(neighbors, towerNeighborSet, fromKey = null, enemy = null) {
    const candidates = neighbors.filter(n => !this.session.objects.has(n))
    if (candidates.length === 0) return null

    let best = null
    let bestScore = Infinity

    for (const toKey of candidates) {
      const dist = HexUtils.distance(toKey, CAPITAL_CUBE_KEY)
      const towerThreat = towerNeighborSet.has(toKey) ? 1 : 0
      const adjacentPlayerCount = this._countAdjacentPlayer(toKey)
      const adjacentStructureCount = this._countAdjacentPlayerStructures(toKey)
      const rangedTargets = this._getTargetsInRange(toKey, Math.max(1, enemy?.range || 1)).length

      const profile = this._getMovementProfile(enemy)
      const score =
        dist * profile.distanceWeight +
        towerThreat * profile.towerWeight -
        adjacentPlayerCount * profile.adjacentPlayerWeight -
        adjacentStructureCount * profile.adjacentStructureWeight -
        rangedTargets * profile.rangedPressureWeight

      if (score < bestScore || (score === bestScore && toKey.localeCompare(best ?? toKey) < 0)) {
        bestScore = score
        best = toKey
      }
    }
    return best
  }

  _countAdjacentPlayerStructures(cKey) {
    return this.session.getNeighbors(cKey).reduce((acc, nb) => {
      const t = this.session.objects.get(nb)
      const isStructure = t && t.owner === 'player' && !['scout', 'archer', 'knight'].includes(t.type)
      return acc + (isStructure ? 1 : 0)
    }, 0)
  }

  _getMovementProfile(enemy) {
    switch (enemy?.type) {
      case 'goblin_raider':
        return { distanceWeight: 12, towerWeight: 8, adjacentPlayerWeight: 1.5, adjacentStructureWeight: 3, rangedPressureWeight: 0.5 }
      case 'goblin_brute':
        return { distanceWeight: 9, towerWeight: 3, adjacentPlayerWeight: 1, adjacentStructureWeight: 4, rangedPressureWeight: 0.25 }
      case 'goblin_slinger':
        return { distanceWeight: 8, towerWeight: 7, adjacentPlayerWeight: -2, adjacentStructureWeight: 0.5, rangedPressureWeight: 3 }
      default:
        return { distanceWeight: 10, towerWeight: 6, adjacentPlayerWeight: 0.5, adjacentStructureWeight: 1.5, rangedPressureWeight: 1 }
    }
  }

  _countAdjacentPlayer(cKey) {
    return this.session.getNeighbors(cKey).reduce((acc, nb) => {
      const t = this.session.objects.get(nb)
      return acc + (t && t.owner === 'player' ? 1 : 0)
    }, 0)
  }

  async _processTowerAttacks() {
    const towers = Array.from(this.session.objects.entries())
      .filter(([_, o]) => o.type === 'tower')
    
    for (const [cKey, _] of towers) {
      const neighbors = this.session.getNeighbors(cKey)
      for (const n of neighbors) {
        const target = this.session.objects.get(n)
        if (target && target.owner === 'enemy') {
          await this.combatSystem.attack(cKey, n)
          await this._delay(800)
          break
        }
      }
    }
  }

  _checkCapitalOverrun() {
    const occ = this.session.objects.get(CAPITAL_CUBE_KEY)
    if (this.session.phase !== 'playing' || !occ || occ.owner !== 'enemy') return false
    log(`[GAME] Eternal Palace has fallen.`, 'color: #c45c5c')
    this.app.showTurnNotification('THE SEAT IS LOST', 2600)
    this.session.lose('capital')
    return true
  }

  _delay(ms) {
    return new Promise(res => setTimeout(res, ms))
  }
}
