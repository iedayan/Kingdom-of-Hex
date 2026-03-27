import { CSS2DObject } from 'three/examples/jsm/Addons.js'

export async function exportPNG(app, opts = {}) {
  const mime = opts.mime ?? 'image/jpeg'
  const quality = typeof opts.quality === 'number' ? opts.quality : 0.92
  const isPng = mime === 'image/png'
  const ext = isPng ? 'png' : 'jpg'
  const filename = opts.filename ?? `kingdom-of-hex-${Date.now()}.${ext}`
  if (!app.canvas) throw new Error('No canvas')

  try {
    if (app.postFX && app.city) {
      const mask = []
      for (const g of app.city.grids.values()) {
        if (g.hexMesh) mask.push(g.hexMesh)
        if (g.decorations?.mesh) mask.push(g.decorations.mesh)
      }
      app.postFX.setWaterMaskObjects(mask)
      app.postFX.setOverlayObjects(app.city.getOverlayObjects())
      app.postFX.setWaterObjects(app.city.getWaterObjects())
      app.postFX.render()
    }
    await new Promise((r) => requestAnimationFrame(r))
  } catch (e) {
    console.warn('[EXPORT] pre-capture render failed', e)
  }

  return new Promise((resolve, reject) => {
    const canvas = app.canvas
    const finish = (blob) => {
      if (!blob) {
        reject(new Error('Empty snapshot'))
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.rel = 'noopener'
      a.click()
      URL.revokeObjectURL(url)
      resolve(undefined)
    }

    try {
      if (canvas.toBlob) {
        canvas.toBlob(finish, mime, isPng ? undefined : quality)
      } else {
        const dataUrl = canvas.toDataURL(mime, isPng ? undefined : quality)
        fetch(dataUrl).then((r) => r.blob()).then(finish).catch(reject)
      }
    } catch (err) {
      reject(err)
    }
  })
}

export function fadeIn(app, durationMs = 1000, deps) {
  const { gsap } = deps
  const u = app.postFX.fadeOpacity
  const state = { v: u.value }
  gsap.to(state, {
    v: 1,
    duration: durationMs / 1000,
    ease: 'power2.out',
    onUpdate: () => {
      u.value = state.v
    },
  })
  setTimeout(() => {
    if (app.postFX?.fadeOpacity && app.postFX.fadeOpacity.value < 0.999) app.postFX.fadeOpacity.value = 1
  }, durationMs + 500)
}

export function panToTile(app, cKey, duration = 0.8, deps) {
  const { HexUtils, gsap } = deps
  if (!app.unitManager || !app.controls) return
  const coords = HexUtils.parse(cKey)
  const pos = app.unitManager.getWorldPosition(coords.q, coords.r, coords.s, 0)
  gsap.to(app.controls.target, {
    x: pos.x,
    y: 1,
    z: pos.z,
    duration,
    ease: 'power2.inOut',
    onUpdate: () => app.controls.update(),
  })
}

export function showTurnNotification(app, text, duration = 2000, deps) {
  const { gsap } = deps
  if (app._turnNotif && app._turnNotif.parentElement) document.body.removeChild(app._turnNotif)
  const el = document.createElement('div')
  el.className = 'hx-font-display hx-panel hx-panel--glass'
  el.style.cssText =
    'position: fixed; top: 40%; left: 50%; transform: translate(-50%, -50%); padding: var(--hx-space-4) var(--hx-space-6); font-size: 32px; color: var(--hx-accent-gold); letter-spacing: 4px; z-index: var(--hx-z-overlay); pointer-events: none; border-radius: var(--hx-radius-lg); border: 1px solid var(--hx-accent-gold); box-shadow: 0 0 40px rgba(212, 165, 116, 0.2); opacity: 0;'
  el.textContent = text.toUpperCase()
  document.body.appendChild(el)
  app._turnNotif = el
  const tl = gsap.timeline({
    onComplete: () => {
      if (el.parentElement) document.body.removeChild(el)
      app._turnNotif = null
    },
  })
  tl.to(el, { opacity: 1, top: '45%', duration: 0.5, ease: 'power2.out' })
  tl.to(el, { opacity: 0, top: '50%', duration: 0.5, delay: (duration - 1000) / 1000, ease: 'power2.in' })
}

export function spawnFloatingText(app, text, worldPos, color = '#fff', deps) {
  const { gsap } = deps
  const el = document.createElement('div')
  el.className = 'hx-font-ui'
  el.style.cssText =
    `color:${color}; font-weight:800; font-size:16px; text-shadow:0 2px 4px rgba(0,0,0,0.5); pointer-events:none; white-space:nowrap;`
  el.textContent = text
  const label = new CSS2DObject(el)
  label.position.copy(worldPos)
  label.position.y += 1.5
  app.scene.add(label)
  gsap.to(label.position, { y: label.position.y + 2, duration: 1.5, ease: 'power1.out' })
  gsap.to(el, {
    opacity: 0,
    duration: 1.5,
    ease: 'power1.in',
    onComplete: () => {
      if (app.scene) app.scene.remove(label)
    },
  })
}
