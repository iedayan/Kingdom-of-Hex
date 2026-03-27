import { log } from '../../core/logging/gameConsole.js'
import { Sounds } from '../../core/audio/Sounds.js'
import { refreshLucideIcons } from '../../core/ui/icons.js'
import { MAX_TURNS, capitalMissionLines, CAPITAL_SEAT_NAME } from '../../game/goals.js'
import { BUILDINGS, UNITS, formatCost } from '../../game/GameData.js'
import gsap from 'gsap'

/**
 * In-game HUD: top strip, action bar, research modal, end overlay.
 * Expects `app.game` and `app.unitManager` to exist before `mount()`.
 */
export class GameHud {
  constructor(app) {
    this.app = app
    this.selectedBuilding = null
    this.selectedUnitType = null
  }

  shakeButton(btn) {
    if (!btn) return
    gsap.killTweensOf(btn)
    gsap.fromTo(btn, 
      { x: 0 },
      { 
        x: [-6, 6, -4, 4, -2, 2, 0], 
        duration: 0.4, 
        ease: 'none',
        onStart: () => {
          btn.style.boxShadow = '0 0 12px rgba(255, 80, 80, 0.8)'
        },
        onComplete: () => {
          btn.style.boxShadow = ''
        }
      }
    )
  }

  async _copyText(text) {
    if (typeof navigator === 'undefined') return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return true
      }
    } catch (e) {
      // fall back below
    }
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }

  mount() {
    const app = this.app
    if (!app.game) return

    // Top HUD Container
    app.hudTop = document.createElement('div')
    app.hudTop.style.cssText = `
      position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      z-index: var(--hx-z-hud); pointer-events: none;
    `

    // Resource Strip
    app.topStrip = document.createElement('div')
    app.topStrip.className = 'hx-panel hx-panel--glass hx-corner-ticks hx-hud-glass-panel'
    app.topStrip.style.cssText = `
      display: flex; align-items: center; padding: 0 var(--hx-space-4);
      gap: var(--hx-space-4); height: var(--hx-strip-height); pointer-events: auto;
    `

    const createResourceChip = (iconName, label, title) => {
      const chip = document.createElement('div')
      chip.className = 'hx-chip hx-chip--resource hx-corner-ticks'
      chip.title = title
      const row = document.createElement('div')
      row.style.cssText = 'display:inline-flex;align-items:center;gap:var(--hx-space-2);'
      const ic = document.createElement('i')
      ic.setAttribute('data-lucide', iconName)
      const ab = document.createElement('span')
      ab.className = 'hx-font-ui hx-chip__abbr'
      ab.textContent = label
      const val = document.createElement('span')
      val.className = 'hx-chip__value'
      row.appendChild(ic)
      row.appendChild(ab)
      chip.appendChild(row)
      chip.appendChild(val)
      return { chip, val }
    }

    app.resGold = createResourceChip('coins', 'Gold', 'Gold')
    app.resWood = createResourceChip('tree-pine', 'Wood', 'Wood')
    app.resFood = createResourceChip('wheat', 'Food', 'Food')
    app.resStone = createResourceChip('mountain', 'Stone', 'Stone')
    app.resScience = createResourceChip('flask-conical', 'Science', 'Science')

    const d = () => { const el = document.createElement('div'); el.style.cssText = 'width:1px; height:24px; background:var(--hx-divider);'; return el; }
    [app.resGold, app.resWood, app.resFood, app.resStone, app.resScience].forEach(r => app.topStrip.appendChild(r.chip))
    
    app.turnCounter = document.createElement('div')
    app.turnCounter.className = 'hx-font-ui hx-tabular hx-hud-turn-counter'
    app.topStrip.appendChild(d())
    app.topStrip.appendChild(app.turnCounter)

    // Seed chip (copyable) for sharing runs/debug.
    app.seedChip = document.createElement('div')
    app.seedChip.className = 'hx-font-ui hx-hud-seed'
    app.seedChip.title = 'Click to copy run seed'
    app.seedChip.style.cursor = 'copy'
    app.seedChip.textContent = `SEED ${app.seed ?? app.game?.seed ?? ''}`
    app.seedChip.onclick = async (e) => {
      e?.stopPropagation?.()
      const seedStr = String(app.seed ?? app.game?.seed ?? '')
      if (!seedStr) return
      await this._copyText(seedStr)
      Sounds.play('pop', 0.9, 0.2, 0.7)
    }
    app.topStrip.appendChild(app.seedChip)

    app.hudTop.appendChild(app.topStrip)

    const m = capitalMissionLines()
    app.missionCaption = document.createElement('div')
    app.missionCaption.className = 'hx-hud-mission-caption'
    app.missionCaption.title = m.tooltip
    app.missionCaption.innerHTML = `
      <span class="hx-hud-mission-caption__seat">${m.title}</span>
      <span class="hx-hud-mission-caption__sep" aria-hidden="true">·</span>
      <span class="hx-hud-mission-caption__coords" translate="no">${m.coords}</span>
      <span class="hx-hud-mission-caption__sep" aria-hidden="true">·</span>
      <span class="hx-hud-mission-caption__hint">${m.hint}</span>`
    app.hudTop.appendChild(app.missionCaption)

    app.objectiveCaption = document.createElement('div')
    app.objectiveCaption.className = 'hx-font-ui'
    app.objectiveCaption.style.cssText = 'font-size: var(--hx-text-xs); color: var(--hx-text-muted); text-align:center;'
    app.hudTop.appendChild(app.objectiveCaption)

    app.waveCaption = document.createElement('div')
    app.waveCaption.className = 'hx-font-ui'
    app.waveCaption.style.cssText = 'font-size: var(--hx-text-xs); color: rgba(255, 181, 112, 0.88); text-align:center;'
    app.hudTop.appendChild(app.waveCaption)

    app.turnReport = document.createElement('div')
    app.turnReport.className = 'hx-turn-report'
    app.turnReport.style.display = 'none'
    app.hudTop.appendChild(app.turnReport)

    app.victoryProgress = document.createElement('div')
    app.victoryProgress.style.cssText = `
      width: 100%;
      height: 4px;
      background: rgba(255,255,255,0.1);
      border-radius: 2px;
      overflow: hidden;
      margin-top: 4px;
    `
    const progressBar = document.createElement('div')
    progressBar.className = 'hx-victory-bar'
    progressBar.style.cssText = `
      height: 100%;
      background: linear-gradient(90deg, var(--hx-accent-gold), #ffd700);
      width: 0%;
      transition: width 0.5s ease-out;
      border-radius: 2px;
    `
    app.victoryProgress.appendChild(progressBar)
    app.hudTop.appendChild(app.victoryProgress)

    document.body.appendChild(app.hudTop)

    // Bottom Action Bar
    app.actionBar = document.createElement('div')
    app.actionBar.className = 'hx-panel hx-panel--glass hx-corner-ticks hx-hud-glass-panel hx-action-bar'
    app.actionBar.style.cssText = `
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      z-index: var(--hx-z-hud);
      width: min(1040px, calc(100vw - var(--hx-space-6)));
      padding: var(--hx-space-2) var(--hx-space-3);
      min-height: var(--hx-toolbar-height);
      height: auto;
      display: flex;
      flex-direction: row;
      align-items: stretch;
      justify-content: flex-start;
      gap: var(--hx-space-3);
      flex-wrap: nowrap;
      overflow: visible;
    `

    const createGroup = (label, color) => {
      const g = document.createElement('div'); g.style.cssText = 'display:flex; gap:var(--hx-space-2); align-items:center;';
      const l = document.createElement('div'); l.textContent = label; l.style.cssText = `font-size:9px; font-weight:800; color:${color}; writing-mode:vertical-lr; transform:rotate(180deg); opacity:0.6;`;
      g.appendChild(l); return g;
    }

    const ecoGroup = createGroup('ECONOMY', 'var(--hx-accent-gold)')
    const milGroup = createGroup('MILITARY', 'var(--hx-danger)')

    app.buildingsList = Object.values(BUILDINGS)
    app.unitsList = Object.values(UNITS).filter(u => u.id !== 'goblin')

    app.buildButtons = {}; app.unitButtons = {};
    app.buildingsList.forEach(b => {
      const btn = document.createElement('button'); btn.className = 'hx-btn'; btn.title = b.desc;
      btn.innerHTML = `<i data-lucide="${b.icon}" style="width:16px;height:16px;margin-bottom:4px"></i><br><b>${b.name}</b><br><span style="font-size:9px;opacity:0.6">${formatCost(b.cost)}</span>`;
      btn.onclick = () => this.selectAction('building', b.id); app.buildButtons[b.id] = btn; ecoGroup.appendChild(btn);
    })
    app.unitsList.forEach(u => {
      const btn = document.createElement('button'); btn.className = 'hx-btn'; btn.title = u.desc;
      btn.innerHTML = `<i data-lucide="${u.icon}" style="width:16px;height:16px;margin-bottom:4px"></i><br><b>${u.name}</b><br><span style="font-size:9px;opacity:0.6">${formatCost(u.cost)}</span>`;
      btn.onclick = () => this.selectAction('unit', u.id); app.unitButtons[u.id] = btn; milGroup.appendChild(btn);
    })

    const techBtn = document.createElement('button'); techBtn.className = 'hx-btn'; techBtn.innerHTML = '<i data-lucide="flask-conical" style="width:16px;height:16px;margin-bottom:4px;color:#00ffff"></i><br><b>TECH</b><br><span style="font-size:9px;opacity:0.6" aria-hidden="true">&nbsp;</span>'; techBtn.onclick = () => app.toggleResearchModal();
    app.nextTurnBtn = document.createElement('button'); app.nextTurnBtn.className = 'hx-btn hx-btn--primary'; app.nextTurnBtn.innerHTML = 'END TURN ➔'; app.nextTurnBtn.onclick = () => app.game?.nextTurn();

    // Single flex row: scrollable economy + military | divider | TECH | END TURN (no wrapping).
    const selectorsRow = document.createElement('div')
    selectorsRow.className = 'hx-action-bar__selectors'
    selectorsRow.style.cssText = `
      display: flex; align-items: center;
      gap: var(--hx-space-3);
      flex-wrap: nowrap;
      flex: 1 1 0%;
      min-width: 0;
      overflow-x: auto;
      overflow-y: hidden;
      scrollbar-width: none;
    `
    selectorsRow.appendChild(ecoGroup)
    selectorsRow.appendChild(d())
    selectorsRow.appendChild(milGroup)

    const actionTail = document.createElement('div')
    actionTail.className = 'hx-action-bar__tail'
    actionTail.appendChild(techBtn)
    actionTail.appendChild(app.nextTurnBtn)

    const actionRailDivider = document.createElement('div')
    actionRailDivider.className = 'hx-action-bar__rail-divider'

    app.actionBar.appendChild(selectorsRow)
    app.actionBar.appendChild(actionRailDivider)
    app.actionBar.appendChild(actionTail)
    document.body.appendChild(app.actionBar)

    app.actionHelp = document.createElement('div')
    app.actionHelp.className = 'hx-panel hx-panel--glass'; app.actionHelp.style.cssText = `position:fixed; bottom:100px; left:50%; transform:translateX(-50%); color:var(--hx-accent-gold); font-size:11px; font-weight:bold; padding:4px 12px; border-radius:var(--hx-radius-pill); display:none;`
    document.body.appendChild(app.actionHelp)

    app.contextHint = document.createElement('div')
    app.contextHint.className = 'hx-panel hx-panel--glass'
    app.contextHint.style.cssText = `position:fixed; bottom:132px; left:50%; transform:translateX(-50%); color:var(--hx-text-secondary); font-size:11px; font-weight:600; padding:4px 12px; border-radius:var(--hx-radius-pill); display:none; pointer-events:none;`
    document.body.appendChild(app.contextHint)

    app.endOverlay = document.createElement('div')
    app.endOverlay.className = 'hx-end-overlay'
    app.endOverlay.style.cssText = `
      display: none; position: fixed; inset: 0; z-index: var(--hx-z-overlay);
      background: rgba(10, 11, 16, 0.85); backdrop-filter: blur(10px);
      flex-direction: column; align-items: center; justify-content: center;
      gap: var(--hx-space-3); pointer-events: auto;
    `
    app.endTitle = document.createElement('div')
    app.endTitle.className = 'hx-font-display'
    app.endTitle.style.cssText =
      'font-size: clamp(2rem, 6vw, 3.25rem); color: var(--hx-accent-gold); letter-spacing: 0.12em; text-align: center;'
    app.endSubtitle = document.createElement('div')
    app.endSubtitle.className = 'hx-font-ui'
    app.endSubtitle.style.cssText =
      'font-size: var(--hx-text-sm); color: var(--hx-text-muted); max-width: 28rem; text-align: center; padding: 0 var(--hx-space-4); line-height: var(--hx-leading-body);'
    app.endOverlay.appendChild(app.endTitle)
    app.endOverlay.appendChild(app.endSubtitle)
    document.body.appendChild(app.endOverlay)

    refreshLucideIcons()
  }

  syncActionHelpBanner() {
    const app = this.app
    if (app.actionHelp) {
      // Selections can be cleared outside of selectAction() (e.g. in HexMapInteraction),
      // so treat app state as the source of truth.
      const hasSelection = app.selectedBuilding || app.selectedUnitType
      app.actionHelp.style.display = hasSelection ? 'block' : 'none'
    }
  }

  setContextHint(message, tone = 'info') {
    const app = this.app
    if (!app.contextHint) return
    if (!message) {
      app.contextHint.style.display = 'none'
      app.contextHint.textContent = ''
      return
    }
    app.contextHint.textContent = message
    app.contextHint.style.display = 'block'
    if (tone === 'error') app.contextHint.style.color = 'var(--hx-danger)'
    else if (tone === 'success') app.contextHint.style.color = '#34d399'
    else app.contextHint.style.color = 'var(--hx-text-secondary)'
  }

  selectAction(type, id) {
    const app = this.app
    // Keep internal mirrors in sync with any external state changes
    // (e.g. HexMapInteraction clears App.instance selections directly).
    this.selectedBuilding = app.selectedBuilding ?? null
    this.selectedUnitType = app.selectedUnitType ?? null

    const item = [...app.buildingsList, ...app.unitsList].find(x => x.id === id)
    if (item?.tech && !app.game.researched.has(item.tech)) { 
      log(`Requires ${app.game.techTree[item.tech].name}`, 'color:orange'); 
      Sounds.play('incorrect', 1.0, 0.2, 0.8)
      const btn = type === 'building' ? app.buildButtons[id] : app.unitButtons[id]
      this.shakeButton(btn)
      return; 
    }
    
    // Check if player can afford
    if (item && item.cost && app.game && !app.game.canAfford(item.cost)) {
      log(`Not enough ${Object.keys(item.cost)[0]}!`, 'color:orange')
      Sounds.play('incorrect', 1.0, 0.2, 0.8)
      const btn = type === 'building' ? app.buildButtons[id] : app.unitButtons[id]
      this.shakeButton(btn)
      return
    }
    
    if (type === 'building') { this.selectedBuilding = this.selectedBuilding === id ? null : id; this.selectedUnitType = null; }
    else { this.selectedUnitType = this.selectedUnitType === id ? null : id; this.selectedBuilding = null; }
    
    app.selectedBuilding = this.selectedBuilding
    app.selectedUnitType = this.selectedUnitType

    for (const [bid, btn] of Object.entries(app.buildButtons)) btn.style.background = bid === this.selectedBuilding ? 'var(--hx-bg-active)' : 'transparent'
    for (const [uid, btn] of Object.entries(app.unitButtons)) btn.style.background = uid === this.selectedUnitType ? 'var(--hx-bg-active)' : 'transparent'
    
    if (this.selectedBuilding || this.selectedUnitType) { app.actionHelp.style.display = 'block'; app.actionHelp.textContent = `PLACE ${ (this.selectedBuilding || this.selectedUnitType).toUpperCase() }`; }
    else app.actionHelp.style.display = 'none';
  }

  updateGameUI() {
    const app = this.app
    if (!app.game || !app.buildingsList || !app.unitsList) return
    const r = app.game.resources
    app.resGold.val.textContent = r.gold; app.resWood.val.textContent = r.wood; app.resFood.val.textContent = r.food; app.resStone.val.textContent = r.stone; app.resScience.val.textContent = r.science;
    app.turnCounter.textContent = `TURN ${app.game.turn} / ${MAX_TURNS}`
    if (app.objectiveCaption && app.game.getObjectiveSummary) {
      const summary = app.game.getObjectiveSummary().slice(0, 2).join(' | ')
      app.objectiveCaption.textContent = summary ? `Objectives: ${summary}` : ''
    }
    if (app.waveCaption && app.game.getUpcomingWavePreview) {
      const nextWave = app.game.getUpcomingWavePreview()
      app.waveCaption.textContent = nextWave ? `Next Raid T${nextWave.turn}: ${nextWave.plan.name}` : ''
      if (app.nextTurnBtn && nextWave?.summary) {
        app.nextTurnBtn.title = nextWave.summary
      }
    }
    if (app.turnReport && app.game.getLastTurnReport) {
      const report = app.game.getLastTurnReport()
      if (report && report.turn > 1) {
        const delta = (value) => {
          if (value > 0) return `+${value}`
          if (value < 0) return `${value}`
          return '0'
        }
        const primaryWarnings = (report.warnings || []).slice(0, 2)
        const notes = (report.notes || []).slice(0, 2)
        const warningTone = report.starvation ? ' hx-turn-report--danger' : ''
        app.turnReport.className = `hx-turn-report${warningTone}`
        app.turnReport.innerHTML = `
          <div class="hx-turn-report__title">Turn ${report.turn} Report</div>
          <div class="hx-turn-report__grid">
            <span>Gold <strong>${delta(report.net.gold)}</strong></span>
            <span>Food <strong>${delta(report.net.food)}</strong></span>
            <span>Wood <strong>${delta(report.net.wood)}</strong></span>
            <span>Stone <strong>${delta(report.net.stone)}</strong></span>
            <span>Science <strong>${delta(report.net.science)}</strong></span>
            <span>Upkeep <strong>${report.upkeepPaid || 0}</strong></span>
          </div>
          ${primaryWarnings.length ? `<div class="hx-turn-report__warnings">${primaryWarnings.join(' · ')}</div>` : ''}
          ${notes.length ? `<div class="hx-turn-report__notes">${notes.join(' · ')}</div>` : ''}
        `
        app.turnReport.style.display = 'block'
      } else {
        app.turnReport.style.display = 'none'
        app.turnReport.innerHTML = ''
      }
    }
    if (app.nextTurnBtn) {
      const unacted = app.game.countUnactedPlayerUnits?.() || 0
      app.nextTurnBtn.textContent = unacted > 0 ? `END TURN (${unacted} UNACTED)` : 'END TURN ➔'
      app.nextTurnBtn.style.borderColor = unacted > 0 ? 'rgba(251,146,60,0.75)' : ''
      app.nextTurnBtn.style.boxShadow = unacted > 0 ? '0 0 0 1px rgba(251,146,60,0.4) inset' : ''
    }
    
    // Update victory progress bar
    if (app.victoryProgress) {
      const progressBar = app.victoryProgress.querySelector('.hx-victory-bar')
      const GOLD_GOAL = 1000
      const percent = Math.min(100, (r.gold / GOLD_GOAL) * 100)
      if (progressBar) {
        progressBar.style.width = `${percent}%`
        if (percent >= 100) {
          progressBar.style.background = 'linear-gradient(90deg, #4ade80, #22c55e)'
        } else if (percent >= 75) {
          progressBar.style.background = 'linear-gradient(90deg, #fbbf24, #f59e0b)'
        } else {
          progressBar.style.background = 'linear-gradient(90deg, var(--hx-accent-gold), #ffd700)'
        }
      }
    }
    
    const checkLock = (btn, tech) => { if (!btn) return; const isLocked = tech && !app.game.researched.has(tech); btn.disabled = isLocked; btn.style.filter = isLocked ? 'grayscale(1) opacity(0.4)' : 'none'; }
    app.buildingsList.forEach(d => checkLock(app.buildButtons[d.id], d.tech))
    app.unitsList.forEach(d => checkLock(app.unitButtons[d.id], d.tech))
    if (app.unitManager) app.unitManager.updateVisibility()
    if (app.unitManager) for (const [cKey, obj] of app.game.objects.entries()) if (obj.hp !== undefined) app.unitManager.updateHP(cKey, obj.hp, obj.maxHp, obj.rank || 1)

    // Selection can change outside of selectAction() (e.g. after placing),
    // so update visibility of the action help banner from app state.
    this.syncActionHelpBanner()
    
    if (app.endOverlay) {
      if (app.game.phase !== 'playing') {
        app.endOverlay.style.display = 'flex'
        const won = app.game.phase === 'won'
        app.endTitle.textContent = won ? 'TRIUMPH' : 'DEFEAT'
        if (app.endSubtitle) {
          if (won) app.endSubtitle.textContent = 'Your treasury goal is met — the charter holds.'
          else if (app.game.loseReason === 'capital')
            app.endSubtitle.textContent = `The enemy reached ${CAPITAL_SEAT_NAME}. The crown hex is lost.`
          else if (app.game.loseReason === 'time')
            app.endSubtitle.textContent = 'The last turn has passed — time defeats all realms.'
          else app.endSubtitle.textContent = 'The campaign ends here.'
        }
      } else {
        app.endOverlay.style.display = 'none'
      }
    }
    // Icons are static after mount; avoid re-scanning DOM each UI tick.
  }
}
