import { log } from '../logging/gameConsole.js'

const ErrorHandler = {
  initialized: false,

  init() {
    if (this.initialized) return
    this.initialized = true

    window.onerror = (message, source, lineno, colno, error) => {
      this.handleError(error || new Error(message), {
        type: 'unhandled_error',
        source,
        lineno,
        colno
      })
    }

    window.onunhandledrejection = (event) => {
      this.handleError(new Error(event.reason), {
        type: 'unhandled_promise'
      })
    }

    log('[ERROR_HANDLER] Global error handlers registered')
  },

  handleError(error, context = {}) {
    console.error('[ERROR]', error.message, context)
    
    if (typeof window !== 'undefined' && window.Analytics) {
      window.Analytics.trackError(error, context)
    }

    this._maybeShowRecoveryUI(error, context)
    
    return false
  },

  _maybeShowRecoveryUI(error, context) {
    if (context.type === 'webgpu' || error.message.includes('WebGPU')) {
      this._showWebGPUError()
      return true
    }

    if (context.type === 'unhandled_error' && error.message.length > 100) {
      this._showGenericError()
      return true
    }

    return false
  },

  _showWebGPUError() {
    const overlay = document.createElement('div')
    overlay.id = 'webgpu-error'
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 99999;
      background: rgba(0,0,0,0.95);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      color: white; font-family: system-ui;
      padding: 2rem; text-align: center;
    `
    overlay.innerHTML = `
      <h2 style="color: #ff6b6b; margin-bottom: 1rem;">WebGPU Not Supported</h2>
      <p style="color: #aaa; max-width: 400px; line-height: 1.6;">
        Your browser doesn't support WebGPU, which is required for this game.
      </p>
      <p style="color: #aaa; margin-top: 1rem;">
        Please try Chrome 113+, Edge 113+, or Safari 17+.
      </p>
      <button onclick="location.reload()" style="
        margin-top: 2rem; padding: 0.75rem 2rem;
        background: #4ecdc4; border: none; border-radius: 8px;
        color: #1a1a2e; font-weight: bold; cursor: pointer;
      ">Retry</button>
    `
    document.body.appendChild(overlay)
  },

  _showGenericError() {
    if (document.getElementById('generic-error')) return
    
    const overlay = document.createElement('div')
    overlay.id = 'generic-error'
    overlay.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 9999;
      background: #ff6b6b; color: white; padding: 1rem 1.5rem;
      border-radius: 8px; font-family: system-ui; font-size: 14px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      max-width: 300px;
    `
    overlay.innerHTML = `
      <strong>An error occurred</strong>
      <p style="margin: 0.5rem 0 0; font-size: 12px; opacity: 0.9;">
        The game has been auto-saved. Refreshing the page will restore your progress.
      </p>
    `
    document.body.appendChild(overlay)
    
    setTimeout(() => overlay.remove(), 5000)
  },

  wrapAsync(fn, fallback) {
    return async (...args) => {
      try {
        return await fn(...args)
      } catch (error) {
        this.handleError(error, { function: fn.name })
        if (fallback) return fallback(...args)
      }
    }
  },

  wrapSync(fn, fallback) {
    return (...args) => {
      try {
        return fn(...args)
      } catch (error) {
        this.handleError(error, { function: fn.name })
        if (fallback) return fallback(...args)
      }
    }
  }
}

if (typeof window !== 'undefined') {
  window.ErrorHandler = ErrorHandler
}

export { ErrorHandler }
