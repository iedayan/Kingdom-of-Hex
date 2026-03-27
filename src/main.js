import './ui/styles/tokens.css'
import { Howler } from 'howler'
import { App } from './App.js'
import WebGPU from 'three/examples/jsm/capabilities/WebGPU.js'

/** Browsers block AudioContext until a user gesture; resume on first interaction. */
function wireAudioUnlock() {
  const resume = () => {
    const ctx = Howler.ctx
    if (ctx?.state === 'suspended') ctx.resume().catch(() => {})
  }
  document.addEventListener('pointerdown', resume, { once: true })
  document.addEventListener('keydown', resume, { once: true })
}
wireAudioUnlock()

const loadingEl = document.getElementById('loading')
const canvas = document.getElementById('canvas')

let app = null

async function init() {
  if (!WebGPU.isAvailable()) {
    const errorEl = document.getElementById('webgpu-error')
    if (errorEl) {
      errorEl.style.display = 'flex'
    } else {
      loadingEl.innerHTML = '<p style="color:#fff">WebGPU is not available on your device or browser.</p>'
    }
    return
  }

  app = new App(canvas)
  await app.init()

  // Hide loading overlay
  loadingEl.style.display = 'none'

  // Fade in scene
  app.fadeIn(1000)

  // Start intro build animation
  app.city.startIntroAnimation(app.camera, app.controls, 4)
}

init()
