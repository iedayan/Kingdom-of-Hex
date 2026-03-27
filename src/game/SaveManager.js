/**
 * Handles persistent storage using localStorage.
 * Tracks Legacy Points (LP) and permanent meta-upgrades.
 */
import { z } from 'zod'

const SAVE_VERSION = 2

const upgradesSchema = z.object({
  starting_scout: z.number().int().nonnegative(),
  science_focus: z.number().int().nonnegative(),
  fortified_walls: z.number().int().nonnegative(),
  faster_exploration: z.number().int().nonnegative(),
  economic_boost: z.number().int().nonnegative(),
  veteran_training: z.number().int().nonnegative(),
})

export const META_UPGRADES = {
  starting_scout: { name: 'Royal Scout', baseCost: 50, desc: 'Start with 1 Scout', maxLevel: 1 },
  science_focus: { name: 'Academy Grant', baseCost: 100, desc: '+1 Science/turn', maxLevel: 5 },
  fortified_walls: { name: 'Masonry Guild', baseCost: 150, desc: 'Units start with +2 HP', maxLevel: 3 },
  faster_exploration: { name: 'Pathfinders', baseCost: 75, desc: 'Scout +1 Movement', maxLevel: 2 },
  economic_boost: { name: 'Trade Routes', baseCost: 120, desc: '+10% all yields', maxLevel: 3 },
  veteran_training: { name: 'War Academy', baseCost: 200, desc: 'Units gain +25% XP', maxLevel: 2 },
}

const saveSchema = z.object({
  version: z.number().int().positive().optional(),
  lp: z.number().int().nonnegative(),
  runs: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  upgrades: upgradesSchema,
  stats: z.object({
    total_gold: z.number().nonnegative(),
    total_kills: z.number().int().nonnegative(),
    total_waves_survived: z.number().int().nonnegative(),
    fastest_win: z.number().int().nullable().optional(),
  }),
  session: z.any().nullable().optional(),
  milestones: z.record(z.boolean()).optional(),
})

export const META_MILESTONES = {
  first_run: { name: 'First Chronicle', lp: 20, check: (d) => d.runs >= 1 },
  hardened_realm: { name: 'Hardened Realm', lp: 40, check: (d) => d.runs >= 5 },
  first_victory: { name: 'First Crown', lp: 120, check: (d) => d.wins >= 1 },
  veteran_crown: { name: 'Veteran Crown', lp: 180, check: (d) => d.wins >= 3 },
}

function defaultSave() {
  return {
    version: SAVE_VERSION,
    lp: 0,
    runs: 0,
    wins: 0,
    upgrades: {
      starting_scout: 0,
      science_focus: 0,
      fortified_walls: 0,
      faster_exploration: 0,
      economic_boost: 0,
      veteran_training: 0,
    },
    stats: {
      total_gold: 0,
      total_kills: 0,
      total_waves_survived: 0,
      fastest_win: null,
    },
    session: null,
    milestones: {},
  }
}

export class SaveManager {
  constructor() {
    this.key = 'hexgame_save_v1'
    this.data = this.load()
  }

  load() {
    const raw = localStorage.getItem(this.key)
    if (!raw) return defaultSave()
    try {
      const parsed = JSON.parse(raw)
      const parsedVersion = Number(parsed?.version || 1)
      if (!Number.isFinite(parsedVersion) || parsedVersion > SAVE_VERSION) {
        console.warn('[SAVE] Unsupported save version, starting fresh.')
        return defaultSave()
      }
      const base = defaultSave()
      const merged = {
        ...base,
        ...parsed,
        version: SAVE_VERSION,
        upgrades: { ...base.upgrades, ...parsed.upgrades },
        stats: { ...base.stats, ...parsed.stats },
        milestones: { ...base.milestones, ...parsed.milestones },
      }
      // Guardrail: drop obviously invalid/legacy session payloads.
      if (!merged.session || typeof merged.session !== 'object' || !('turn' in merged.session)) {
        merged.session = null
      }
      return saveSchema.parse(merged)
    } catch (e) {
      console.error('Failed to parse save data', e)
    }
    return defaultSave()
  }

  save() {
    this.data.version = SAVE_VERSION
    localStorage.setItem(this.key, JSON.stringify(this.data))
  }

  saveSession(sessionData) {
    this.data.session = sessionData
    this.save()
  }

  clearSession() {
    this.data.session = null
    this.save()
  }

  addLP(amount) {
    this.data.lp += Math.floor(amount)
    this.save()
  }

  getUpgradeBonus(id) {
    const level = this.data.upgrades[id] || 0
    switch (id) {
      case 'science_focus': return level * 1
      case 'fortified_walls': return level * 2
      case 'starting_scout': return level > 0 ? 1 : 0
      case 'faster_exploration': return level * 1
      case 'economic_boost': return level * 0.1
      case 'veteran_training': return level * 0.25
      default: return 0
    }
  }

  getEconomicMultiplier() {
    return 1 + this.getUpgradeBonus('economic_boost')
  }

  getXPBonus() {
    return 1 + this.getUpgradeBonus('veteran_training')
  }

  getScoutMovement() {
    return 3 + this.getUpgradeBonus('faster_exploration')
  }

  getUpgradeCost(id) {
    const meta = META_UPGRADES[id]
    if (!meta) return Infinity
    const level = this.data.upgrades[id] || 0
    if (level >= meta.maxLevel) return Infinity
    return Math.floor(meta.baseCost * Math.pow(1.5, level))
  }

  getUpgradeLevel(id) {
    return this.data.upgrades[id] || 0
  }

  buyUpgrade(id, cost) {
    if (this.data.lp >= cost) {
      this.data.lp -= cost
      this.data.upgrades[id] = (this.data.upgrades[id] || 0) + 1
      this.save()
      return true
    }
    return false
  }

  loadSession() {
    return this.data.session
  }

  hasSession() {
    return this.data.session !== null
  }

  getStats() {
    return {
      lp: this.data.lp,
      runs: this.data.runs,
      wins: this.data.wins,
      winRate: this.data.runs > 0 ? Math.round((this.data.wins / this.data.runs) * 100) : 0
    }
  }

  evaluateMilestones() {
    let gained = 0
    const unlocked = []
    for (const [id, m] of Object.entries(META_MILESTONES)) {
      if (this.data.milestones[id]) continue
      if (m.check(this.data)) {
        this.data.milestones[id] = true
        this.data.lp += m.lp
        gained += m.lp
        unlocked.push(m.name)
      }
    }
    if (gained > 0) this.save()
    return { gained, unlocked }
  }
}

export const saveManager = new SaveManager()
