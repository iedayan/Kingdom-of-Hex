export function toggleResearchModal(app) {
  const opening = !app.researchModal.classList.contains('is-open')
  app.researchModal.classList.toggle('is-open', opening)
  if (opening) updateResearchModal(app)
}

export function updateResearchModal(app) {
  const game = app.game
  if (!game) {
    app.researchModal.innerHTML = `
      <h2 class="hx-research-modal__title">TECH LAB</h2>
      <p class="hx-font-ui hx-research-modal__empty">No active run.</p>
      <div class="hx-research-modal__footer">
        <button type="button" id="research-back" class="hx-btn hx-btn--primary">BACK</button>
      </div>`
    app.researchModal.querySelector('#research-back').onclick = () => toggleResearchModal(app)
    return
  }

  const sci = game.resources?.science ?? 0
  app.researchModal.innerHTML = `
    <h2 class="hx-research-modal__title">TECH LAB <span class="hx-research-modal__science" translate="no">· SCI ${sci}</span></h2>
    <div id="research-options" class="hx-research-modal__options"></div>
    <div class="hx-research-modal__footer">
      <button type="button" id="research-back" class="hx-btn hx-btn--primary">BACK</button>
    </div>`

  const options = app.researchModal.querySelector('#research-options')
  for (const [id, t] of Object.entries(game.techTree)) {
    const div = document.createElement('div')
    div.className = 'hx-research-row hx-font-ui'
    if (game.researched.has(id)) div.classList.add('hx-research-row--done')
    else if (game.currentResearch === id) div.classList.add('hx-research-row--active')

    const inner = document.createElement('div')
    inner.className = 'hx-research-row__body'
    inner.innerHTML = `<b>${t.name}</b><small>${game.researched.has(id) ? 'MASTERED' : `Cost ${t.cost} · progress ${t.progress} / ${t.cost}`}</small>`
    div.appendChild(inner)

    if (!game.researched.has(id)) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'hx-btn hx-research-row__action'
      btn.textContent = game.currentResearch === id ? 'ACTIVE' : 'START'
      btn.disabled = game.currentResearch === id
      btn.onclick = () => startResearch(app, id)
      div.appendChild(btn)
    } else {
      const check = document.createElement('span')
      check.className = 'hx-research-row__badge'
      check.textContent = '✓'
      check.title = 'Researched'
      div.appendChild(check)
    }
    options.appendChild(div)
  }

  app.researchModal.querySelector('#research-back').onclick = () => toggleResearchModal(app)
}

export function showEventModal(app, event, deps) {
  const { Sounds, refreshLucideIcons } = deps
  const backdrop = document.createElement('div')
  backdrop.style.cssText = 'position:fixed;inset:0;z-index:calc(var(--hx-z-modal) - 1);background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);'

  const modal = document.createElement('div')
  modal.className = 'hx-panel hx-panel--glass'
  modal.style.cssText = `
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    padding: var(--hx-space-6);
    z-index: var(--hx-z-modal);
    min-width: 500px;
    max-width: 600px;
    display: flex; flex-direction: column; gap: var(--hx-space-4);
    box-shadow: 0 30px 100px rgba(0,0,0,0.9);
    animation: hx-fade-in 0.5s ease-out;
  `

  modal.innerHTML = `
    <h2 class="hx-font-display" style="color:var(--hx-accent-gold); margin:0; font-size:32px; letter-spacing:2px;">${event.title.toUpperCase()}</h2>
    <p class="hx-font-ui" style="line-height:1.6; font-size:16px; color:var(--hx-text-secondary);">${event.text}</p>
    <div id="event-options" style="display:flex; flex-direction:column; gap:12px; margin-top:10px;"></div>
  `

  const dismiss = () => {
    backdrop.onkeydown = null
    if (backdrop.parentElement) document.body.removeChild(backdrop)
    if (modal.parentElement) document.body.removeChild(modal)
  }

  backdrop.onclick = dismiss
  document.body.appendChild(backdrop)
  document.body.appendChild(modal)

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      dismiss()
      window.removeEventListener('keydown', escHandler)
    }
  }
  window.addEventListener('keydown', escHandler)

  const optionsContainer = modal.querySelector('#event-options')
  event.options.forEach((opt) => {
    const btn = document.createElement('button')
    btn.className = 'hx-btn hx-focusable'
    const isReqMet = opt.req ? opt.req(app.game) : true

    btn.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
        <div style="text-align:left;">
          <div style="font-weight:bold; font-size:14px;">${opt.label}</div>
          <div style="font-size:12px; opacity:0.6;">${opt.desc}</div>
        </div>
        ${!isReqMet ? '<i data-lucide="lock" style="width:14px; opacity:0.5;"></i>' : ''}
      </div>
    `
    btn.disabled = !isReqMet
    btn.style.padding = '15px 20px'

    btn.onclick = () => {
      dismiss()
      window.removeEventListener('keydown', escHandler)
      opt.act(app.game)
      app.updateGameUI()
      Sounds.play('good')
    }
    optionsContainer.appendChild(btn)
  })

  refreshLucideIcons(modal)
}

export function startResearch(app, id) {
  if (!app.game) return
  app.game.currentResearch = id
  updateResearchModal(app)
  app.updateGameUI()
}
