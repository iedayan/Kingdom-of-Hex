export function initPauseAndTutorialUI(app, deps) {
  const { Sounds } = deps
  const seedStr = () => String(app.seed ?? app.game?.seed ?? '')

  app.pauseOverlay = document.createElement('div')
  app.pauseOverlay.className = 'hx-pause-overlay'
  app.pauseOverlay.style.cssText = `
    display: none;
    position: fixed; inset: 0;
    z-index: var(--hx-z-overlay);
    background: rgba(10, 11, 16, 0.82);
    backdrop-filter: blur(10px) saturate(1.15);
    flex-direction: column; align-items: center; justify-content: center;
    gap: var(--hx-space-4);
    pointer-events: auto;
    text-align: center;
    padding: max(var(--hx-space-5), env(safe-area-inset-top, 0px)) var(--hx-space-4);
  `
  app.pauseOverlay.innerHTML = `
    <div class="hx-font-display" style="font-size: clamp(2rem, 6vw, 3rem); color: var(--hx-accent-gold); letter-spacing:0.14em;">
      PAUSED
    </div>
    <div class="hx-font-ui" id="hx-pause-seed" style="color: var(--hx-text-secondary); font-size: var(--hx-text-sm);">
      Seed: <b style="color: var(--hx-accent-gold)"></b>
    </div>
    <div style="display:flex; gap:12px; flex-wrap:wrap; justify-content:center;">
      <button class="hx-btn hx-btn--primary" id="hx-pause-resume">RESUME</button>
      <button class="hx-btn hx-btn--ghost" id="hx-pause-restart" style="border-color: rgba(255,255,255,0.14); color: var(--hx-danger);">RESTART</button>
      <button class="hx-btn hx-btn--ghost" id="hx-pause-restart-seed">RESTART SAME SEED</button>
      <button class="hx-btn hx-btn--ghost" id="hx-pause-new-seed">NEW RANDOM SEED</button>
    </div>
    <div class="hx-font-ui" style="color: var(--hx-text-muted); font-size: var(--hx-text-xs); max-width: 44rem; line-height: 1.6;">
      Tip: press <b>P</b> or <b>Esc</b> to resume. Your run seed is copyable for sharing/repro.
    </div>
  `
  document.body.appendChild(app.pauseOverlay)

  app.pauseOverlay.querySelector('#hx-pause-resume').onclick = () => app.togglePause(false)
  app.pauseOverlay.querySelector('#hx-pause-restart').onclick = () => {
    if (confirm('Restart run?')) location.reload()
  }
  app.pauseOverlay.querySelector('#hx-pause-restart-seed').onclick = () => {
    const s = seedStr()
    if (!s) return
    const url = new URL(window.location.href)
    url.searchParams.set('seed', s)
    window.location.href = url.toString()
  }
  app.pauseOverlay.querySelector('#hx-pause-new-seed').onclick = () => {
    const url = new URL(window.location.href)
    url.searchParams.delete('seed')
    window.location.href = url.toString()
  }
  app.pauseSeedEl = app.pauseOverlay.querySelector('#hx-pause-seed b')
  app.pauseOverlay.querySelector('#hx-pause-seed').onclick = async () => {
    const s = seedStr()
    if (!s) return
    await app._copyTextToClipboard(s)
    Sounds?.play?.('good', 1.0, 0.1, 0.6)
  }

  app.howToPlayOverlay = document.createElement('div')
  app.howToPlayOverlay.className = 'hx-howtoplay-overlay'
  app.howToPlayOverlay.style.cssText = `
    display: none;
    position: fixed; inset: 0;
    z-index: var(--hx-z-modal);
    background: rgba(10, 11, 16, 0.42);
    backdrop-filter: blur(6px);
    pointer-events: auto;
    align-items: center; justify-content: center;
    padding: var(--hx-space-6);
    text-align: center;
  `
  app.howToPlayOverlay.innerHTML = `
    <div class="hx-panel hx-panel--glass hx-corner-ticks" style="padding: var(--hx-space-6); max-width: 760px; width: 100%;">
      <div class="hx-font-display" style="color: var(--hx-accent-gold); font-size: 30px; letter-spacing:0.1em;">
        HOW TO PLAY
      </div>
      <div id="hx-htp-body" class="hx-font-ui" style="color: var(--hx-text-secondary); margin-top: var(--hx-space-3); line-height: 1.6; font-size: 16px;"></div>
      <div style="display:flex; gap:12px; flex-wrap:wrap; justify-content:center; margin-top: var(--hx-space-5);">
        <button class="hx-btn hx-btn--primary" id="hx-htp-got-it">GOT IT</button>
        <button class="hx-btn hx-btn--ghost" id="hx-htp-copy-seed" style="border-color: rgba(255,255,255,0.14);">COPY SEED</button>
      </div>
      <div class="hx-font-ui" style="color: var(--hx-text-faint); margin-top: var(--hx-space-2); font-size: 12px;">
        Seed lets you share the exact procedural world.
      </div>
    </div>
  `
  document.body.appendChild(app.howToPlayOverlay)
  app.howToPlayBodyEl = app.howToPlayOverlay.querySelector('#hx-htp-body')
  app.howToPlayOverlay.querySelector('#hx-htp-got-it').onclick = () => {
    app._howToPlayDismissed = true
    app.howToPlayOverlay.style.display = 'none'
  }
  app.howToPlayOverlay.querySelector('#hx-htp-copy-seed').onclick = async () => {
    const s = seedStr()
    if (!s) return
    await app._copyTextToClipboard(s)
    Sounds?.play?.('good', 1.0, 0.1, 0.6)
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      if (app._isKeyboardFocusForGame?.(e.target)) return
      app.togglePause()
    }
  })
}

export function togglePause(app, forcePaused = null) {
  const game = app.game
  if (!game || game.phase !== 'playing') return

  const next = typeof forcePaused === 'boolean' ? forcePaused : !app._paused
  if (next === app._paused) return
  app._paused = next

  if (app.pauseOverlay) {
    app.pauseSeedEl.textContent = String(app.seed ?? game.seed ?? '')
    app.pauseOverlay.style.display = next ? 'flex' : 'none'
  }
  if (app.actionBar) app.actionBar.style.pointerEvents = next ? 'none' : 'auto'
}

export function updateHowToPlayOverlay(app) {
  const game = app.game
  if (!game || !app.howToPlayOverlay || !app.howToPlayBodyEl) return

  if (app._paused || app._gameplayHudVisible === false) {
    app.howToPlayOverlay.style.display = 'none'
    return
  }

  if (app._howToPlayDismissed || game.phase !== 'playing' || game.turn > 3) {
    app.howToPlayOverlay.style.display = 'none'
    return
  }

  const playerObjs = Array.from(game.objects.values()).filter((o) => o?.owner === 'player')
  const buildingTypes = new Set(['lumberjack', 'farm', 'mine', 'market', 'tower', 'library'])
  const unitTypes = new Set(['scout', 'archer', 'knight'])
  const hasBuilding = playerObjs.some((o) => buildingTypes.has(o.type))
  const hasUnit = playerObjs.some((o) => unitTypes.has(o.type))
  const hasMoved = playerObjs.some((o) => o.movedThisTurn === true)
  const revealedCount = game?.revealed?.size ?? 0

  let stage = 'build'
  if (hasBuilding) stage = !hasUnit ? 'deploy' : !hasMoved ? 'move' : 'endturn'

  if (app._howToPlayStage !== stage) {
    app._howToPlayStage = stage
    app._howToPlayRevealedBaseline = null
  }

  if (stage === 'move' && typeof app._howToPlayRevealedBaseline !== 'number') {
    app._howToPlayRevealedBaseline = revealedCount
  }

  const exploredAfterBaseline =
    stage === 'move' &&
    typeof app._howToPlayRevealedBaseline === 'number' &&
    revealedCount > app._howToPlayRevealedBaseline

  let html = ''
  if (stage === 'build') {
    html = `
      <b>Step 1:</b> Place your first building.<br/>
      Start with <b>Lumber</b> or <b>Farm</b>. Green = valid tile, red = invalid.
    `
  } else if (stage === 'deploy') {
    html = `
      <b>Step 2:</b> Deploy a unit.<br/>
      Use unit buttons and place a <b>Scout</b> on grass. Press <b>Esc</b> to cancel selection.
    `
  } else if (stage === 'move' && !exploredAfterBaseline && !hasMoved) {
    html = `
      <b>Step 2:</b> Move a unit.<br/>
      Click your unit, then click a <b>reachable</b> tile (cyan rings) to move.
    `
  } else {
    html = `
      <b>Step 3:</b> Press <b>END TURN</b> to begin the raid phase.
    `
  }

  app.howToPlayBodyEl.innerHTML = html
  app.howToPlayOverlay.style.display = 'flex'
}
