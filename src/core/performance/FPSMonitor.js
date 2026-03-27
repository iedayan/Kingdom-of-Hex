export class FPSMonitor {
  constructor() {
    this.frames = 0
    this.lastTime = performance.now()
    this.fps = 60
    this.minFps = 60
    this.maxFps = 0
    this.enabled = false
    this.element = null
    this.history = []
    this.maxHistory = 60
  }

  start() {
    this.enabled = true
    this._createElement()
    this._tick()
  }

  stop() {
    this.enabled = false
    if (this.element) {
      this.element.remove()
      this.element = null
    }
  }

  _createElement() {
    this.element = document.createElement('div')
    this.element.id = 'fps-monitor'
    this.element.style.cssText = `
      position: fixed; bottom: 12px; left: 12px; z-index: 9998;
      background: rgba(0,0,0,0.7); color: #4ecdc4;
      padding: 6px 12px; border-radius: 6px;
      font-family: 'JetBrains Mono', monospace; font-size: 12px;
      font-variant-numeric: tabular-nums;
      pointer-events: none;
    `
    document.body.appendChild(this.element)
  }

  _tick() {
    if (!this.enabled) return
    
    this.frames++
    const now = performance.now()
    const delta = now - this.lastTime

    if (delta >= 1000) {
      this.fps = Math.round((this.frames * 1000) / delta)
      this.minFps = Math.min(this.minFps, this.fps)
      this.maxFps = Math.max(this.maxFps, this.fps)
      
      this.history.push(this.fps)
      if (this.history.length > this.maxHistory) this.history.shift()

      this.frames = 0
      this.lastTime = now

      if (this.element) {
        const color = this.fps >= 55 ? '#4ecdc4' : this.fps >= 30 ? '#ffd93d' : '#ff6b6b'
        this.element.innerHTML = `
          <span style="color:${color}">${this.fps}</span> FPS
          <span style="color:#666;margin-left:8px;">min:${this.minFps}</span>
          <span style="color:#666;margin-left:4px;">max:${this.maxFps}</span>
        `
      }
    }

    requestAnimationFrame(() => this._tick())
  }

  getStats() {
    return {
      current: this.fps,
      min: this.minFps,
      max: this.maxFps,
      avg: this.history.length > 0 
        ? Math.round(this.history.reduce((a, b) => a + b, 0) / this.history.length)
        : 0
    }
  }

  reset() {
    this.minFps = 60
    this.maxFps = 0
    this.history = []
  }
}

export const fpsMonitor = new FPSMonitor()
