import { log } from '../core/logging/gameConsole.js'
import { getCubeNeighborKeys } from './hexTopology.js'
import { saveManager } from './SaveManager.js'
import { HexUtils } from './HexUtils.js'
import { getBiomeForCube } from '../gameplay/map-rules/gridAccess.js'
import { productionMultiplier, scaleYield } from '../gameplay/map-rules/biomeModifiers.js'
import { tryResolveWorldEvent } from '../gameplay/map-rules/worldEvents.js'
import { WIN_GOLD_GOAL, MAX_TURNS, CAPITAL_CUBE_KEY, CAPITAL_SEAT_NAME } from './goals.js'
import { random as seededRandom, createRng, hashSeed } from '../SeededRandom.js'
import { Sounds } from '../core/audio/Sounds.js'
import { EventBus } from '../core/events/EventBus.js'
import { CombatSystem } from './CombatSystem.js'
import { EnemyAISystem } from './EnemyAISystem.js'
import { ResearchSystem } from './ResearchSystem.js'
import {
  GAME,
  UNITS,
  PLAYER_UNIT_TYPES,
  PLAYER_RANGED_UNIT_TYPES,
  COMBAT,
  ECONOMY,
  ENEMY,
  META,
  VISION,
} from './constants.js'
import { RUN_MODIFIERS, defineOptionalObjectives, buildEnemyWavePlan, describeEnemyWavePlan, buildDecreeEvent, getRosterForIdentity } from './runContent.js'

export class GameSession {
  constructor({ seed, app }) {
    this.seed = seed
    this.app = app
    this.phase = 'playing'
    this.loseReason = null
    this.victoryReason = null
    this.elapsed = 0

    this.resources = {
      gold: GAME.STARTING_GOLD,
      wood: GAME.STARTING_WOOD,
      food: GAME.STARTING_FOOD,
      stone: GAME.STARTING_STONE,
      science: GAME.STARTING_SCIENCE,
    }
    this.turn = 1
    this.runModifier = null
    this.runRules = {
      farmGoldBonus: 0,
      playerCombatMultiplier: 1,
      harsherRaids: false,
      sciencePerTurnBonus: 0,
      foodYieldMultiplier: 1,
      marketGoldBonus: 0,
    }
    this.runStats = { enemyKills: 0 }
    this.objectives = defineOptionalObjectives()
    this.chosenDecrees = []
    this._decreeTurnsShown = []

    this.researched = new Set()
    this.currentResearch = null

    this.revealed = new Set([CAPITAL_CUBE_KEY])

    this.ownedTiles = new Set()
    this.claimRadius(CAPITAL_CUBE_KEY, VISION.CAPITAL_CLAIM_RADIUS)

    this.biomes = new Map()
    this.biomes.set('0,0', 'temperate')
    this.techTree = {
      'archery': { name: 'Archery', cost: 25, unlocks: ['archer'], requires: [], progress: 0 },
      'steel_working': { name: 'Steel Working', cost: 55, unlocks: ['knight'], requires: [], progress: 0 },
      'currency': { name: 'Currency', cost: 35, unlocks: ['market'], requires: [], progress: 0 },
      'ballistics': { name: 'Ballistics', cost: 70, unlocks: ['tower'], requires: ['archery'], progress: 0 },
      'scholarship': { name: 'Scholarship', cost: 15, unlocks: ['library'], requires: [], progress: 0 }
    }

    this.objects = new Map()

    this._endTurnHintUnmoved = false
    this.lastTurnReport = this._createEmptyTurnReport(this.turn)

    this.onUpdateUI = null
    this.onAfterTurn = null
    this.onObjectAdded = null
    this.onObjectRemoved = null
    this.onUnitSpawned = null
    this.onUnitMoved = null
    this.onUnitRemoved = null

    this._combatSystem = null
    this._enemyAISystem = null
    this._researchSystem = null
    this._initSystems()
  }

  _initSystems() {
    this._combatSystem = new CombatSystem(this, this.app)
    this._researchSystem = new ResearchSystem(this)
    this._enemyAISystem = new EnemyAISystem(this, this.app, this._combatSystem)
  }

  update(dt) {
    if (this.phase !== 'playing') return
    this.elapsed += dt
  }

  async nextTurn() {
    if (this.phase !== 'playing') return

    const prevTurn = this.turn
    this._endTurnHintUnmoved = this.countUnactedPlayerUnits(prevTurn) > 0

    this.turn++

    EventBus.emit('turnStart', { turn: this.turn })
    this._maybeOfferDecree()

    const delay = (ms) => new Promise(res => setTimeout(ms ? res : () => requestAnimationFrame(res), ms))
    const visibleEnemies = Array.from(this.objects.entries()).filter(([key, obj]) => obj.owner === 'enemy' && this.revealed.has(key))
    const quietTurn = visibleEnemies.length === 0 && !this._shouldSpawnEnemyWave(this.turn) && this.turn % 10 !== 0
    const introDelay = quietTurn ? 350 : 1000
    const resolutionDelay = quietTurn ? 350 : 1200

    if (this.app.actionBar) this.app.actionBar.style.pointerEvents = 'none'

    EventBus.emit('notification', { text: 'Economic Harvest', duration: 1500 })
    await delay(introDelay)

    const resourcesBeforeTurn = { ...this.resources }
    let incomes = { gold: 0, wood: 0, food: 0, stone: 0, science: GAME.BASE_SCIENCE_PER_TURN + (this.runRules.sciencePerTurnBonus || 0) }
    let foodUpkeep = 0
    const report = this._createEmptyTurnReport(this.turn)
    report.gross.science = incomes.science
    report.notes.push(`Base science +${incomes.science}`)
    for (const [cKey, obj] of this.objects.entries()) {
      if (obj.owner === 'player' && PLAYER_UNIT_TYPES.includes(obj.type)) {
        foodUpkeep += GAME.UNIT_FOOD_UPKEEP
      }
    }
    report.foodUpkeep = foodUpkeep

    for (const [cKey, obj] of this.objects.entries()) {
      if (obj.owner !== 'player') continue

      const biome = getBiomeForCube(this, this.app, cKey)
      const mult = productionMultiplier(biome, obj.type)
      const neighbors = this.getNeighbors(cKey)

      let gain = null
      if (obj.type === 'lumberjack') {
        const bonus = neighbors.filter(n => this.objects.get(n)?.type === 'lumberjack').length * ECONOMY.LUMBERJACK_BONUS_PER_ADJACENT
        gain = { type: 'wood', amount: scaleYield(ECONOMY.LUMBERJACK_YIELD + bonus, mult), color: '#cd853f', icon: '🪵' }
      }
      if (obj.type === 'farm') {
        const bonus = neighbors.filter(n => this.objects.get(n)?.type === 'farm').length * ECONOMY.FARM_BONUS_PER_ADJACENT
        gain = { type: 'food', amount: scaleYield((ECONOMY.FARM_YIELD + bonus) * (this.runRules.foodYieldMultiplier || 1), mult), color: '#98fb98', icon: '🌾' }
        const goldGain = scaleYield(ECONOMY.FARM_GOLD_YIELD + (this.runRules.farmGoldBonus || 0), mult)
        incomes.gold += goldGain
        EventBus.emit('floatingText', { text: `+${goldGain} 🪙`, position: cKey, color: '#ffd700' })
      }
      if (obj.type === 'mine') {
        const bonus = neighbors.filter(n => this.objects.get(n)?.type === 'mine').length * ECONOMY.MINE_BONUS_PER_ADJACENT
        gain = { type: 'stone', amount: scaleYield(ECONOMY.MINE_YIELD + bonus, mult), color: '#c0c0c0', icon: '🧱' }
      }
      if (obj.type === 'library') {
        gain = { type: 'science', amount: scaleYield(ECONOMY.LIBRARY_YIELD, mult), color: '#00ffff', icon: '🧪' }
      }

      if (gain) {
        incomes[gain.type] += gain.amount
        report.gross[gain.type] += gain.amount
        report.buildings[obj.type] = (report.buildings[obj.type] || 0) + gain.amount
        EventBus.emit('floatingText', { text: `+${gain.amount} ${gain.icon}`, position: cKey, color: gain.color })
      }

      if (obj.type === 'market') {
        const adjBuildings = neighbors.filter(n => {
          const adj = this.objects.get(n)
          return adj && adj.owner === 'player' && !PLAYER_UNIT_TYPES.includes(adj.type)
        }).length
        const marketGold = scaleYield(ECONOMY.MARKET_GOLD_BASE + adjBuildings * ECONOMY.MARKET_GOLD_PER_ADJACENT + (this.runRules.marketGoldBonus || 0), mult)

        if (this.resources.food + incomes.food - foodUpkeep >= ECONOMY.MARKET_FOOD_THRESHOLD) {
          incomes.food -= ECONOMY.MARKET_FOOD_COST
          incomes.gold += marketGold
          report.marketConversions += 1
          report.marketFoodSpent += ECONOMY.MARKET_FOOD_COST
          report.marketGoldGained += marketGold
          report.gross.gold += marketGold
          EventBus.emit('floatingText', { text: `+${marketGold} 🪙`, position: cKey, color: '#ffd700' })
        }
      }
    }

    EventBus.emit('floatingText', { text: `+${GAME.BASE_SCIENCE_PER_TURN} 🧪`, position: 'capital', color: '#00ffff' })

    this.resources.gold += incomes.gold
    this.resources.wood += incomes.wood
    this.resources.food += incomes.food
    this.resources.stone += incomes.stone
    this.resources.science += incomes.science

    tryResolveWorldEvent(this, this.app)
    report.worldEventTurn = this.turn > 1 && this.turn % 10 === 0

    if (foodUpkeep > 0) {
      if (this.resources.food >= foodUpkeep) {
        this.resources.food -= foodUpkeep
        report.upkeepPaid = foodUpkeep
        EventBus.emit('floatingText', { text: `-${foodUpkeep} 🌾 (UPKEEP)`, position: 'capital', color: '#ff4444' })
      } else {
        report.upkeepPaid = this.resources.food
        this.resources.food = 0
        report.starvation = true
        EventBus.emit('floatingText', { text: `STARVATION!`, position: 'capital', color: '#ff4444' })
        for (const [cKey, obj] of this.objects.entries()) {
          if (obj.owner === 'player' && PLAYER_UNIT_TYPES.includes(obj.type)) {
            obj.hp -= 2
            report.starvationHits += 1
            EventBus.emit('floatingText', { text: '-2 HP 🍖', position: cKey, color: '#ff4444' })
            if (obj.hp <= 0) {
              this.removeUnit(cKey)
              if (this.onObjectRemoved) this.onObjectRemoved(cKey, obj)
            }
          }
        }
      }
    }

    if (this.onUpdateUI) this.onUpdateUI()
    await delay(resolutionDelay)

    report.research = this._processResearch(report)

    EventBus.emit('enemyIntentCalculate')

    await this._enemyAISystem.processEnemyTurn()

    report.waveIncoming = this._shouldSpawnEnemyWave(this.turn)
    report.nextWaveTurn = this.getNextWaveTurn(this.turn + 1)
    if (report.waveIncoming) {
      this._processEnemyWave()
    }

    this._updateObjectives(report)

    this._finalizeTurnReport(report, resourcesBeforeTurn)
    this.lastTurnReport = report

    for (const obj of this.objects.values()) {
      if (obj.owner !== 'player') continue
      if (typeof obj.mp === 'number') obj.mpRemaining = obj.mp
      obj.movedThisTurn = false
    }

    if (this.app.actionBar) this.app.actionBar.style.pointerEvents = 'auto'
    if (this.onUpdateUI) this.onUpdateUI()

    if (this._endTurnHintUnmoved && this.phase === 'playing') {
      EventBus.emit('notification', { text: 'Some units have not acted yet.', duration: 1400 })
    }
    this._endTurnHintUnmoved = false

    EventBus.emit('turnEnd', { turn: this.turn, resources: this.resources, phase: this.phase, report: this.lastTurnReport })
    if (this.onAfterTurn) this.onAfterTurn(this.turn)

    const victory = this._checkVictoryConditions()
    if (victory) this.win(victory)
    else if (this.turn >= MAX_TURNS) this.lose()
  }

  _processEnemyWave() {
    const telegraph = this._buildWaveTelegraph(this.turn)
    if (telegraph?.spawns?.length > 0) {
      const spawnedTypes = []
      for (const spawn of telegraph.spawns) {
        this.spawnUnit(spawn.key, spawn.unitType, 'enemy')
        spawnedTypes.push(spawn.unitType)
        EventBus.emit('floatingText', { text: `${spawn.unitType.replace('goblin_', 'GOBLIN ').toUpperCase()} ARRIVES!`, position: spawn.key, color: 'var(--hx-danger)' })
      }
      if (spawnedTypes.length > 0) {
        EventBus.emit('notification', {
          text: telegraph.plan.encounter === 'boss' ? `${telegraph.plan.name} boss raid` : `${telegraph.plan.name} incoming`,
          duration: 1800,
        })
      }
    }
  }

  _pickWaveSpawnTile(available, unitType, rng) {
    const playerTargets = [...this.objects.entries()]
      .filter(([_, obj]) => obj.owner === 'player')
      .map(([key, obj]) => ({ key, obj }))

    let best = available[0]
    let bestScore = Infinity

    for (const tile of available) {
      const distCapital = HexUtils.distance(tile.key, CAPITAL_CUBE_KEY)
      let nearestStructure = 99
      let nearestTower = 99
      let nearestUnit = 99

      for (const target of playerTargets) {
        const distance = HexUtils.distance(tile.key, target.key)
        if (PLAYER_UNIT_TYPES.includes(target.obj.type)) {
          nearestUnit = Math.min(nearestUnit, distance)
        } else {
          nearestStructure = Math.min(nearestStructure, distance)
          if (target.obj.type === 'tower') nearestTower = Math.min(nearestTower, distance)
        }
      }

      const score = this._scoreWaveSpawn(unitType, {
        distCapital,
        nearestStructure,
        nearestTower,
        nearestUnit,
      }) + rng() * 0.01

      if (score < bestScore) {
        best = tile
        bestScore = score
      }
    }

    return best
  }

  _scoreWaveSpawn(unitType, metrics) {
    switch (unitType) {
      case 'goblin_raider':
        return metrics.nearestStructure * 5 + metrics.distCapital * 2 + metrics.nearestTower
      case 'goblin_slinger':
        return Math.abs(metrics.nearestUnit - 3) * 4 + metrics.nearestTower * 3 + metrics.distCapital
      case 'goblin_brute':
        return metrics.nearestTower * 6 + metrics.nearestStructure * 2 + metrics.distCapital
      default:
        return metrics.distCapital * 4 + metrics.nearestStructure * 2 + metrics.nearestUnit
    }
  }

  _shouldSpawnEnemyWave(turn) {
    const firstTurn = this.runRules.harsherRaids ? Math.max(6, ENEMY.FIRST_WAVE_TURN - 1) : ENEMY.FIRST_WAVE_TURN
    if (turn < firstTurn) return false
    return (turn - firstTurn) % ENEMY.WAVE_PERIOD === 0
  }

  getNextWaveTurn(fromTurn = this.turn) {
    const firstTurn = this.runRules.harsherRaids ? Math.max(6, ENEMY.FIRST_WAVE_TURN - 1) : ENEMY.FIRST_WAVE_TURN
    if (fromTurn <= firstTurn) return firstTurn
    const delta = fromTurn - firstTurn
    return firstTurn + Math.ceil(delta / ENEMY.WAVE_PERIOD) * ENEMY.WAVE_PERIOD
  }

  getUpcomingWavePreview() {
    const nextTurn = this.getNextWaveTurn()
    const plan = buildEnemyWavePlan(nextTurn, {
      harsherRaids: this.runRules.harsherRaids,
      seed: this.seed,
      identityId: this.runModifier,
    })
    return {
      turn: nextTurn,
      plan,
      summary: describeEnemyWavePlan(plan),
    }
  }

  getVictoryTracks() {
    const libraries = Array.from(this.objects.values()).filter((obj) => obj.owner === 'player' && obj.type === 'library').length
    const towers = Array.from(this.objects.values()).filter((obj) => obj.owner === 'player' && obj.type === 'tower').length
    const knowledgeValue = this.researched.size + Math.min(2, libraries)
    const fortressValue = Math.min(3, towers) + Math.min(2, Math.floor(this.runStats.enemyKills / 10))

    return [
      {
        id: 'treasury',
        label: 'Treasury',
        value: this.resources.gold,
        target: WIN_GOLD_GOAL,
        percent: Math.min(100, (this.resources.gold / WIN_GOLD_GOAL) * 100),
        completed: this.resources.gold >= WIN_GOLD_GOAL,
      },
      {
        id: 'knowledge',
        label: 'Knowledge',
        value: knowledgeValue,
        target: 6,
        percent: Math.min(100, (knowledgeValue / 6) * 100),
        completed: this.researched.size >= 4 && libraries >= 2,
      },
      {
        id: 'fortress',
        label: 'Fortress',
        value: fortressValue,
        target: 5,
        percent: Math.min(100, (fortressValue / 5) * 100),
        completed: this.turn >= 30 && towers >= 3 && this.runStats.enemyKills >= 20,
      },
    ]
  }

  getUpcomingRaidTelegraph(limit = 3) {
    const nextTurn = this.getNextWaveTurn()
    const telegraph = this._buildWaveTelegraph(nextTurn)
    if (!telegraph) return null
    return {
      turn: telegraph.turn,
      plan: telegraph.plan,
      spawns: telegraph.spawns.slice(0, limit),
    }
  }

  countUnactedPlayerUnits(turn = this.turn) {
    let count = 0
    for (const obj of this.objects.values()) {
      if (
        obj.owner === 'player' &&
        typeof obj.mpRemaining === 'number' &&
        obj.mpRemaining > 0 &&
        obj.movedThisTurn === false &&
        typeof obj.turnCreated === 'number' &&
        obj.turnCreated < turn
      ) {
        count++
      }
    }
    return count
  }

  getActionablePlayerUnits() {
    const rolePriority = { sentinel: 0, knight: 1, sageguard: 2, archer: 3, outrider: 4, scout: 5 }
    return Array.from(this.objects.entries())
      .filter(([_, obj]) => obj.owner === 'player' && PLAYER_UNIT_TYPES.includes(obj.type))
      .map(([key, obj]) => {
        const mpRemaining = typeof obj.mpRemaining === 'number' ? obj.mpRemaining : (typeof obj.mp === 'number' ? obj.mp : 0)
        const ready = mpRemaining > 0 && obj.movedThisTurn === false && typeof obj.turnCreated === 'number' && obj.turnCreated < this.turn
        return { key, obj, ready, mpRemaining }
      })
      .sort((a, b) => {
        if (a.ready !== b.ready) return a.ready ? -1 : 1
        if (a.mpRemaining !== b.mpRemaining) return b.mpRemaining - a.mpRemaining
        const pressureA = this.getThreatPreview(a.key, 'player').attackers
        const pressureB = this.getThreatPreview(b.key, 'player').attackers
        if (pressureA !== pressureB) return pressureB - pressureA
        const roleA = rolePriority[a.obj.type] ?? 9
        const roleB = rolePriority[b.obj.type] ?? 9
        if (roleA !== roleB) return roleA - roleB
        return a.key.localeCompare(b.key)
      })
  }

  getNextActionableUnitKey(currentKey = null) {
    const units = this.getActionablePlayerUnits()
    if (units.length === 0) return null
    const currentIndex = units.findIndex((entry) => entry.key === currentKey)
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % units.length : 0
    return units[nextIndex]?.key ?? null
  }

  getThreatPreview(targetKey, targetOwner = 'player', excludeKeys = []) {
    if (!targetKey) return { attackers: 0, totalDamage: 0 }
    const excluded = new Set(excludeKeys)
    const enemyOwner = targetOwner === 'player' ? 'enemy' : 'player'
    let attackers = 0
    let totalDamage = 0

    for (const [cKey, obj] of this.objects.entries()) {
      if (excluded.has(cKey) || obj.owner !== enemyOwner) continue
      if (enemyOwner === 'enemy' && !this.revealed.has(cKey)) continue
      const range = Math.max(1, obj.range || 1)
      if (HexUtils.distance(cKey, targetKey) > range) continue
      attackers += 1
      totalDamage += Math.max(1, typeof obj.atk === 'number' ? obj.atk : 1)
    }

    return { attackers, totalDamage }
  }

  getProjectedEconomySummary() {
    let foodIncome = 0
    let goldIncome = 0
    let foodUpkeep = 0
    let marketFoodSpent = 0

    for (const obj of this.objects.values()) {
      if (obj.owner === 'player' && PLAYER_UNIT_TYPES.includes(obj.type)) {
        foodUpkeep += GAME.UNIT_FOOD_UPKEEP
      }
    }

    for (const [cKey, obj] of this.objects.entries()) {
      if (obj.owner !== 'player') continue
      const biome = getBiomeForCube(this, this.app, cKey)
      const mult = productionMultiplier(biome, obj.type)
      const neighbors = this.getNeighbors(cKey)

      if (obj.type === 'farm') {
        const bonus = neighbors.filter((n) => this.objects.get(n)?.type === 'farm').length * ECONOMY.FARM_BONUS_PER_ADJACENT
        foodIncome += scaleYield((ECONOMY.FARM_YIELD + bonus) * (this.runRules.foodYieldMultiplier || 1), mult)
        goldIncome += scaleYield(ECONOMY.FARM_GOLD_YIELD + (this.runRules.farmGoldBonus || 0), mult)
      }

      if (obj.type === 'market') {
        const adjBuildings = neighbors.filter((n) => {
          const adj = this.objects.get(n)
          return adj && adj.owner === 'player' && !PLAYER_UNIT_TYPES.includes(adj.type)
        }).length
        const marketGold = scaleYield(ECONOMY.MARKET_GOLD_BASE + adjBuildings * ECONOMY.MARKET_GOLD_PER_ADJACENT + (this.runRules.marketGoldBonus || 0), mult)
        if (this.resources.food + foodIncome - foodUpkeep - marketFoodSpent >= ECONOMY.MARKET_FOOD_THRESHOLD) {
          marketFoodSpent += ECONOMY.MARKET_FOOD_COST
          goldIncome += marketGold
        }
      }
    }

    const foodAfterUpkeep = this.resources.food + foodIncome - marketFoodSpent - foodUpkeep
    return {
      foodIncome,
      foodUpkeep,
      marketFoodSpent,
      goldIncome,
      foodAfterUpkeep,
      starvationNextTurn: foodAfterUpkeep < 0,
    }
  }

  getEndTurnWarnings() {
    const warnings = []
    const readyUnits = this.getActionablePlayerUnits().filter((entry) => entry.ready)
    if (readyUnits.length > 0) {
      warnings.push(`${readyUnits.length} unit${readyUnits.length === 1 ? '' : 's'} still ready`)
    }

    const projected = this.getProjectedEconomySummary()
    if (projected.starvationNextTurn) {
      warnings.push(`Food deficit next turn (${projected.foodAfterUpkeep})`)
    } else if (projected.foodAfterUpkeep <= Math.max(6, projected.foodUpkeep)) {
      warnings.push('Food reserves will be tight next turn')
    }

    const nextWave = this.getUpcomingWavePreview()
    const turnsToWave = nextWave ? nextWave.turn - this.turn : null
    if (typeof turnsToWave === 'number' && turnsToWave <= 1) {
      const defenses = Array.from(this.objects.values()).filter((obj) =>
        obj.owner === 'player' && (obj.type === 'tower' || PLAYER_RANGED_UNIT_TYPES.includes(obj.type) || ['knight', 'sentinel'].includes(obj.type))
      ).length
      if (defenses === 0) warnings.push('Raid imminent and no frontline defense is ready')
      else warnings.push(`Raid on turn ${nextWave.turn}`)
    }

    return warnings
  }

  getRecruitableUnitTypes() {
    return getRosterForIdentity(this.runModifier)
  }

  getBiome(gridKey) {
    if (!this.biomes.has(gridKey)) {
      const types = ['temperate', 'winter', 'wasteland']
      const type = types[Math.floor(seededRandom() * types.length)]
      this.biomes.set(gridKey, type)
    }
    return this.biomes.get(gridKey)
  }

  canAfford(cost) {
    for (const [res, amount] of Object.entries(cost)) {
      if ((this.resources[res] || 0) < amount) return false
    }
    return true
  }

  pay(cost) {
    for (const [res, amount] of Object.entries(cost)) {
      this.resources[res] -= amount
    }
    if (this.onUpdateUI) this.onUpdateUI()
  }

  addObject(cKey, obj) {
    this.objects.set(cKey, obj)
    if (this.onObjectAdded) this.onObjectAdded(cKey, obj)
  }

  spawnUnit(cKey, type, owner) {
    const stats = UNITS[type] || UNITS.scout
    const s = { ...stats }
    let hpBonus = 0
    if (owner === 'player' && saveManager) {
      hpBonus = saveManager.getUpgradeBonus('fortified_walls')
    }
    const unit = {
      ...s,
      type,
      owner,
      cKey,
      xp: 0,
      rank: 1,
      hp: s.hp + hpBonus,
      maxHp: s.maxHp + hpBonus
    }
    if (owner === 'player') {
      unit.atk = Math.max(1, Math.round(unit.atk * (this.runRules.playerCombatMultiplier || 1)))
      unit.mpRemaining = typeof unit.mp === 'number' ? unit.mp : 0
      unit.movedThisTurn = false
      unit.turnCreated = this.turn
    }
    this.objects.set(cKey, unit)

    if (owner === 'player') this.revealRadius(cKey, unit.sight)
    if (this.onUnitSpawned) this.onUnitSpawned(cKey, unit)
    EventBus.emit('unitSpawned', { cKey, unit })
    return unit
  }

  moveUnit(fromKey, toKey, mpCost = null) {
    const unit = this.objects.get(fromKey)
    if (!unit) return

    // Guardrail: player interaction path always includes mpCost.
    // Enemy AI moves without mpCost, so block only this exploit path.
    if (unit.owner !== 'player' && typeof mpCost === 'number') return

    if (unit.owner === 'player' && typeof mpCost === 'number' && mpCost > 0) {
      const current = typeof unit.mpRemaining === 'number' ? unit.mpRemaining : (typeof unit.mp === 'number' ? unit.mp : 0)
      unit.mpRemaining = Math.max(0, current - mpCost)
      unit.movedThisTurn = true
    }

    this.objects.delete(fromKey)
    unit.cKey = toKey
    this.objects.set(toKey, unit)

    if (unit.owner === 'player') this.revealRadius(toKey, unit.sight)
    if (this.onUnitMoved) this.onUnitMoved(fromKey, toKey, unit)
    if (this.onUpdateUI) this.onUpdateUI()
    EventBus.emit('unitMoved', { from: fromKey, to: toKey, unit })
  }

  revealRadius(cKey, radius) {
    const { q: cq, r: cr, s: cs } = HexUtils.parse(cKey)
    for (let q = -radius; q <= radius; q++) {
      for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
        const s = -q - r
        const targetKey = HexUtils.key(cq + q, cr + r, cs + s)
        this.revealed.add(targetKey)
      }
    }
  }

  async attack(attackerKey, targetKey) {
    return this._combatSystem.attack(attackerKey, targetKey)
  }

  _processResearch() {
    if (!this.currentResearch || !this._researchSystem) return null

    const activeKey = this.currentResearch
    const activeTech = this.techTree[activeKey]
    const scienceBefore = this.resources.science
    const completed = this._researchSystem.processResearch()
    const scienceSpent = Math.max(0, scienceBefore - this.resources.science)
    if (completed) {
      EventBus.emit('floatingText', { text: 'TECH MASTERED!', position: 'capital', color: '#00ffff' })
    }
    if (this.onUpdateUI) this.onUpdateUI()
    return {
      key: completed || activeKey,
      name: activeTech?.name || completed,
      completed: Boolean(completed),
      scienceSpent,
      remainingScience: this.resources.science,
      progress: this.techTree[completed || activeKey]?.progress ?? activeTech?.progress ?? 0,
      cost: this.techTree[completed || activeKey]?.cost ?? activeTech?.cost ?? 0,
    }
  }

  checkLevelUp(cKey, unit) {
    const thresholds = COMBAT.RANK_THRESHOLDS
    const nextRank = unit.rank + 1
    if (nextRank > 3) return
    if (unit.xp >= thresholds[nextRank]) {
      unit.rank = nextRank
      unit.maxHp += COMBAT.HP_PER_RANK
      unit.hp = unit.maxHp
      this.refreshPlayerCombatBonuses()
      log(`[GAME] ${unit.type} reached Rank ${unit.rank}!`, 'color: gold')
      EventBus.emit('floatingText', { text: `RANK ${unit.rank} UP!`, position: cKey, color: '#ffd700' })
      EventBus.emit('unitRankUp', { unitType: unit.type, rank: unit.rank })
    }
  }

  getNeighbors(cKey) {
    return getCubeNeighborKeys(cKey)
  }

  _chooseEnemyAdjacentTarget(adjacentPlayerTargets) {
    return adjacentPlayerTargets
      .slice()
      .sort((a, b) => {
        const A = this.objects.get(a)
        const B = this.objects.get(b)
        const towerA = A?.type === 'tower' ? 1 : 0
        const towerB = B?.type === 'tower' ? 1 : 0
        if (towerA !== towerB) return towerB - towerA

        const distA = HexUtils.distance(a, CAPITAL_CUBE_KEY)
        const distB = HexUtils.distance(b, CAPITAL_CUBE_KEY)
        if (distA !== distB) return distA - distB

        const hpA = typeof A?.hp === 'number' ? A.hp : 9999
        const hpB = typeof B?.hp === 'number' ? B.hp : 9999
        return hpA - hpB
      })[0]
  }

  _chooseEnemyMove(neighbors, towerNeighborSet) {
    const candidates = neighbors.filter(n => !this.objects.has(n))
    if (candidates.length === 0) return null

    let best = null
    let bestScore = Infinity

    for (const toKey of candidates) {
      const dist = HexUtils.distance(toKey, CAPITAL_CUBE_KEY)
      const towerThreat = towerNeighborSet.has(toKey) ? 1 : 0
      const adjacentPlayerCount = this.getNeighbors(toKey).reduce((acc, nb) => {
        const t = this.objects.get(nb)
        return acc + (t && t.owner === 'player' ? 1 : 0)
      }, 0)

      const score = dist * 10 + towerThreat * 6 - adjacentPlayerCount * 0.5 + seededRandom() * 0.05
      if (score < bestScore) {
        bestScore = score
        best = toKey
      }
    }
    return best
  }

  _endRunIfCapitalOverrun() {
    const occ = this.objects.get(CAPITAL_CUBE_KEY)
    if (this.phase !== 'playing' || !occ || occ.owner !== 'enemy') return false
    log(`[GAME] ${CAPITAL_SEAT_NAME} has fallen.`, 'color: #c45c5c')
    EventBus.emit('notification', { text: 'THE SEAT IS LOST', duration: 2600 })
    this.lose('capital')
    return true
  }

  claimRadius(cKey, radius) {
    const { q: cq, r: cr, s: cs } = HexUtils.parse(cKey)
    for (let q = -radius; q <= radius; q++) {
      for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
        const s = -q - r
        const targetKey = HexUtils.key(cq + q, cr + r, cs + s)
        this.ownedTiles.add(targetKey)
      }
    }
  }

  isOwned(cKey) {
    return this.ownedTiles.has(cKey)
  }

  removeUnit(cKey) {
    const unit = this.objects.get(cKey)
    this.objects.delete(cKey)
    if (this.onUnitRemoved) this.onUnitRemoved(cKey, unit)
    EventBus.emit('unitRemoved', { cKey, unit })
  }

  removeObject(cKey) {
    const obj = this.objects.get(cKey)
    this.objects.delete(cKey)
    if (this.onObjectRemoved) this.onObjectRemoved(cKey, obj)
    EventBus.emit('objectRemoved', { cKey, obj })
  }

  applyRunModifier(modifierId) {
    if (!modifierId || this.runModifier) return
    const mod = RUN_MODIFIERS.find((m) => m.id === modifierId)
    if (!mod) return
    this.runModifier = mod.id
    mod.apply(this)
    this.refreshPlayerCombatBonuses()
    if (this.onUpdateUI) this.onUpdateUI()
    EventBus.emit('notification', { text: `Run Modifier: ${mod.name}`, duration: 2200 })
  }

  recordEnemyKill(type = 'goblin') {
    this.runStats.enemyKills += 1
  }

  _updateObjectives(report = null) {
    for (const obj of this.objectives) {
      if (obj.completed || obj.failed) continue
      if (this.turn > obj.deadline) {
        obj.failed = true
        continue
      }
      if (obj.check(this)) {
        obj.completed = true
        for (const [k, v] of Object.entries(obj.reward)) {
          this.resources[k] = (this.resources[k] || 0) + v
          if (report?.objectiveRewards?.[k] !== undefined) report.objectiveRewards[k] += v
        }
        if (report) report.completedObjectives.push(obj.title)
        EventBus.emit('notification', { text: `Objective Complete: ${obj.title}`, duration: 1900 })
      }
    }
  }

  getObjectiveSummary() {
    return this.objectives.map((o) => {
      const state = o.completed ? 'COMPLETED' : (o.failed ? 'FAILED' : `Turn ${o.deadline}`)
      return `${o.title} — ${state}`
    })
  }

  getLastTurnReport() {
    return this.lastTurnReport
  }

  getObjectiveMarkerData(limit = 3) {
    const active = this.objectives
      .filter((objective) => !objective.completed && !objective.failed)
      .sort((a, b) => a.deadline - b.deadline)

    const byKey = new Map()
    for (const objective of active) {
      const key = this._getObjectiveFocusKey(objective)
      if (!key) continue
      const existing = byKey.get(key) || { key, labels: [], deadline: objective.deadline }
      existing.labels.push(`${objective.title} T${objective.deadline}`)
      existing.deadline = Math.min(existing.deadline, objective.deadline)
      byKey.set(key, existing)
    }

    return Array.from(byKey.values())
      .sort((a, b) => a.deadline - b.deadline)
      .slice(0, limit)
      .map((entry) => ({
        key: entry.key,
        label: entry.labels.slice(0, 2).join(' · '),
        urgent: entry.deadline - this.turn <= 2,
      }))
  }

  win(reason = 'treasury') {
    this.phase = 'won'
    this.victoryReason = reason
    saveManager.clearSession()
    const lpGain = META.LP_WIN_FORMULA(this.resources.gold, this.resources.science)
    saveManager.addLP(lpGain)
    saveManager.data.wins++
    saveManager.data.runs++
    saveManager.data.stats.total_gold += this.resources.gold
    const milestone = saveManager.evaluateMilestones()
    saveManager.save()
    if (milestone.gained > 0) {
      EventBus.emit('notification', { text: `Milestones unlocked +${milestone.gained} LP`, duration: 2200 })
    }
    EventBus.emit('gameEnd', { victory: true, resources: this.resources, victoryReason: reason })
    if (this.onUpdateUI) this.onUpdateUI()
  }

  lose(reason = 'time') {
    this.phase = 'lost'
    this.loseReason = reason
    saveManager.clearSession()
    const lpGain = META.LP_LOSE_FORMULA(this.resources.gold, this.resources.science)
    saveManager.addLP(lpGain)
    saveManager.data.runs++
    saveManager.data.stats.total_gold += this.resources.gold
    const milestone = saveManager.evaluateMilestones()
    saveManager.save()
    if (milestone.gained > 0) {
      EventBus.emit('notification', { text: `Milestones unlocked +${milestone.gained} LP`, duration: 2200 })
    }
    EventBus.emit('gameEnd', { victory: false, reason, resources: this.resources })
    if (this.onUpdateUI) this.onUpdateUI()
  }

  serialize() {
    return {
      seed: this.seed,
      turn: this.turn,
      phase: this.phase,
      resources: { ...this.resources },
      researched: [...this.researched],
      currentResearch: this.currentResearch,
      techTree: JSON.parse(JSON.stringify(this.techTree)),
      objects: Array.from(this.objects.entries()),
      biomes: Array.from(this.biomes.entries()),
      revealed: [...this.revealed],
      ownedTiles: [...this.ownedTiles],
      runModifier: this.runModifier,
      runRules: { ...this.runRules },
      runStats: { ...this.runStats },
      objectives: JSON.parse(JSON.stringify(this.objectives)),
      lastTurnReport: this.lastTurnReport ? JSON.parse(JSON.stringify(this.lastTurnReport)) : null,
      chosenDecrees: [...this.chosenDecrees],
      decreeTurnsShown: [...this._decreeTurnsShown],
      victoryReason: this.victoryReason,
    }
  }

  deserialize(data) {
    this.turn = data.turn
    this.phase = data.phase
    this.resources = { ...data.resources }
    this.researched = new Set(data.researched)
    this.currentResearch = data.currentResearch
    this.techTree = data.techTree
    this.objects = new Map(data.objects)
    this.biomes = new Map(data.biomes)
    if (data.revealed) this.revealed = new Set(data.revealed)
    if (data.ownedTiles) this.ownedTiles = new Set(data.ownedTiles)
    if (data.runModifier) this.runModifier = data.runModifier
    if (data.runRules) this.runRules = { ...this.runRules, ...data.runRules }
    if (data.runStats) this.runStats = { ...this.runStats, ...data.runStats }
    if (data.objectives) this.objectives = data.objectives
    if (data.lastTurnReport) this.lastTurnReport = data.lastTurnReport
    if (data.chosenDecrees) this.chosenDecrees = [...data.chosenDecrees]
    if (data.decreeTurnsShown) this._decreeTurnsShown = [...data.decreeTurnsShown]
    if (data.victoryReason) this.victoryReason = data.victoryReason
  }

  refreshPlayerCombatBonuses() {
    for (const obj of this.objects.values()) {
      if (obj.owner !== 'player' || !UNITS[obj.type]) continue
      const rankBonus = Math.max(0, (obj.rank || 1) - 1) * COMBAT.ATK_PER_RANK
      const baseAtk = (UNITS[obj.type]?.atk || obj.atk || 1) + rankBonus
      obj.atk = Math.max(1, Math.round(baseAtk * (this.runRules.playerCombatMultiplier || 1)))
    }
  }

  _maybeOfferDecree() {
    if (![12, 24].includes(this.turn) || this._decreeTurnsShown.includes(this.turn)) return
    this._decreeTurnsShown.push(this.turn)
    const event = buildDecreeEvent(this.turn, this.seed)
    event.options = event.options.map((option) => ({
      ...option,
      act: (session) => {
        if (!session.chosenDecrees.includes(option.decreeId)) session.chosenDecrees.push(option.decreeId)
        const original = buildDecreeEvent(this.turn, this.seed).options.find((entry) => entry.decreeId === option.decreeId)
        original?.act(session)
        session.refreshPlayerCombatBonuses()
      },
    }))
    this.app?.showEventModal?.(event)
  }

  _checkVictoryConditions() {
    const tracks = this.getVictoryTracks()
    if (tracks.find((track) => track.id === 'treasury')?.completed) return 'treasury'
    if (tracks.find((track) => track.id === 'knowledge')?.completed) return 'knowledge'
    if (tracks.find((track) => track.id === 'fortress')?.completed) return 'fortress'
    return null
  }

  _createEmptyTurnReport(turn) {
    return {
      turn,
      gross: { gold: 0, wood: 0, food: 0, stone: 0, science: 0 },
      net: { gold: 0, wood: 0, food: 0, stone: 0, science: 0 },
      buildings: {},
      foodUpkeep: 0,
      upkeepPaid: 0,
      starvation: false,
      starvationHits: 0,
      marketConversions: 0,
      marketFoodSpent: 0,
      marketGoldGained: 0,
      objectiveRewards: { gold: 0, wood: 0, food: 0, stone: 0, science: 0 },
      completedObjectives: [],
      worldEventTurn: false,
      waveIncoming: false,
      nextWaveTurn: this.getNextWaveTurn(turn + 1),
      research: null,
      notes: [],
      warnings: [],
    }
  }

  _collectWaveSpawnCandidates() {
    const grassTiles = []
    for (const grid of this.app?.city?.grids?.values?.() || []) {
      for (const tile of grid.hexTiles || []) {
        if (tile.type === 0 || tile.type === 18 || tile.type === 21) {
          const q = tile.gridX - grid.gridRadius + (grid.globalCenterCube?.q || 0)
          const r = tile.gridZ - grid.gridRadius + (grid.globalCenterCube?.r || 0)
          const s = -q - r
          const key = `${q},${r},${s}`
          if (!this.objects.has(key) && key !== CAPITAL_CUBE_KEY) grassTiles.push({ key, q, r, s })
        }
      }
    }
    if (grassTiles.length === 0) return []
    const preferred = grassTiles.filter((tile) => {
      const d = HexUtils.distance(tile.key, CAPITAL_CUBE_KEY)
      return d >= ENEMY.SPAWN_DISTANCE_MIN && d <= ENEMY.SPAWN_DISTANCE_MAX
    })
    return preferred.length > 0 ? preferred : grassTiles
  }

  _buildWaveTelegraph(turn) {
    const candidates = this._collectWaveSpawnCandidates()
    if (candidates.length === 0) return null
    const plan = buildEnemyWavePlan(turn, {
      harsherRaids: this.runRules.harsherRaids,
      seed: this.seed,
      identityId: this.runModifier,
    })
    const rng = createRng(hashSeed(this.seed, 'wave-spawn', turn))
    const available = [...candidates]
    const spawns = []
    for (const unitType of plan.units) {
      if (available.length === 0) break
      const spawnAt = this._pickWaveSpawnTile(available, unitType, rng)
      const idx = available.findIndex((tile) => tile.key === spawnAt.key)
      if (idx >= 0) available.splice(idx, 1)
      spawns.push({ ...spawnAt, unitType })
    }
    return { turn, plan, spawns }
  }

  _getObjectiveFocusKey(objective) {
    const entries = Array.from(this.objects.entries())
    const pickFirst = (predicate) => entries.find(([key, obj]) => predicate(key, obj))?.[0] || CAPITAL_CUBE_KEY
    switch (objective.id) {
      case 'hold_choke':
        return pickFirst((_, obj) => obj.owner === 'player' && obj.type === 'tower')
      case 'clear_nest':
        return pickFirst((key, obj) => obj.owner === 'enemy' && this.revealed.has(key))
      case 'protect_caravan':
        return pickFirst((_, obj) => obj.owner === 'player' && ['scout', 'outrider'].includes(obj.type))
      case 'iron_frontier':
        return pickFirst((_, obj) => obj.owner === 'player' && obj.type === 'mine')
      case 'market_charter':
        return pickFirst((_, obj) => obj.owner === 'player' && (obj.type === 'market' || obj.type === 'library'))
      case 'standing_host':
        return pickFirst((_, obj) => obj.owner === 'player' && ['archer', 'knight', 'sentinel', 'sageguard'].includes(obj.type))
      case 'breadbasket':
        return pickFirst((_, obj) => obj.owner === 'player' && obj.type === 'farm')
      default:
        return CAPITAL_CUBE_KEY
    }
  }

  _finalizeTurnReport(report, resourcesBeforeTurn) {
    for (const key of Object.keys(report.net)) {
      report.net[key] = (this.resources[key] || 0) - (resourcesBeforeTurn[key] || 0)
    }

    if (report.marketConversions > 0) {
      report.notes.push(`Markets traded ${report.marketFoodSpent} food for ${report.marketGoldGained} gold`)
    }
    if (report.completedObjectives.length > 0) {
      report.notes.push(`Objective cleared: ${report.completedObjectives.join(', ')}`)
    }
    if (report.research?.scienceSpent) {
      const remaining = Math.max(0, (report.research.cost || 0) - (report.research.progress || 0))
      report.notes.push(
        report.research.completed
          ? `${report.research.name} completed`
          : `${report.research.name} advanced, ${remaining} science remaining`
      )
    }
    if (report.worldEventTurn) {
      report.notes.push('A world event was triggered this turn')
    }
    if (report.waveIncoming) {
      report.warnings.push('Raid reached the realm this turn')
    } else if (typeof report.nextWaveTurn === 'number') {
      const turnsUntilWave = Math.max(0, report.nextWaveTurn - this.turn)
      if (turnsUntilWave <= 2) {
        report.warnings.push(`Raid in ${turnsUntilWave} turn${turnsUntilWave === 1 ? '' : 's'}`)
      }
    }
    if (report.starvation) {
      report.warnings.push(`Starvation hit ${report.starvationHits} unit${report.starvationHits === 1 ? '' : 's'}`)
    } else if (this.resources.food <= Math.max(8, report.foodUpkeep)) {
      report.warnings.push('Food reserves are low')
    }
    if (this.resources.gold < 100) {
      report.warnings.push('Treasury is thin')
    }
  }

  dispose() {
    this.phase = 'stopped'
    EventBus.clear()
    this.app = null
    this.onUpdateUI = null
    this.onAfterTurn = null
    this.onObjectAdded = null
    this.onObjectRemoved = null
    this.onUnitSpawned = null
    this.onUnitMoved = null
    this.onUnitRemoved = null
    this._combatSystem = null
    this._enemyAISystem = null
    this._researchSystem = null
  }
}
