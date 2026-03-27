import { saveManager } from '../../game/SaveManager.js'

const Analytics = {
  session: {
    startTime: Date.now(),
    turnsPlayed: 0,
    buildingsBuilt: 0,
    unitsTrained: 0,
    enemiesKilled: 0,
    techResearched: 0,
    goldEarned: 0,
    goldSpent: 0,
    eventsSeen: [],
    errors: []
  },

  track(event, data = {}) {
    const entry = {
      event,
      timestamp: Date.now(),
      sessionElapsed: Date.now() - this.session.startTime,
      turn: this.session.turnsPlayed,
      ...data
    }
    
    if (typeof window !== 'undefined' && window.CONSOLE?.analytics) {
      window.CONSOLE.analytics.push(entry)
    }

    this._persistEvent(entry)
  },

  _persistEvent(entry) {
    try {
      const key = `analytics_${this._getDateKey()}`
      const existing = JSON.parse(localStorage.getItem(key) || '[]')
      existing.push(entry)
      if (existing.length > 1000) existing.splice(0, existing.length - 1000)
      localStorage.setItem(key, JSON.stringify(existing))
    } catch (e) {
      console.warn('Analytics persist failed:', e)
    }
  },

  _getDateKey() {
    return new Date().toISOString().split('T')[0]
  },

  trackGameStart(seed) {
    this.track('game_start', { seed })
    this.session = {
      startTime: Date.now(),
      turnsPlayed: 0,
      buildingsBuilt: 0,
      unitsTrained: 0,
      enemiesKilled: 0,
      techResearched: 0,
      goldEarned: 0,
      goldSpent: 0,
      eventsSeen: [],
      errors: []
    }
  },

  trackTurnEnd(resources, enemyCount) {
    this.session.turnsPlayed++
    this.track('turn_end', {
      turn: this.session.turnsPlayed,
      gold: resources.gold,
      wood: resources.wood,
      food: resources.food,
      enemies: enemyCount
    })
  },

  trackBuildingPlaced(type, cost) {
    this.session.buildingsBuilt++
    this.track('building_placed', { type, cost })
    this.session.goldSpent += cost.gold || 0
  },

  trackUnitTrained(type, cost) {
    this.session.unitsTrained++
    this.track('unit_trained', { type, cost })
    this.session.goldSpent += cost.gold || 0
  },

  trackEnemyKilled(type, bounty) {
    this.session.enemiesKilled++
    this.track('enemy_killed', { type, bounty })
    this.session.goldEarned += bounty
  },

  trackTechResearched(techKey) {
    this.session.techResearched++
    this.track('tech_researched', { techKey })
  },

  trackEvent(eventId, choice) {
    if (!this.session.eventsSeen.includes(eventId)) {
      this.session.eventsSeen.push(eventId)
    }
    this.track('world_event', { eventId, choice })
  },

  trackWin(finalScore) {
    this.track('game_win', {
      ...this._getSessionSummary(),
      finalScore,
      duration: Date.now() - this.session.startTime
    })
    saveManager.data.total_wins++
    saveManager.save()
  },

  trackLoss(reason) {
    this.track('game_loss', {
      ...this._getSessionSummary(),
      reason,
      duration: Date.now() - this.session.startTime
    })
    saveManager.data.total_losses = (saveManager.data.total_losses || 0) + 1
    saveManager.save()
  },

  trackError(error, context = {}) {
    this.session.errors.push({ error: error.message, stack: error.stack, ...context })
    this.track('error', { message: error.message, ...context })
  },

  _getSessionSummary() {
    return {
      turnsPlayed: this.session.turnsPlayed,
      buildingsBuilt: this.session.buildingsBuilt,
      unitsTrained: this.session.unitsTrained,
      enemiesKilled: this.session.enemiesKilled,
      techResearched: this.session.techResearched,
      goldEarned: this.session.goldEarned,
      goldSpent: this.session.goldSpent,
      netGold: this.session.goldEarned - this.session.goldSpent,
      eventsSeen: this.session.eventsSeen.length
    }
  },

  getMetrics() {
    return {
      ...this._getSessionSummary(),
      winRate: this._calculateWinRate(),
      avgTurns: this._calculateAvgTurns(),
      topScore: saveManager.data.stats?.highest_gold || 0
    }
  },

  _calculateWinRate() {
    const wins = saveManager.data.wins || 0
    const losses = saveManager.data.total_losses || 0
    const total = wins + losses
    return total > 0 ? Math.round((wins / total) * 100) : 0
  },

  _calculateAvgTurns() {
    const key = `analytics_${this._getDateKey()}`
    const events = JSON.parse(localStorage.getItem(key) || '[]')
    const wins = events.filter(e => e.event === 'game_win')
    if (wins.length === 0) return 0
    const avg = wins.reduce((sum, w) => sum + (w.turnsPlayed || 0), 0) / wins.length
    return Math.round(avg)
  }
}

export { Analytics }
