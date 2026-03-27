import { hashSeed, createRng } from '../SeededRandom.js'
import { TILE_LIST } from '../hexmap/HexTileData.js'
import { cubeKey, parseCubeKey } from '../hexmap/HexWFCCore.js'

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function cloneEffect(effect) {
  return effect ? {
    ...effect,
    weightBiases: effect.weightBiases ? { ...effect.weightBiases } : null,
    prestigeBonuses: effect.prestigeBonuses ? { ...effect.prestigeBonuses } : null,
  } : null
}

export function getTileTags(tile) {
  const name = TILE_LIST[tile?.type]?.name ?? ''
  const tags = new Set()

  if (name === 'WATER') tags.add('water')
  if (name.startsWith('ROAD') || name.includes('CROSSING')) tags.add('road')
  if (name.startsWith('RIVER') || name === 'RIVER_INTO_COAST' || name.includes('CROSSING')) tags.add('river')
  if (name.startsWith('COAST') || name === 'RIVER_INTO_COAST') tags.add('coast')
  if (name.startsWith('GRASS')) tags.add('grass')
  if (name.includes('SLOPE')) tags.add('slope')
  if (name.includes('CLIFF')) tags.add('cliff')
  if (name.includes('CROSSING')) tags.add('crossing')
  if (name.includes('SLOPE_HIGH') || name.includes('CLIFF') || (tile?.level ?? 0) >= 3) tags.add('highland')

  return tags
}

export function buildWeightBiases(tagMultipliers = {}, tileMultipliers = {}) {
  const biases = {}

  for (let type = 0; type < TILE_LIST.length; type++) {
    const tile = { type, level: 0 }
    const name = TILE_LIST[type]?.name ?? ''
    let multiplier = tileMultipliers[name] ?? 1

    for (const tag of getTileTags(tile)) {
      multiplier *= tagMultipliers[tag] ?? 1
    }

    if (multiplier !== 1) {
      biases[type] = multiplier
    }
  }

  return biases
}

export function mergeWeightBiases(...maps) {
  const merged = {}

  for (const map of maps) {
    if (!map) continue
    for (const [key, value] of Object.entries(map)) {
      merged[key] = (merged[key] ?? 1) * value
    }
  }

  return Object.keys(merged).length > 0 ? merged : null
}

function createObjective({
  id,
  label,
  description,
  minGrids,
  metricDefs,
}) {
  return {
    id,
    label,
    description,
    minGrids,
    evaluate(summary, prestige) {
      const metrics = metricDefs.map((metric) => {
        const target = metric.target(summary)
        const current = metric.current(summary, prestige)
        return {
          label: metric.label,
          current,
          target,
          done: current >= target,
        }
      })

      const completed = summary.builtGrids >= minGrids && metrics.every(metric => metric.done)

      return {
        label,
        description,
        minGrids,
        metrics,
        completed,
      }
    },
  }
}

export const WORLD_EVENTS = [
  {
    id: 'road-charter',
    label: 'Road Charter',
    message: 'Royal surveyors open a fast overland lane.',
    effect: {
      label: 'Road Charter',
      remainingTurns: 3,
      weightBiases: buildWeightBiases({ road: 1.55, crossing: 1.15 }),
      prestigeBonuses: { roads: 0.025, bridges: 1 },
    },
  },
  {
    id: 'spring-thaw',
    label: 'Spring Thaw',
    message: 'Meltwater cuts new river paths through the island.',
    effect: {
      label: 'Spring Thaw',
      remainingTurns: 2,
      weightBiases: buildWeightBiases({ river: 1.45, coast: 1.15, water: 1.1 }),
      prestigeBonuses: { rivers: 0.03, coast: 0.01 },
    },
  },
  {
    id: 'stone-muster',
    label: 'Stone Muster',
    message: 'Masons claim the ridgelines and raise hard edges.',
    effect: {
      label: 'Stone Muster',
      remainingTurns: 3,
      weightBiases: buildWeightBiases({ highland: 1.35, cliff: 1.3, slope: 1.15 }),
      prestigeBonuses: { highland: 0.02, mountains: 2 },
    },
  },
  {
    id: 'harvest-fair',
    label: 'Harvest Fair',
    message: 'Village markets pack the lowlands with fresh trade.',
    effect: {
      label: 'Harvest Fair',
      remainingTurns: 3,
      weightBiases: buildWeightBiases({ grass: 1.2, road: 1.15 }),
      prestigeBonuses: { buildings: 1.5, windmills: 2 },
    },
  },
]

export const KINGDOM_IDENTITIES = [
  {
    id: 'harbor-league',
    label: 'Harbor League',
    tagline: 'Trade winds, bridges, and river mouths.',
    intro: 'Lean into coastlines and river crossings before the tides turn hostile.',
    weightBiases: buildWeightBiases({ coast: 1.35, river: 1.2, water: 1.08, highland: 0.92 }),
    scoring: { coast: 0.06, roads: 0.018, rivers: 0.05, highland: 0.01, mountains: 1, buildings: 2.2, windmills: 3.5, bridges: 2.5 },
    objective: createObjective({
      id: 'harbor-dominion',
      label: 'Harbor Dominion',
      description: 'Secure a coast-heavy kingdom with enough prestige to dominate the sea lanes.',
      minGrids: 6,
      metricDefs: [
        { label: 'Prestige', current: (_summary, prestige) => prestige, target: summary => Math.max(48, summary.builtGrids * 9) },
        { label: 'Coast Tiles', current: summary => summary.coast, target: summary => Math.max(20, summary.builtGrids * 18) },
        { label: 'Bridges', current: summary => summary.bridges, target: summary => Math.max(1, Math.ceil(summary.builtGrids / 5)) },
      ],
    }),
    eventBias: ['spring-thaw', 'road-charter', 'harvest-fair'],
    threatReliefOnRebuild: 1,
  },
  {
    id: 'highland-clans',
    label: 'Highland Clans',
    tagline: 'Ridges, keeps, and mountain watchfires.',
    intro: 'Push into high ground and turn cliffs into a defensive crown.',
    weightBiases: buildWeightBiases({ highland: 1.35, cliff: 1.25, slope: 1.1, coast: 0.88 }),
    scoring: { coast: 0.01, roads: 0.015, rivers: 0.02, highland: 0.05, mountains: 3.5, buildings: 2.1, windmills: 2, bridges: 1.5 },
    objective: createObjective({
      id: 'summit-throne',
      label: 'Summit Throne',
      description: 'Raise a mountain kingdom with enough highland mass to claim the peaks.',
      minGrids: 6,
      metricDefs: [
        { label: 'Prestige', current: (_summary, prestige) => prestige, target: summary => Math.max(48, summary.builtGrids * 9) },
        { label: 'Highland Tiles', current: summary => summary.highland, target: summary => Math.max(35, summary.builtGrids * 30) },
        { label: 'Mountains', current: summary => summary.mountains, target: summary => Math.max(2, Math.ceil(summary.builtGrids / 3)) },
      ],
    }),
    eventBias: ['stone-muster', 'harvest-fair', 'road-charter'],
    threatReliefOnRebuild: 0.5,
  },
  {
    id: 'crown-road',
    label: 'Crown Road',
    tagline: 'Caravans, towers, and disciplined frontier roads.',
    intro: 'Expand hard, keep the lanes open, and turn every grid into a connected frontier.',
    weightBiases: buildWeightBiases({ road: 1.5, crossing: 1.2, river: 1.06, water: 0.96 }),
    scoring: { coast: 0.015, roads: 0.05, rivers: 0.02, highland: 0.015, mountains: 1, buildings: 2.7, windmills: 2.5, bridges: 2.6 },
    objective: createObjective({
      id: 'great-road',
      label: 'Great Road',
      description: 'Reach a road-dense, settlement-heavy kingdom before the frontier breaks.',
      minGrids: 6,
      metricDefs: [
        { label: 'Prestige', current: (_summary, prestige) => prestige, target: summary => Math.max(48, summary.builtGrids * 9) },
        { label: 'Road Tiles', current: summary => summary.roads, target: summary => Math.max(22, summary.builtGrids * 11) },
        { label: 'Settlements', current: summary => summary.buildings + summary.windmills, target: summary => Math.max(3, Math.ceil(summary.builtGrids / 2)) },
      ],
    }),
    eventBias: ['road-charter', 'harvest-fair', 'stone-muster'],
    threatReliefOnRebuild: 1,
  },
]

export const THREAT_PROFILES = [
  {
    id: 'ash-raiders',
    label: 'Ash Raiders',
    description: 'Road-hungry raiders that burn lanes and flatten busy lowlands.',
    cadence: 4,
    firstStrikeTurn: 4,
    threatGain: 2,
    targetTags: ['road', 'grass', 'crossing'],
    weightBiases: buildWeightBiases({ road: 0.45, grass: 1.18, river: 1.08 }),
    incursionLabel: 'Ash Raiders torch the frontier roads.',
  },
  {
    id: 'black-sails',
    label: 'Black Sails',
    description: 'Tide riders that turn coastlines into broken inlets.',
    cadence: 3,
    firstStrikeTurn: 3,
    threatGain: 3,
    targetTags: ['coast', 'river', 'water'],
    weightBiases: buildWeightBiases({ coast: 1.45, water: 1.28, road: 0.82 }),
    incursionLabel: 'Black Sails hit the coast under moonlight.',
  },
  {
    id: 'peak-hunters',
    label: 'Peak Hunters',
    description: 'Mountain raiders that break passes and push the island upward.',
    cadence: 3,
    firstStrikeTurn: 5,
    threatGain: 2,
    targetTags: ['highland', 'cliff', 'slope'],
    weightBiases: buildWeightBiases({ highland: 1.32, cliff: 1.4, slope: 1.2, road: 0.9 }),
    incursionLabel: 'Peak Hunters trigger an avalanche raid.',
  },
]

function defaultRealmIdForSeed(seed) {
  const index = hashSeed('realm', seed) % KINGDOM_IDENTITIES.length
  return KINGDOM_IDENTITIES[index].id
}

function defaultThreatIdForSeed(seed) {
  const index = hashSeed('threat', seed) % THREAT_PROFILES.length
  return THREAT_PROFILES[index].id
}

function findById(list, id, fallbackId) {
  return list.find(item => item.id === id) ?? list.find(item => item.id === fallbackId) ?? list[0]
}

function getSummaryCells(globalCells) {
  if (!globalCells) return []
  if (globalCells instanceof Map) return [...globalCells.values()]
  return Array.isArray(globalCells) ? globalCells : []
}

function countUniqueTiles(items, predicate = () => true) {
  const seen = new Set()

  for (const item of items ?? []) {
    const tileId = item?.tile?.id
    if (tileId == null) continue
    if (!predicate(item)) continue
    seen.add(tileId)
  }

  return seen.size
}

export function summarizeWorldState({ globalCells, grids } = {}) {
  const summary = {
    tiles: 0,
    builtGrids: 0,
    roads: 0,
    rivers: 0,
    coast: 0,
    water: 0,
    grass: 0,
    highland: 0,
    cliffs: 0,
    crossings: 0,
    buildings: 0,
    windmills: 0,
    bridges: 0,
    mountains: 0,
    trees: 0,
  }

  for (const cell of getSummaryCells(globalCells)) {
    summary.tiles++
    const tags = getTileTags(cell)
    if (tags.has('road')) summary.roads++
    if (tags.has('river')) summary.rivers++
    if (tags.has('coast')) summary.coast++
    if (tags.has('water')) summary.water++
    if (tags.has('grass')) summary.grass++
    if (tags.has('highland')) summary.highland++
    if (tags.has('cliff')) summary.cliffs++
    if (tags.has('crossing')) summary.crossings++
  }

  const gridList = grids instanceof Map ? [...grids.values()] : Array.isArray(grids) ? grids : []
  summary.builtGrids = gridList.filter(grid => grid?.state === 'populated' || (grid?.hexTiles?.length ?? 0) > 0).length

  for (const grid of gridList) {
    const decorations = grid?.decorations
    if (!decorations) continue

    summary.buildings += countUniqueTiles(
      decorations.buildings,
      item => !item.meshName?.includes('windmill') && !item.meshName?.includes('_top') && !item.meshName?.includes('_fan')
    )
    summary.windmills += countUniqueTiles(
      decorations.buildings,
      item => item.meshName?.includes('windmill') && !item.meshName?.includes('_top') && !item.meshName?.includes('_fan')
    )
    summary.bridges += countUniqueTiles(decorations.bridges)
    summary.mountains += countUniqueTiles(decorations.mountains)
    summary.trees += countUniqueTiles(decorations.trees)
  }

  return summary
}

function objectiveProgressText(progress) {
  return progress.metrics
    .map(metric => `${metric.label} ${metric.current}/${metric.target}`)
    .join(' | ')
}

export function parseKingdomConfig(search = '') {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const seedValue = Number.parseInt(params.get('seed') ?? '', 10)
  const seed = Number.isFinite(seedValue) ? seedValue : null

  const realmId = params.get('realm') || null
  const threatId = params.get('threat') || null

  return {
    seed,
    realmId,
    threatId,
  }
}

function pickWeighted(candidates, rng) {
  if (candidates.length === 0) return null

  const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0)
  let cursor = rng() * totalWeight
  for (const candidate of candidates) {
    cursor -= candidate.weight
    if (cursor <= 0) return candidate
  }

  return candidates[candidates.length - 1]
}

export class KingdomDirector {
  constructor({ seed = 1, realmId = null, threatId = null } = {}) {
    this.reset({ seed, realmId, threatId })
  }

  reset({ seed = 1, realmId = null, threatId = null } = {}) {
    this.seed = seed
    this.realm = findById(KINGDOM_IDENTITIES, realmId, defaultRealmIdForSeed(seed))
    this.threat = findById(THREAT_PROFILES, threatId, defaultThreatIdForSeed(seed))
    this.turn = 0
    this.threatMeter = 0
    this.prestige = 0
    this.status = 'active'
    this.summary = summarizeWorldState()
    this.messages = [this.realm.intro]
    this.lastEventId = null
    this.activeEffects = []
    this.lastIncursion = null
    this.lastObjective = this.realm.objective.evaluate(this.summary, this.prestige)
  }

  syncWorld(summary = summarizeWorldState()) {
    this.summary = summary
    this.prestige = this._calculatePrestige(summary)
    this.lastObjective = this.realm.objective.evaluate(summary, this.prestige)
    return this.getSnapshot()
  }

  _addMessage(message) {
    if (!message) return
    this.messages = [message, ...this.messages.filter(item => item !== message)].slice(0, 5)
  }

  rememberMessage(message) {
    this._addMessage(message)
  }

  _calculatePrestige(summary) {
    const scoring = this.realm.scoring
    let prestige = summary.builtGrids * 6
    prestige += summary.roads * scoring.roads
    prestige += summary.coast * scoring.coast
    prestige += summary.rivers * scoring.rivers
    prestige += summary.highland * scoring.highland
    prestige += summary.mountains * scoring.mountains
    prestige += summary.buildings * scoring.buildings
    prestige += summary.windmills * scoring.windmills
    prestige += summary.bridges * scoring.bridges

    for (const effect of this.activeEffects) {
      const bonuses = effect.prestigeBonuses ?? {}
      prestige += (bonuses.roads ?? 0) * summary.roads
      prestige += (bonuses.coast ?? 0) * summary.coast
      prestige += (bonuses.rivers ?? 0) * summary.rivers
      prestige += (bonuses.highland ?? 0) * summary.highland
      prestige += (bonuses.mountains ?? 0) * summary.mountains
      prestige += (bonuses.buildings ?? 0) * summary.buildings
      prestige += (bonuses.windmills ?? 0) * summary.windmills
      prestige += (bonuses.bridges ?? 0) * summary.bridges
    }

    return Math.round(prestige)
  }

  _tickEffects() {
    const expired = []

    this.activeEffects = this.activeEffects
      .map((effect) => {
        const nextTurns = effect.remainingTurns - 1
        if (nextTurns <= 0) {
          expired.push(effect.label)
          return null
        }
        return { ...effect, remainingTurns: nextTurns }
      })
      .filter(Boolean)

    return expired
  }

  _selectEvent() {
    const preferred = new Set(this.realm.eventBias)
    const ordered = [
      ...WORLD_EVENTS.filter(event => preferred.has(event.id)),
      ...WORLD_EVENTS.filter(event => !preferred.has(event.id)),
    ].filter(event => event.id !== this.lastEventId)

    if (ordered.length === 0) return null

    const rng = createRng(hashSeed(this.seed, 'event', this.turn))
    return ordered[Math.floor(rng() * ordered.length)]
  }

  _buildIncursion(cells) {
    if (!Array.isArray(cells) || cells.length === 0) return null

    const sorted = [...cells].sort((a, b) => cubeKey(a.q, a.r, a.s).localeCompare(cubeKey(b.q, b.r, b.s)))
    const weighted = sorted
      .map((cell) => {
        const tags = getTileTags(cell)
        const tagMatches = this.threat.targetTags.reduce((count, tag) => count + (tags.has(tag) ? 1 : 0), 0)
        const weight = 1 + tagMatches * 4 + ((cell.level ?? 0) >= 3 ? 1 : 0)
        return { cell, weight }
      })
      .filter(candidate => candidate.weight > 1)

    const source = weighted.length > 0 ? weighted : sorted.map(cell => ({ cell, weight: 1 }))
    const rng = createRng(hashSeed(this.seed, 'incursion', this.turn, this.threat.id))
    const selected = pickWeighted(source, rng)
    if (!selected) return null

    return {
      label: this.threat.incursionLabel,
      message: `${this.threat.label} strike at ${cubeKey(selected.cell.q, selected.cell.r, selected.cell.s)}.`,
      targetKey: cubeKey(selected.cell.q, selected.cell.r, selected.cell.s),
      weightBiases: this.threat.weightBiases,
      threatGain: this.threat.threatGain,
    }
  }

  getSolveOptions(context = {}) {
    const maps = [this.realm.weightBiases]

    for (const effect of this.activeEffects) {
      maps.push(effect.weightBiases)
    }

    if (context.weightBiases) {
      maps.push(context.weightBiases)
    }

    return {
      weightBiases: mergeWeightBiases(...maps),
    }
  }

  applyAction({ actionType, summary, cells = [] }) {
    if (this.status !== 'active') {
      return { state: this.getSnapshot(), messages: [], incursion: null, event: null }
    }

    this.turn += 1
    const expired = this._tickEffects()
    this.summary = summary

    if (actionType === 'rebuild') {
      this.threatMeter = clamp(this.threatMeter - (this.realm.threatReliefOnRebuild ?? 0), 0, 12)
    }

    this.prestige = this._calculatePrestige(summary)
    this.lastObjective = this.realm.objective.evaluate(summary, this.prestige)

    const messages = []
    for (const label of expired) {
      messages.push(`${label} fades from the realm.`)
    }

    let event = null
    if (this.turn % 3 === 0) {
      event = this._selectEvent()
      if (event) {
        this.lastEventId = event.id
        this.activeEffects.push(cloneEffect(event.effect))
        messages.push(event.message)
      }
    }

    let incursion = null
    if (this.turn >= this.threat.firstStrikeTurn && (this.turn - this.threat.firstStrikeTurn) % this.threat.cadence === 0) {
      incursion = this._buildIncursion(cells)
      if (incursion) {
        this.threatMeter = clamp(this.threatMeter + incursion.threatGain, 0, 12)
        this.lastIncursion = incursion
        messages.push(incursion.message)
      }
    }

    if (this.lastObjective.completed) {
      this.status = 'won'
      messages.push(`${this.lastObjective.label} secured.`)
    } else if (this.threatMeter >= 12) {
      this.status = 'lost'
      messages.push(`${this.threat.label} overrun the kingdom.`)
    }

    for (const message of messages) {
      this._addMessage(message)
    }

    return {
      state: this.getSnapshot(),
      messages,
      incursion,
      event,
    }
  }

  getSnapshot() {
    return {
      seed: this.seed,
      turn: this.turn,
      status: this.status,
      realm: this.realm,
      threat: this.threat,
      prestige: this.prestige,
      threatMeter: this.threatMeter,
      summary: this.summary,
      objective: this.lastObjective,
      objectiveText: objectiveProgressText(this.lastObjective),
      activeEffects: this.activeEffects.map(effect => ({
        label: effect.label,
        remainingTurns: effect.remainingTurns,
      })),
      messages: [...this.messages],
      lastIncursion: this.lastIncursion,
    }
  }
}

export function describeIncursionTarget(targetKey) {
  const { q, r, s } = parseCubeKey(targetKey)
  return `${q},${r},${s}`
}
