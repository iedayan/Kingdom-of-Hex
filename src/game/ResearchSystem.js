export class ResearchSystem {
  constructor(session) {
    this.session = session
  }

  getResearchProgress() {
    if (!this.session.currentResearch) return null
    const tech = this.session.techTree[this.session.currentResearch]
    return {
      key: this.session.currentResearch,
      name: tech.name,
      cost: tech.cost,
      progress: tech.progress,
      percent: Math.round((tech.progress / tech.cost) * 100)
    }
  }

  canResearch(techKey) {
    const tech = this.session.techTree[techKey]
    if (!tech) return false
    if (this.session.researched.has(techKey)) return false
    if (tech.requires.some(req => !this.session.researched.has(req))) return false
    return true
  }

  startResearch(techKey) {
    if (!this.canResearch(techKey)) return false
    this.session.currentResearch = techKey
    return true
  }

  processResearch() {
    if (!this.session.currentResearch) return null

    const tech = this.session.techTree[this.session.currentResearch]
    const needed = tech.cost - tech.progress
    const allocated = Math.min(this.session.resources.science, needed)
    
    this.session.resources.science -= allocated
    tech.progress += allocated

    if (tech.progress >= tech.cost) {
      this.session.researched.add(this.session.currentResearch)
      const completedKey = this.session.currentResearch
      this.session.currentResearch = null
      return completedKey
    }

    return null
  }

  getUnlockedBuildings() {
    const unlocked = []
    for (const [key, tech] of Object.entries(this.session.techTree)) {
      if (this.session.researched.has(key)) {
        unlocked.push(...tech.unlocks)
      }
    }
    return [...new Set(unlocked)]
  }

  getAvailableTechs() {
    const available = []
    const inProgress = this.session.currentResearch
    const researched = this.session.researched

    for (const [key, tech] of Object.entries(this.session.techTree)) {
      if (researched.has(key)) continue
      const meetsRequirements = tech.requires.every(req => researched.has(req))
      available.push({
        key,
        name: tech.name,
        cost: tech.cost,
        progress: tech.progress,
        requires: tech.requires,
        meetsRequirements,
        isResearching: key === inProgress
      })
    }
    return available
  }
}
