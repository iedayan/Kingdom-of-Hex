import { log } from '../logging/gameConsole.js'

const MobileController = {
  isMobile: false,
  touchStart: null,
  pinchDistance: 0,
  lastTap: 0,

  init(app) {
    this.isMobile = this._detectMobile()
    if (!this.isMobile) return

    this.app = app
    this._createTouchControls()
    this._setupTouchHandlers()
    
    log('[MOBILE] Touch controls initialized')
  },

  _detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2)
  },

  _createTouchControls() {
    const container = document.createElement('div')
    container.id = 'mobile-controls'
    container.style.cssText = `
      position: fixed; bottom: 80px; right: 16px;
      display: flex; flex-direction: column; gap: 8px;
      z-index: 9997; touch-action: none;
    `

    const buttons = [
      { action: 'endTurn', icon: '⏭️', label: 'End Turn' },
      { action: 'menu', icon: '☰', label: 'Menu' },
      { action: 'tech', icon: '🔬', label: 'Tech' }
    ]

    buttons.forEach(btn => {
      const button = document.createElement('button')
      button.dataset.action = btn.action
      button.style.cssText = `
        width: 56px; height: 56px; border-radius: 50%;
        background: rgba(30,30,45,0.9); border: 2px solid #4ecdc4;
        color: white; font-size: 24px; cursor: pointer;
        touch-action: manipulation;
        backdrop-filter: blur(4px);
      `
      button.textContent = btn.icon
      button.title = btn.label
      button.addEventListener('touchstart', (e) => {
        e.preventDefault()
        this._handleButtonPress(btn.action)
      })
      container.appendChild(button)
    })

    const dpad = document.createElement('div')
    dpad.id = 'dpad'
    dpad.style.cssText = `
      position: fixed; bottom: 16px; left: 16px;
      display: grid; grid-template-columns: repeat(3, 48px);
      grid-template-rows: repeat(3, 48px); gap: 4px;
      z-index: 9997; touch-action: none;
    `

    const directions = [
      { key: 'up', grid: '1/1', icon: '▲' },
      { key: 'left', grid: '2/1', icon: '◀' },
      { key: 'center', grid: '2/2', icon: '●' },
      { key: 'right', grid: '2/3', icon: '▶' },
      { key: 'down', grid: '3/2', icon: '▼' }
    ]

    directions.forEach(dir => {
      const btn = document.createElement('button')
      btn.dataset.dir = dir.key
      btn.style.cssText = `
        width: 48px; height: 48px; border-radius: 8px;
        background: rgba(30,30,45,0.9); border: 1px solid #555;
        color: white; font-size: 18px; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        touch-action: manipulation;
      `
      btn.textContent = dir.icon
      btn.style.gridColumn = dir.grid.split('/')[1]
      btn.style.gridRow = dir.grid.split('/')[0]
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault()
        this._handleDPadPress(dir.key)
      })
      dpad.appendChild(btn)
    })

    document.body.appendChild(container)
    document.body.appendChild(dpad)
  },

  _setupTouchHandlers() {
    let canvas = document.querySelector('canvas')
    if (!canvas) {
      canvas = document.querySelector('#game-canvas') || document.body
    }

    canvas.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: false })
    canvas.addEventListener('touchmove', this._onTouchMove.bind(this), { passive: false })
    canvas.addEventListener('touchend', this._onTouchEnd.bind(this), { passive: false })
  },

  _onTouchStart(e) {
    if (e.touches.length === 1) {
      this.touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    } else if (e.touches.length === 2) {
      this.pinchDistance = this._getPinchDistance(e.touches)
    }
  },

  _onTouchMove(e) {
    if (e.touches.length === 2) {
      const newDist = this._getPinchDistance(e.touches)
      const delta = newDist - this.pinchDistance
      if (this.app?.camera && Math.abs(delta) > 10) {
        this.app.camera.position.y = Math.max(5, Math.min(50, this.app.camera.position.y - delta * 0.05))
      }
      this.pinchDistance = newDist
    }
  },

  _onTouchEnd(e) {
    if (this.touchStart) {
      const dx = e.changedTouches[0].clientX - this.touchStart.x
      const dy = e.changedTouches[0].clientY - this.touchStart.y
      
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        const now = Date.now()
        if (now - this.lastTap < 300) {
          this._handleTap(e.changedTouches[0].clientX, e.changedTouches[0].clientY)
        }
        this.lastTap = now
      }
    }
    this.touchStart = null
  },

  _getPinchDistance(touches) {
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    )
  },

  _handleTap(x, y) {
    if (this.app?.onCanvasTap) {
      this.app.onCanvasTap(x, y)
    }
  },

  _handleButtonPress(action) {
    if (!this.app?.game) return

    switch (action) {
      case 'endTurn':
        this.app.game.nextTurn?.()
        break
      case 'menu':
        const menu = document.querySelector('.system-menu button')
        menu?.click()
        break
      case 'tech':
        if (this.app.showTechModal) this.app.showTechModal()
        break
    }
  },

  _handleDPadPress(dir) {
    if (!this.app?.camera) return

    const speed = 3
    switch (dir) {
      case 'up':
        this.app.camera.position.z -= speed
        break
      case 'down':
        this.app.camera.position.z += speed
        break
      case 'left':
        this.app.camera.position.x -= speed
        break
      case 'right':
        this.app.camera.position.x += speed
        break
      case 'center':
        if (this.app.panToTile) this.app.panToTile('0,0,0')
        break
    }
  }
}

export { MobileController }
