import { EventBus } from '../../core/events/EventBus.js'
import gsap from 'gsap'

export class KillFeed {
  constructor() {
    this.container = null
    this.events = []
    this.maxEvents = 5
    this.eventDuration = 4000
  }

  mount() {
    this.container = document.createElement('div')
    this.container.id = 'kill-feed'
    this.container.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: var(--hx-z-hud);
      display: flex;
      flex-direction: column;
      gap: 4px;
      pointer-events: none;
    `
    document.body.appendChild(this.container)

    EventBus.on('combatKill', (data) => this.addKill(data))
    EventBus.on('combatHit', (data) => this.addHit(data))
    EventBus.on('combatBounty', (data) => this.addBounty(data))
    EventBus.on('unitRankUp', (data) => this.addRankUp(data))
  }

  addHit(data) {
    const { damage, targetType, attackerType, remainingHp, lethal, targetHpBefore, targetMaxHp, critical } = data
    const entry = document.createElement('div')
    entry.className = 'kill-feed-entry hit'
    entry.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: rgba(15, 18, 24, 0.88);
      border: 1px solid ${critical ? 'rgba(251, 191, 36, 0.58)' : 'rgba(239, 68, 68, 0.28)'};
      border-radius: 6px;
      font-size: 11px;
      color: ${critical ? '#fde68a' : '#fca5a5'};
      font-family: system-ui;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
      opacity: 0;
      transform: translateX(24px);
    `
    const tail = lethal ? 'and falls' : `(${remainingHp}/${targetMaxHp || targetHpBefore || remainingHp} hp left)`
    const prefix = critical ? 'Critical' : this.capitalize(targetType)
    entry.innerHTML = `<span>${this.iconFor(attackerType)}</span><span>${prefix} takes ${damage} ${tail}</span>`
    this.container.appendChild(entry)
    this.events.push(entry)
    gsap.to(entry, { opacity: 1, x: 0, duration: 0.18, ease: 'power2.out' })
    setTimeout(() => {
      if (!entry.parentElement) return
      gsap.to(entry, { opacity: 0, x: 24, duration: 0.25, onComplete: () => entry.remove() })
      const idx = this.events.indexOf(entry)
      if (idx > -1) this.events.splice(idx, 1)
    }, critical ? 2200 : 1400)
  }

  addKill(data) {
    const { killerType, killedType } = data
    
    const entry = document.createElement('div')
    entry.className = 'kill-feed-entry'
    entry.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: rgba(15, 18, 24, 0.92);
      border: 1px solid rgba(239, 68, 68, 0.4);
      border-radius: 6px;
      font-size: 12px;
      color: #fff;
      font-family: system-ui;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
      opacity: 0;
      transform: translateX(50px);
    `
    
    entry.innerHTML = `
      <span style="font-size: 16px;">${this.iconFor(killerType)}</span>
      <span style="color: #4ade80;">${this.capitalize(killerType)}</span>
      <span style="color: rgba(255,255,255,0.5);">→</span>
      <span style="font-size: 16px;">${this.iconFor(killedType)}</span>
      <span style="color: #ef4444;">${this.capitalize(killedType)}</span>
    `
    
    this.container.appendChild(entry)
    this.events.push(entry)
    
    if (this.events.length > this.maxEvents) {
      const old = this.events.shift()
      gsap.to(old, {
        opacity: 0,
        x: 50,
        duration: 0.3,
        onComplete: () => old.remove()
      })
    }
    
    gsap.to(entry, {
      opacity: 1,
      x: 0,
      duration: 0.3,
      ease: 'power2.out'
    })
    
    setTimeout(() => {
      if (entry.parentElement) {
        gsap.to(entry, {
          opacity: 0,
          x: 30,
          duration: 0.4,
          delay: 0.5,
          onComplete: () => entry.remove()
        })
        const idx = this.events.indexOf(entry)
        if (idx > -1) this.events.splice(idx, 1)
      }
    }, this.eventDuration)
  }

  iconFor(type) {
    const icons = {
      scout: '⚔️',
      archer: '🏹',
      knight: '🛡️',
      outrider: '🐎',
      sentinel: '🧱',
      sageguard: '✨',
      goblin: '👺',
      goblin_raider: '🗡️',
      goblin_brute: '🪓',
      goblin_slinger: '🏹',
      goblin_warlord: '👑',
      tower: '🏰',
    }
    return icons[type] || '⚔️'
  }

  addBounty(data) {
    const { amount } = data
    
    const entry = document.createElement('div')
    entry.className = 'kill-feed-entry bounty'
    entry.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      background: rgba(15, 18, 24, 0.92);
      border: 1px solid rgba(250, 204, 21, 0.4);
      border-radius: 6px;
      font-size: 12px;
      color: #fbbf24;
      font-family: system-ui;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
      opacity: 0;
      transform: translateX(30px);
    `
    
    entry.innerHTML = `<span style="font-size: 14px;">🪙</span><span>+${amount} Gold</span>`
    
    this.container.appendChild(entry)
    this.events.push(entry)
    
    if (this.events.length > this.maxEvents) {
      const old = this.events.shift()
      gsap.to(old, {
        opacity: 0,
        x: 50,
        duration: 0.3,
        onComplete: () => old.remove()
      })
    }
    
    gsap.to(entry, {
      opacity: 1,
      x: 0,
      duration: 0.3,
      ease: 'power2.out'
    })
    
    setTimeout(() => {
      if (entry.parentElement) {
        gsap.to(entry, {
          opacity: 0,
          x: 30,
          duration: 0.4,
          delay: 0.5,
          onComplete: () => entry.remove()
        })
        const idx = this.events.indexOf(entry)
        if (idx > -1) this.events.splice(idx, 1)
      }
    }, 3000)
  }

  addRankUp(data) {
    const { unitType, rank } = data
    
    const entry = document.createElement('div')
    entry.className = 'kill-feed-entry rankup'
    entry.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      background: rgba(15, 18, 24, 0.92);
      border: 1px solid rgba(147, 197, 253, 0.5);
      border-radius: 6px;
      font-size: 12px;
      color: #93c5fd;
      font-family: system-ui;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
      opacity: 0;
      transform: translateX(30px);
    `
    
    entry.innerHTML = `<span>⭐</span><span>${this.capitalize(unitType)} Rank ${rank}!</span>`
    
    this.container.appendChild(entry)
    this.events.push(entry)
    
    gsap.to(entry, {
      opacity: 1,
      x: 0,
      duration: 0.3,
      ease: 'power2.out'
    })
    
    setTimeout(() => {
      if (entry.parentElement) {
        gsap.to(entry, {
          opacity: 0,
          x: 30,
          duration: 0.4,
          onComplete: () => entry.remove()
        })
        const idx = this.events.indexOf(entry)
        if (idx > -1) this.events.splice(idx, 1)
      }
    }, 3500)
  }

  capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''
  }

  dispose() {
    if (this.container?.parentElement) {
      this.container.parentElement.removeChild(this.container)
    }
  }
}
