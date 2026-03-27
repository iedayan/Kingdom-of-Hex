import { PLAYER_UNIT_TYPES } from '../game/constants.js'
import { installPlaytestTools, recordPlaytestRun } from '../game/playtestHistory.js'

export function initLaunchFeatures(app, deps) {
  const { fpsMonitor, KeyboardController } = deps
  const urlParams = new URLSearchParams(window.location.search)

  installPlaytestTools(window)

  if (urlParams.get('fps') === '1') fpsMonitor.start()
  if (urlParams.get('debug') === '1') {
    fpsMonitor.start()
    KeyboardController.enable()
  }

  setupEventBusListeners(app, deps)
  setupAnalytics(app, deps)
  setupWinLossTracking(app, deps)
  setupTutorial(app, deps)
  setupFeedback(app, deps)
}

export function setupEventBusListeners(app, deps) {
  const { EventBus, HexUtils, createEndGameScreen, END_GAME_SCREEN_DELAY_MS } = deps

  EventBus.on('notification', (data) => {
    app.showTurnNotification(data.text, data.duration || 2000)
  })

  EventBus.on('floatingText', (data) => {
    if (data.position === 'capital') {
      app.spawnFloatingText(data.text, { x: 0, y: 2, z: 0 }, data.color)
    } else if (data.position && app.unitManager) {
      const coords = typeof data.position === 'string' ? HexUtils.parse(data.position) : data.position
      const pos = app.unitManager.getWorldPosition(coords.q, coords.r, coords.s, 0)
      app.spawnFloatingText(data.text, pos, data.color)
    }
  })

  EventBus.on('cameraPan', (data) => {
    if (data.target) app.panToTile(data.target, 0.8)
  })

  EventBus.on('gameEnd', (data) => {
    setTimeout(() => createEndGameScreen(app, data.victory), END_GAME_SCREEN_DELAY_MS)
  })

  EventBus.on('screenShake', (data) => {
    triggerScreenShake(app, data.intensity || 0.5, data.duration || 300)
  })
}

export function triggerScreenShake(app, intensity = 0.5, duration = 300) {
  if (app.userSettings?.reducedMotion || !app.canvas) return
  const startTime = performance.now()
  const decay = intensity

  const shake = () => {
    const elapsed = performance.now() - startTime
    if (elapsed > duration) {
      app.canvas.style.transform = ''
      return
    }
    const remaining = 1 - (elapsed / duration)
    const x = (Math.random() - 0.5) * 2 * decay * remaining
    const y = (Math.random() - 0.5) * 2 * decay * remaining
    app.canvas.style.transform = `translate(${x}px, ${y}px)`
    requestAnimationFrame(shake)
  }
  requestAnimationFrame(shake)
}

export function setupTutorial(app, deps) {
  const { shouldShowTutorial, createTutorialModal } = deps
  if (!shouldShowTutorial()) return
  setTimeout(() => createTutorialModal(app), 1000)
}

export function setupFeedback(app, deps) {
  const { shouldShowFeedback, incrementFeedbackCount, createFeedbackModal } = deps
  if (!app.game) return

  const originalAfterTurn = app.game.onAfterTurn
  app.game.onAfterTurn = (turn) => {
    if (originalAfterTurn) originalAfterTurn(turn)
    if (turn === 10 && !app._feedbackShownAtTurn10) {
      app._feedbackShownAtTurn10 = true
      if (shouldShowFeedback()) {
        incrementFeedbackCount()
        createFeedbackModal(app)
      }
    }
  }
}

export function setupAnalytics(app, deps) {
  const { Analytics, EventBus } = deps
  if (!app.game) return

  window.Analytics = Analytics
  Analytics.trackGameStart(app.seed)

  EventBus.on('unitSpawned', (data) => {
    if (data.unit.owner === 'player' && PLAYER_UNIT_TYPES.includes(data.unit.type)) {
      Analytics.trackUnitTrained(data.unit.type, {})
    }
  })

  EventBus.on('gameEnd', (data) => {
    recordPlaytestRun(app.game, data)
    if (data.victory) Analytics.trackWin(data.resources.gold)
    else Analytics.trackLoss(data.reason)
  })
}

export function setupWinLossTracking(app, deps) {
  const { Analytics } = deps
  if (!app.game) return

  const originalAfterTurn = app.game.onAfterTurn
  app.game.onAfterTurn = (turn) => {
    if (originalAfterTurn) originalAfterTurn(turn)
    if (app.game.phase === 'playing') {
      Analytics.trackTurnEnd(
        app.game.resources,
        Array.from(app.game.objects.values()).filter((o) => o.owner === 'enemy').length
      )
    }
  }
}
