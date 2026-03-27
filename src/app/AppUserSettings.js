const DEFAULT_USER_SETTINGS = {
  reducedMotion: false,
  highContrast: false,
  showFPS: false,
  performanceMode: false,
  masterVolume: 1.0,
  sfxVolume: 0.9,
  musicVolume: 0.35,
  uiScale: 1.0,
}

export function loadUserSettings() {
  try {
    const raw = localStorage.getItem('hx_user_settings')
    if (!raw) return { ...DEFAULT_USER_SETTINGS }
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_USER_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_USER_SETTINGS }
  }
}

export function saveUserSettings(settings) {
  try {
    localStorage.setItem('hx_user_settings', JSON.stringify(settings))
  } catch {}
}

export function applyUserSettings(app, deps) {
  const { Sounds, fpsMonitor } = deps
  const s = app.userSettings
  if (!s) return

  document.body.classList.toggle('hx-reduced-motion', !!s.reducedMotion)
  document.body.classList.toggle('hx-high-contrast', !!s.highContrast)
  document.documentElement.style.setProperty('--hx-ui-scale', String(Math.max(0.9, Math.min(1.2, s.uiScale || 1))))

  Sounds.setMasterVolume?.(typeof s.masterVolume === 'number' ? s.masterVolume : 1)
  Sounds.setSfxVolume?.(typeof s.sfxVolume === 'number' ? s.sfxVolume : 0.9)
  Sounds.setMusicVolume?.(typeof s.musicVolume === 'number' ? s.musicVolume : 0.35)

  if (s.showFPS) fpsMonitor.start()
  else fpsMonitor.stop()

  if (app.renderer) {
    const dpr = window.devicePixelRatio || 1
    const target = s.performanceMode ? Math.min(1, dpr) : Math.min(2, dpr)
    app.renderer.setPixelRatio(target)
    app.onResize()
  }
}

export function setUserSetting(app, key, value, deps) {
  app.userSettings = { ...app.userSettings, [key]: value }
  saveUserSettings(app.userSettings)
  applyUserSettings(app, deps)
  renderSettingsModal(app, deps)
}

export function initSettingsModal(app, deps) {
  const modal = document.createElement('div')
  modal.className = 'hx-panel hx-panel--glass'
  modal.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    z-index: var(--hx-z-modal); width: min(520px, calc(100vw - 24px));
    display: none; flex-direction: column; gap: 12px; padding: 16px;
    max-height: 80vh; overflow-y: auto;
  `
  app.settingsModal = modal
  document.body.appendChild(modal)
  renderSettingsModal(app, deps)
}

function settingsToggleRow(title, subtitle, key, checked) {
  return `
    <label class="hx-font-ui" style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:8px;border:1px solid var(--hx-border-subtle);border-radius:8px;">
      <span style="display:flex;flex-direction:column;">
        <span style="color:var(--hx-text-primary);font-weight:600;">${title}</span>
        <span style="color:var(--hx-text-muted);font-size:12px;">${subtitle}</span>
      </span>
      <input id="hx-setting-${key}" type="checkbox" ${checked ? 'checked' : ''} />
    </label>
  `
}

export function renderSettingsModal(app, deps) {
  const modal = app.settingsModal
  if (!modal) return
  const s = app.userSettings

  modal.innerHTML = `
    <div class="hx-font-ui" style="display:flex;justify-content:space-between;align-items:center;">
      <b style="letter-spacing:0.08em;color:var(--hx-accent-gold);">SETTINGS</b>
      <button id="hx-settings-close" class="hx-btn hx-btn--ghost">Close</button>
    </div>
    ${settingsToggleRow('Reduced Motion', 'Less shake and animation intensity', 'reducedMotion', s.reducedMotion)}
    ${settingsToggleRow('High Contrast UI', 'Stronger HUD contrast and readability', 'highContrast', s.highContrast)}
    ${settingsToggleRow('Show FPS', 'Display live performance counter', 'showFPS', s.showFPS)}
    ${settingsToggleRow('Performance Mode', 'Lower render resolution for smoother FPS', 'performanceMode', s.performanceMode)}
    <label class="hx-font-ui" style="display:flex;flex-direction:column;gap:6px;color:var(--hx-text-secondary);">
      Master Volume: <b style="color:var(--hx-text-primary);">${Math.round((s.masterVolume || 0) * 100)}%</b>
      <input id="hx-volume" type="range" min="0" max="1" step="0.05" value="${s.masterVolume ?? 1}">
    </label>
    <label class="hx-font-ui" style="display:flex;flex-direction:column;gap:6px;color:var(--hx-text-secondary);">
      SFX Volume: <b style="color:var(--hx-text-primary);">${Math.round((s.sfxVolume || 0) * 100)}%</b>
      <input id="hx-sfx-volume" type="range" min="0" max="1" step="0.05" value="${s.sfxVolume ?? 0.9}">
    </label>
    <label class="hx-font-ui" style="display:flex;flex-direction:column;gap:6px;color:var(--hx-text-secondary);">
      Music Volume: <b style="color:var(--hx-text-primary);">${Math.round((s.musicVolume || 0) * 100)}%</b>
      <input id="hx-music-volume" type="range" min="0" max="1" step="0.05" value="${s.musicVolume ?? 0.35}">
    </label>
    <label class="hx-font-ui" style="display:flex;flex-direction:column;gap:6px;color:var(--hx-text-secondary);">
      UI Scale: <b style="color:var(--hx-text-primary);">${(s.uiScale || 1).toFixed(2)}x</b>
      <input id="hx-ui-scale" type="range" min="0.9" max="1.2" step="0.05" value="${s.uiScale ?? 1}">
    </label>
  `

  const close = modal.querySelector('#hx-settings-close')
  if (close) close.onclick = () => toggleSettingsModal(app, false, deps)

  for (const key of ['reducedMotion', 'highContrast', 'showFPS', 'performanceMode']) {
    const el = modal.querySelector(`#hx-setting-${key}`)
    if (el) el.onchange = (e) => setUserSetting(app, key, !!e.target.checked, deps)
  }
  const vol = modal.querySelector('#hx-volume')
  if (vol) vol.oninput = (e) => setUserSetting(app, 'masterVolume', Number(e.target.value), deps)
  const sfxVol = modal.querySelector('#hx-sfx-volume')
  if (sfxVol) sfxVol.oninput = (e) => setUserSetting(app, 'sfxVolume', Number(e.target.value), deps)
  const musicVol = modal.querySelector('#hx-music-volume')
  if (musicVol) musicVol.oninput = (e) => setUserSetting(app, 'musicVolume', Number(e.target.value), deps)
  const uiScale = modal.querySelector('#hx-ui-scale')
  if (uiScale) uiScale.oninput = (e) => setUserSetting(app, 'uiScale', Number(e.target.value), deps)
}

export function toggleSettingsModal(app, forceOpen = null, deps) {
  if (!app.settingsModal) return
  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : app.settingsModal.style.display !== 'flex'
  app.settingsModal.style.display = shouldOpen ? 'flex' : 'none'
  if (shouldOpen) renderSettingsModal(app, deps)
}
