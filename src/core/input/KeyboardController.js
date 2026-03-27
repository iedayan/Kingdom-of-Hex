import { log } from '../logging/gameConsole.js'
import { createTutorialModal } from '../../ui/screens/Tutorial.js'

const KeyboardController = {
  bindings: new Map(),
  enabled: false,
  target: null,

  init(app) {
    this.target = app
    this._registerDefaultBindings()
    
    document.addEventListener('keydown', this._handleKeyDown.bind(this))
    document.addEventListener('keyup', this._handleKeyUp.bind(this))
    
    this.enabled = true
    log('[KEYBOARD] Controls initialized')
  },

  _registerDefaultBindings() {
    this.bindings.set('Space', { action: 'endTurn', description: 'End Turn' })
    this.bindings.set('Escape', { action: 'cancel', description: 'Cancel / Close Menu' })
    this.bindings.set('1', { action: 'selectBuilding', data: 'lumberjack', description: 'Build Lumberjack' })
    this.bindings.set('2', { action: 'selectBuilding', data: 'farm', description: 'Build Farm' })
    this.bindings.set('3', { action: 'selectBuilding', data: 'mine', description: 'Build Mine' })
    this.bindings.set('4', { action: 'selectBuilding', data: 'market', description: 'Build Market' })
    this.bindings.set('5', { action: 'selectBuilding', data: 'tower', description: 'Build Tower' })
    this.bindings.set('6', { action: 'selectBuilding', data: 'library', description: 'Build Library' })
    this.bindings.set('u', { action: 'selectUnit', data: 'scout', description: 'Train Scout' })
    this.bindings.set('a', { action: 'selectUnit', data: 'archer', description: 'Train Archer' })
    this.bindings.set('k', { action: 'selectUnit', data: 'knight', description: 'Train Knight' })
    this.bindings.set('t', { action: 'openTech', description: 'Open Tech Tree' })
    this.bindings.set('r', { action: 'recall', description: 'Recall Scout' })
    this.bindings.set('Tab', { action: 'cycleUnit', description: 'Cycle Units' })
    this.bindings.set('ArrowUp', { action: 'pan', data: 'up', description: 'Pan Camera Up' })
    this.bindings.set('ArrowDown', { action: 'pan', data: 'down', description: 'Pan Camera Down' })
    this.bindings.set('ArrowLeft', { action: 'pan', data: 'left', description: 'Pan Camera Left' })
    this.bindings.set('ArrowRight', { action: 'pan', data: 'right', description: 'Pan Camera Right' })
    this.bindings.set('Home', { action: 'centerCapital', description: 'Center on Capital' })
    this.bindings.set('m', { action: 'toggleMenu', description: 'Toggle Menu' })
    this.bindings.set('?', { action: 'showHelp', description: 'Show Controls' })
  },

  _handleKeyDown(e) {
    if (!this.enabled || !this.target) return

    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

    const binding = this.bindings.get(e.key)
    if (!binding) return

    e.preventDefault()
    this._executeBinding(binding, e)
  },

  _handleKeyUp(e) {
    if (!this.enabled) return
  },

  _executeBinding(binding, event) {
    if (!this.target.game) return

    switch (binding.action) {
      case 'endTurn':
        this.target.game.nextTurn?.()
        break
        
      case 'cancel':
        this.target.clearSelections?.()
        if (this.target.closeModals) this.target.closeModals()
        break
        
      case 'selectBuilding':
        if (this.target.selectBuildingType) {
          this.target.selectBuildingType(binding.data)
        }
        break
        
      case 'selectUnit':
        if (this.target.selectUnitType) {
          this.target.selectUnitType(binding.data)
        }
        break
        
      case 'openTech':
        if (this.target.showTechModal) this.target.showTechModal()
        break
        
      case 'recall':
        if (this.target.recallScout) this.target.recallScout()
        break
        
      case 'cycleUnit':
        this._cycleToNextUnit()
        break
        
      case 'pan':
        this._panCamera(binding.data)
        break
        
      case 'centerCapital':
        if (this.target.panToTile) this.target.panToTile('0,0,0')
        break
        
      case 'toggleMenu':
        this._toggleMenu()
        break
        
      case 'showHelp':
        this._showControlsHelp()
        break
    }
  },

  _cycleToNextUnit() {
    if (!this.target.game?.getNextActionableUnitKey) return
    const interaction = this.target.city?.interaction
    const currentKey = interaction?.selectedUnitKey ?? this.target.selectedUnitKey ?? null
    const nextKey = this.target.game.getNextActionableUnitKey(currentKey)
    if (nextKey && this.target.selectUnit) this.target.selectUnit(nextKey)
  },

  _panCamera(direction) {
    if (!this.target.camera) return
    
    const speed = 2
    switch (direction) {
      case 'up': this.target.camera.position.y += speed; break
      case 'down': this.target.camera.position.y -= speed; break
      case 'left': this.target.camera.position.x -= speed; break
      case 'right': this.target.camera.position.x += speed; break
    }
  },

  _toggleMenu() {
    const menu = document.querySelector('.system-menu')
    if (menu) {
      menu.style.display = menu.style.display === 'none' ? 'flex' : 'none'
    }
  },

  _showControlsHelp() {
    const existing = document.getElementById('controls-help')
    if (existing) { existing.remove(); return }

    const help = document.createElement('div')
    help.id = 'controls-help'
    help.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: var(--hx-panel-bg, rgba(20,20,30,0.95));
      border: 1px solid var(--hx-border, #333);
      border-radius: 12px; padding: 1.5rem;
      color: white; font-family: system-ui; z-index: 10000;
      min-width: 300px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      cursor: pointer;
    `
    
    let html = '<h3 style="margin: 0 0 1rem; color: #4ecdc4;">Keyboard Controls</h3><table style="width:100%;font-size:14px;">'
    for (const [key, binding] of this.bindings) {
      html += `<tr><td style="padding:4px 8px;font-weight:bold;min-width:60px;">${key}</td><td style="padding:4px 8px;color:#aaa;">${binding.description}</td></tr>`
    }
    html += '</table><p style="margin-top:1rem;font-size:12px;color:#4ecdc4;">Click anywhere to see full tutorial</p>'
    help.innerHTML = html
    
    help.onclick = () => {
      help.remove()
      createTutorialModal(this.target)
    }
    
    document.body.appendChild(help)
  },

  disable() { this.enabled = false },
  enable() { this.enabled = true },

  getBindings() {
    return Array.from(this.bindings.entries()).map(([key, binding]) => ({
      key,
      ...binding
    }))
  }
}

export { KeyboardController }
