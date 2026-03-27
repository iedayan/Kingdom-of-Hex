export function initSystemMenu(app, deps) {
  const { Sounds } = deps

  const container = document.createElement('div')
  container.className = 'system-menu'
  container.style.cssText = 'position:fixed; top:12px; right:12px; display:flex; flex-direction:column; align-items:flex-end; gap:8px; z-index:var(--hx-z-hud);'

  const toggleBtn = document.createElement('button')
  toggleBtn.className = 'hx-btn hx-panel--glass'
  toggleBtn.innerHTML = '⚙️'
  toggleBtn.style.cssText = 'width:44px; height:44px; border-radius:var(--hx-radius-pill);'

  const menu = document.createElement('div')
  menu.className = 'hx-panel hx-panel--glass'
  menu.style.cssText = 'display:none; flex-direction:column; padding:var(--hx-space-2); gap:4px; min-width:140px;'

  toggleBtn.onclick = (e) => {
    e.stopPropagation()
    menu.style.display = menu.style.display === 'none' ? 'flex' : 'none'
  }

  const controlsBtn = document.createElement('button')
  controlsBtn.className = 'hx-btn hx-btn--ghost'
  controlsBtn.textContent = 'Controls'
  controlsBtn.onclick = (e) => {
    e.stopPropagation()
    app.gui?.gui?.domElement.classList.toggle('gui-hidden')
  }

  const settingsBtn = document.createElement('button')
  settingsBtn.className = 'hx-btn hx-btn--ghost'
  settingsBtn.textContent = 'Settings'
  settingsBtn.onclick = (e) => {
    e.stopPropagation()
    app.toggleSettingsModal()
  }

  const resetBtn = document.createElement('button')
  resetBtn.className = 'hx-btn hx-btn--ghost'
  resetBtn.textContent = 'Reset Kingdom'
  resetBtn.style.color = 'var(--hx-danger)'
  resetBtn.onclick = (e) => {
    e.stopPropagation()
    if (confirm('Reset?')) location.reload()
  }

  const pauseBtn = document.createElement('button')
  pauseBtn.className = 'hx-btn hx-btn--ghost'
  pauseBtn.textContent = 'Pause'
  pauseBtn.onclick = (e) => {
    e.stopPropagation()
    app.togglePause()
  }

  const sfxBtn = document.createElement('button')
  sfxBtn.className = 'hx-btn hx-btn--ghost'
  sfxBtn.id = 'sound-toggle'
  const musicBtn = document.createElement('button')
  musicBtn.className = 'hx-btn hx-btn--ghost'
  musicBtn.id = 'music-toggle'

  const updateSoundBtn = () => {
    sfxBtn.textContent = Sounds.isMuted() ? '🔇 SFX' : '🔊 SFX'
  }
  const updateMusicBtn = () => {
    musicBtn.textContent = Sounds.isMusicEnabled() ? '🎵 Music' : '🔇 Music'
  }

  updateSoundBtn()
  updateMusicBtn()

  sfxBtn.onclick = (e) => {
    e.stopPropagation()
    Sounds.toggleMute()
    updateSoundBtn()
  }
  musicBtn.onclick = (e) => {
    e.stopPropagation()
    Sounds.toggleMusic()
    updateMusicBtn()
  }

  menu.appendChild(sfxBtn)
  menu.appendChild(musicBtn)
  menu.appendChild(settingsBtn)
  menu.appendChild(controlsBtn)
  menu.appendChild(pauseBtn)
  menu.appendChild(resetBtn)
  container.appendChild(toggleBtn)
  container.appendChild(menu)
  document.body.appendChild(container)

  app._initSettingsModal()
  app.researchModal = document.createElement('div')
  app.researchModal.className = 'hx-panel hx-panel--glass hx-research-modal'
  document.body.appendChild(app.researchModal)
}
