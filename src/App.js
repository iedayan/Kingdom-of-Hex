import {
  Timer,
  OrthographicCamera,
  PerspectiveCamera,
  Vector2,
  Vector3,
  Scene,
  Plane,
  WebGPURenderer,
  PCFShadowMap,
} from 'three/webgpu'
import { OrbitControls, CSS2DRenderer } from 'three/examples/jsm/Addons.js'
import Stats from 'three/addons/libs/stats.module.js'
import WebGPU from 'three/examples/jsm/capabilities/WebGPU.js'
import { Pointer } from './core/input/Pointer.js'
import { GUIManager } from './GUI.js'
import { HexMap } from './hexmap/HexMap.js'
import { Lighting } from './Lighting.js'
import { PostFX } from './PostFX.js'
import { WavesMask } from './hexmap/effects/WavesMask.js'
import { setSeed } from './SeededRandom.js'
import { parseRunConfig, GameSession } from './game/index.js'
import { UnitManager } from './game/UnitManager.js'
import { saveManager, META_UPGRADES } from './game/SaveManager.js'
import { RUN_MODIFIERS } from './game/runContent.js'
import { Sounds } from './core/audio/Sounds.js'
import { LEVELS_COUNT } from './hexmap/HexTileData.js'
import { globalToLocalGrid } from './hexmap/HexWFCCore.js'
import { GameHud } from './ui/hud/GameHud.js'
import { refreshLucideIcons } from './core/ui/icons.js'
import { setStatus, setStatusAsync, log } from './core/logging/gameConsole.js'
import { HexUtils } from './game/HexUtils.js'
import { HexBorders } from './hexmap/effects/HexBorders.js'
import gsap from 'gsap'
import { Analytics } from './core/analytics/Analytics.js'
import { ErrorHandler } from './core/errors/ErrorHandler.js'
import { KeyboardController } from './core/input/KeyboardController.js'
import { MobileController } from './core/input/MobileController.js'
import { fpsMonitor } from './core/performance/FPSMonitor.js'
import { createTutorialModal, shouldShowTutorial } from './ui/screens/Tutorial.js'
import { createFeedbackModal, shouldShowFeedback, incrementFeedbackCount } from './ui/screens/Feedback.js'
import { createEndGameScreen } from './ui/screens/EndGameScreen.js'
import { EventBus } from './core/events/EventBus.js'
import { Minimap } from './ui/hud/Minimap.js'
import { KillFeed } from './ui/hud/KillFeed.js'
import { EnemyIntentSystem } from './ui/hud/EnemyIntent.js'
import {
  initLaunchFeatures,
  setupEventBusListeners,
  setupTutorial,
  setupFeedback,
  setupAnalytics,
  setupWinLossTracking,
  triggerScreenShake,
} from './app/AppLaunchFeatures.js'
import {
  loadUserSettings,
  saveUserSettings,
  applyUserSettings,
  setUserSetting,
  initSettingsModal,
  renderSettingsModal,
  toggleSettingsModal,
} from './app/AppUserSettings.js'
import {
  initPalaceUI,
  resumeGame,
  rebuildVisualsFromSave,
  buyMeta,
  applyMetaToGame,
} from './app/AppPalaceUI.js'
import {
  initPauseAndTutorialUI,
  togglePause,
  updateHowToPlayOverlay,
} from './app/AppPauseTutorialUI.js'
import { initSystemMenu } from './app/AppSystemMenu.js'
import {
  toggleResearchModal,
  updateResearchModal,
  showEventModal,
  startResearch,
} from './app/AppResearchAndEventModals.js'
import {
  exportPNG,
  fadeIn,
  panToTile,
  showTurnNotification,
  spawnFloatingText,
} from './app/AppRenderHelpers.js'

export { setStatus, setStatusAsync, log }

const END_GAME_SCREEN_DELAY_MS = 500

export class App {
  static instance = null

  constructor(canvas) {
    this.canvas = canvas
    this.renderer = null
    this.orthoCamera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 1000)
    this.perspCamera = new PerspectiveCamera(30, 1, 1, 1000)
    this.camera = this.perspCamera
    this.controls = null
    this.postFX = null
    this.scene = new Scene()
    this.pointerHandler = null
    this.timer = new Timer()
    // Module instances
    this.gui = null
    this.city = null
    this.lighting = null
    this.params = null
    this.cssRenderer = null
    this.buildMode = false
    /** @type {GameSession | null} */
    this.game = null
    this._paused = false
    this.pauseOverlay = null
    this.howToPlayOverlay = null
    this._howToPlayDismissed = false
    // Tutorial heuristics
    this._howToPlayRevealedBaseline = null
    this._howToPlayStage = null
    this.selectedRunModifier = RUN_MODIFIERS[0]?.id || null
    this.userSettings = loadUserSettings()
    this.settingsModal = null

    ErrorHandler.init()
    KeyboardController.init(this)
    MobileController.init(this)

    if (App.instance != null) {
      throw new Error('App instance already exists')
    }
    App.instance = this
    window.app = this
  }

  async init() {
    if (WebGPU.isAvailable() === false) {
      const overlay = document.createElement('div')
      overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0a0b10;color:#fff;flex-direction:column;gap:16px;z-index:9999;font-family:sans-serif;text-align:center;padding:32px;'
      overlay.innerHTML = `<div style="font-size:2rem;font-weight:700;color:#d4a574;letter-spacing:0.1em;">WebGPU Required</div><div style="color:#8a9bb0;font-size:1rem;max-width:480px;line-height:1.6;">Kingdom of Hex needs a WebGPU-capable browser.<br>Please open in <b>Chrome 113+</b>, <b>Edge 113+</b>, or another browser with WebGPU support.</div>`
      document.body.appendChild(overlay)
      return
    }

    const runConfig = parseRunConfig()
    const seed = runConfig.seed !== null ? runConfig.seed : Math.floor(Math.random() * 100000)
    setSeed(seed)
    this.seed = seed
    
    this.renderer = new WebGPURenderer({ canvas: this.canvas, antialias: true })
    await this.renderer.init()
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    const initialSize = this._getViewportSize()
    this.renderer.setSize(initialSize.width, initialSize.height)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFShadowMap

    window.addEventListener('resize', this.onResize.bind(this))
    document.addEventListener('fullscreenchange', this._onFullscreenChange.bind(this))
    this.params = structuredClone(GUIManager.defaultParams)
    this.applyUserSettings()

    this.initCamera()
    this.initPostProcessing()
    this.initStats()
    this.initCSSRenderer()
    this.initStatusOverlay()
    this.initSystemMenu()
    this.initPauseAndTutorialUI()
    this.initPalaceUI()
    this._initLaunchFeatures()

    this.onResize()
    this.pointerHandler = new Pointer(this.renderer, this.camera, new Plane(new Vector3(0, 1, 0), 0))

    // Initialize modules
    this.lighting = new Lighting(this.scene, this.renderer, this.params)
    this.city = new HexMap(this.scene, this.params)
    this.city.coastMaskTexture = this.wavesMask.texture
    this.city.coveMaskTexture = this.wavesMask.coveTexture

    await this.lighting.init()
    await this.city.init()
    await this.city.ensureStartingGridPopulated({ animate: false })

    this.borders = new HexBorders(this.scene)
    this.game = new GameSession({ seed, app: this })
    
    // Auto-save session after each turn
    this.game.onAfterTurn = (turn) => {
      saveManager.saveSession(this.game.serialize())
    }

    this.unitManager = new UnitManager(this.scene, this.city)
    this.game.onUnitSpawned = (cKey, unit) => this.unitManager.spawnUnit(cKey, unit.type, unit.owner)
    this.game.onUnitMoved = (from, to, unit) => this.unitManager.moveUnit(from, to)
    this.game.onUnitRemoved = (cKey) => this.unitManager.removeUnit(cKey)
    this.game.onObjectRemoved = (cKey, obj) => {
      if (!obj || !this.city) return
      const buildingTypes = new Set(['lumberjack', 'farm', 'mine', 'market', 'tower', 'library'])
      if (!buildingTypes.has(obj.type)) return
      const cell = this.city.globalCells.get(cKey)
      if (!cell?.gridKey) return
      const grid = this.city.grids.get(cell.gridKey)
      if (!grid?.decorations || !grid.globalCenterCube) return
      const { gridX, gridZ } = globalToLocalGrid(
        { q: cell.q, r: cell.r, s: cell.s },
        grid.globalCenterCube,
        grid.gridRadius,
      )
      grid.decorations.clearDecorationsAt(gridX, gridZ)
    }

    this.gameHud = new GameHud(this)
    this.game.onUpdateUI = () => this.gameHud.updateGameUI()
    this.gameHud.mount()
    
    this.minimap = new Minimap(this)
    this.minimap.mount()
    
    this.killFeed = new KillFeed()
    this.killFeed.mount()
    
    this.enemyIntent = new EnemyIntentSystem(this)
    this.enemyIntent.mount()
    
    // Default gameplay HUD to hidden until player clicks BEGIN.
    // If the palace gate was dismissed early (before HUD elements mounted),
    // don't override the already-visible state.
    if (this._gameplayHudVisible !== true) this._setGameplayHudVisible(false)
    this.gameHud.updateGameUI()

    if (typeof globalThis !== 'undefined') {
      globalThis.gameSession = this.game
    }

    // Water mask logic
    this._savedMats = new Map()
    this.postFX.onWaterMaskRender = (enabled) => {
      if (enabled) {
        const maskMat = this.city.waterMaskMaterial
        for (const grid of this.city.grids.values()) {
          if (grid.hexMesh) { this._savedMats.set(grid.hexMesh, grid.hexMesh.material); grid.hexMesh.material = maskMat; }
          if (grid.decorations?.mesh) { this._savedMats.set(grid.decorations.mesh, grid.decorations.mesh.material); grid.decorations.mesh.material = maskMat; }
        }
      } else {
        for (const [mesh, mat] of this._savedMats) mesh.material = mat
        this._savedMats.clear()
      }
    }

    this.city.onBeforeTilesChanged = () => {
      if (this.city._autoBuilding) return
      const opacity = this.city._waveOpacity
      if (!opacity || opacity.value === 0) return
      gsap.to(this.city._waveOpacity, { value: 0, duration: 0.5 })
    }

    this.city.onTilesChanged = (animDonePromise) => {
      if (this.city._autoBuilding) return
      const promise = animDonePromise || Promise.resolve()
      promise.then(() => {
        const tileMeshes = []
        for (const grid of this.city.grids.values()) if (grid.hexMesh) tileMeshes.push(grid.hexMesh)
        this.wavesMask.render(this.scene, tileMeshes, this.city.waterPlane, this.city.globalCells)
        gsap.to(this.city._waveOpacity, { value: this.params.waves.opacity, duration: 2, delay: 1 })
      })
    }

    this.pointerHandler.setRaycastTargets([], {
      onHover: (intersection) => { if (this._paused) return; this.city.onHover(intersection) },
      onPointerDown: (intersection, clientX, clientY) => {
        if (this._paused) return false
        const pointer = this._toCanvasPointer(clientX, clientY)
        return this.city.onPointerDown(pointer, this.camera)
      },
      onPointerUp: (isTouch, touchIntersection) => { if (this._paused) return; this.city.onPointerUp(isTouch, touchIntersection) },
      onPointerMove: (clientX, clientY) => {
        if (this._paused) return
        const pointer = this._toCanvasPointer(clientX, clientY)
        this.city.onPointerMove(pointer, this.camera)
      },
      onRightClick: (intersection) => { if (this._paused) return; this.city.onRightClick(intersection) },
    })

    this.gui = new GUIManager(this)
    this.gui.init()
    this.gui.gui.domElement.classList.add('gui-hidden')
    this.gui.applyParams()

    this.timer.connect(document)
    Sounds.playMusic('intro', 0.3)
    const loop = (currentTime) => {
      requestAnimationFrame(loop)
      this.animate()
    }
    requestAnimationFrame(loop)
  }

  _initLaunchFeatures() {
    initLaunchFeatures(this, {
      fpsMonitor,
      KeyboardController,
      EventBus,
      HexUtils,
      Analytics,
      createEndGameScreen,
      shouldShowTutorial,
      createTutorialModal,
      shouldShowFeedback,
      incrementFeedbackCount,
      createFeedbackModal,
      END_GAME_SCREEN_DELAY_MS,
    })
  }

  _setupEventBusListeners() {
    setupEventBusListeners(this, {
      EventBus,
      HexUtils,
      createEndGameScreen,
      END_GAME_SCREEN_DELAY_MS,
    })
  }

  _triggerScreenShake(intensity = 0.5, duration = 300) {
    triggerScreenShake(this, intensity, duration)
  }

  _setupTutorial() {
    setupTutorial(this, { shouldShowTutorial, createTutorialModal })
  }

  _setupFeedback() {
    setupFeedback(this, { shouldShowFeedback, incrementFeedbackCount, createFeedbackModal })
  }

  _setupAnalytics() {
    setupAnalytics(this, { Analytics, EventBus })
  }

  _setupWinLossTracking() {
    setupWinLossTracking(this, { Analytics })
  }

  onCanvasTap(x, y) {
    if (this.city) {
      const rect = this.canvas.getBoundingClientRect()
      const pointer = new Vector2(
        ((x - rect.left) / rect.width) * 2 - 1,
        -((y - rect.top) / rect.height) * 2 + 1
      )
      this.city.onPointerDown(pointer, this.camera)
    }
  }

  initCamera() {
    this.perspCamera.position.set(0, 100, 58.5)
    this.perspCamera.fov = 20
    this.controls = new OrbitControls(this.camera, this.canvas)
    this.controls.enableDamping = true
    this.controls.mouseButtons = { LEFT: 2, MIDDLE: 1, RIGHT: 0 }
    this.controls.touches = { ONE: 0, TWO: 2 }
    this.controls.minDistance = 25
    this.controls.maxDistance = 410
    this.controls.maxPolarAngle = 1.424
    this.controls.target.set(0, 1, 0)
    this.controls.update()
    this.initWasdPan()
  }

  /** True when focus is in a field that should receive keystrokes (skip WASD). */
  _isKeyboardFocusForGame(el) {
    if (!el || typeof el !== 'object') return false
    const tag = el.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
    if (el.isContentEditable) return true
    return Boolean(el.closest?.('[contenteditable="true"]'))
  }

  initWasdPan() {
    this._wasdKeys = { w: false, a: false, s: false, d: false }
    this._wasdPanSpeed = 60
    this._wasdMove = new Vector3()
    this._wasdForward = new Vector3()
    this._wasdRight = new Vector3()
    this._wasdWorldUp = new Vector3(0, 1, 0)

    const setKey = (code, down) => {
      const map = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd' }
      const k = map[code]
      if (k) this._wasdKeys[k] = down
    }

    window.addEventListener('keydown', (e) => {
      if (this._isKeyboardFocusForGame(e.target)) return
      if (e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD') {
        e.preventDefault()
        setKey(e.code, true)
      }
    })
    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD') {
        setKey(e.code, false)
      }
    })
    window.addEventListener('blur', () => {
      this._wasdKeys.w = this._wasdKeys.a = this._wasdKeys.s = this._wasdKeys.d = false
    })
  }

  /** Pan camera + orbit target on XZ along view heading (after OrbitControls.update). */
  applyWasdPan(dt) {
    if (!this.controls || !this._wasdKeys) return
    const k = this._wasdKeys
    if (!k.w && !k.a && !k.s && !k.d) return

    const speed = this._wasdPanSpeed * dt
    const forward = this._wasdForward
    const right = this._wasdRight
    const move = this._wasdMove

    this.camera.getWorldDirection(forward)
    forward.y = 0
    if (forward.lengthSq() < 1e-10) return
    forward.normalize()

    right.crossVectors(forward, this._wasdWorldUp).normalize()

    move.set(0, 0, 0)
    if (k.w) move.add(forward)
    if (k.s) move.sub(forward)
    if (k.a) move.sub(right)
    if (k.d) move.add(right)
    if (move.lengthSq() < 1e-10) return
    move.normalize().multiplyScalar(speed)

    this.camera.position.add(move)
    this.controls.target.add(move)
  }

  initPostProcessing() {
    this.postFX = new PostFX(this.renderer, this.scene, this.camera)
    this.postFX.fadeOpacity.value = 0
    this.wavesMask = new WavesMask(this.renderer)

    const p = this.postFX
    this.aoEnabled = p.aoEnabled
    this.aoPass = p.aoPass
    this.aoDenoiseRadius = p.aoDenoiseRadius
    this.vignetteEnabled = p.vignetteEnabled
    this.dofEnabled = p.dofEnabled
    this.dofFocus = p.dofFocus
    this.dofFocalLength = p.dofFocalLength
    this.dofBokehScale = p.dofBokehScale
    this.grainEnabled = p.grainEnabled
    this.grainStrength = p.grainStrength
    this.grainTime = p.grainTime
    this.grainFPS = p.grainFPS
    if (this.grainFPS) this.grainFPS.value = this.params.fx.grainFPS
    this.debugView = p.debugView
  }

  initStats() {
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('debug') !== '1') return
    this.stats = new Stats()
    this.stats.showPanel(0)
    this.stats.dom.style.position = 'fixed'
    this.stats.dom.style.bottom = '10px'
    this.stats.dom.style.left = '10px'
    this.stats.dom.style.zIndex = '2000'
    document.body.appendChild(this.stats.dom)
  }

  initCSSRenderer() {
    this.cssRenderer = new CSS2DRenderer()
    this.cssRenderer.setSize(window.innerWidth, window.innerHeight)
    this.cssRenderer.domElement.style.position = 'absolute'
    this.cssRenderer.domElement.style.top = '0'
    this.cssRenderer.domElement.style.left = '0'
    this.cssRenderer.domElement.style.pointerEvents = 'none'
    document.body.appendChild(this.cssRenderer.domElement)
  }

  initStatusOverlay() {
    this.statusElement = document.getElementById('status-text')
    this.seedElement = { textContent: '' }
  }

  initPalaceUI() {
    initPalaceUI(this, { saveManager, META_UPGRADES, RUN_MODIFIERS, gsap })
  }

  resumeGame() {
    resumeGame(this, { saveManager, gsap })
  }

  rebuildVisualsFromSave() {
    rebuildVisualsFromSave(this, { globalToLocalGrid, HexUtils })
  }

  /** Show or hide main gameplay HUD (hidden during chronicle gate / palace). */
  _setGameplayHudVisible(visible) {
    this._gameplayHudVisible = visible
    const disp = visible ? '' : 'none'
    if (this.hudTop) this.hudTop.style.display = disp
    if (this.actionBar) this.actionBar.style.display = disp
    this.gameHud?.syncActionHelpBanner()
  }

  updateGameUI() {
    if (this.borders && this.game) {
      this.borders.update(this.game.ownedTiles, this.city.globalCells)
    }
    this.gameHud?.updateGameUI()
    this._updateHowToPlayOverlay?.()
  }

  buyMeta(id, cost) {
    buyMeta(this, id, cost, { saveManager, Sounds })
  }

  applyMetaToGame() {
    applyMetaToGame(this, { saveManager })
  }

  initSystemMenu() {
    initSystemMenu(this, { Sounds })
  }

  _loadUserSettings() {
    return loadUserSettings()
  }

  _saveUserSettings() {
    saveUserSettings(this.userSettings)
  }

  applyUserSettings() {
    applyUserSettings(this, { Sounds, fpsMonitor })
  }

  setUserSetting(key, value) {
    setUserSetting(this, key, value, { Sounds, fpsMonitor })
  }

  _initSettingsModal() {
    initSettingsModal(this, { Sounds, fpsMonitor })
  }

  _renderSettingsModal() {
    renderSettingsModal(this, { Sounds, fpsMonitor })
  }

  toggleSettingsModal(forceOpen = null) {
    toggleSettingsModal(this, forceOpen, { Sounds, fpsMonitor })
  }

  async _copyTextToClipboard(text) {
    if (typeof navigator === 'undefined') return false
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return true
      }
    } catch (e) {}
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch (e2) {
      return false
    }
  }

  initPauseAndTutorialUI() {
    initPauseAndTutorialUI(this, { Sounds })
  }

  togglePause(forcePaused = null) {
    togglePause(this, forcePaused)
  }

  _updateHowToPlayOverlay() {
    updateHowToPlayOverlay(this)
  }

  onResize() {
    const { width, height } = this._getViewportSize()
    this.renderer.setSize(width, height)
    this.updatePerspFrustum()
    if (this.postFX) this.postFX.resize()
    if (this.cssRenderer) this.cssRenderer.setSize(width, height)
  }

  _getViewportSize() {
    const rect = this.canvas?.getBoundingClientRect?.()
    const width = Math.max(1, Math.floor(rect?.width || window.innerWidth || 1))
    const height = Math.max(1, Math.floor(rect?.height || window.innerHeight || 1))
    return { width, height }
  }

  _toCanvasPointer(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect()
    const x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1
    const y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
    return new Vector2(x, y)
  }

  _onFullscreenChange() {
    // Fullscreen transitions can race with layout updates in embeds.
    requestAnimationFrame(() => this.onResize())
    requestAnimationFrame(() => this.onResize())
  }

  updatePerspFrustum() {
    const { width, height } = this._getViewportSize()
    this.perspCamera.aspect = width / height
    this.perspCamera.updateProjectionMatrix()
  }

  animate() {
    if (this.stats) this.stats.begin()
    this.timer.update()
    const dt = this.timer.getDelta()
    if (!this._paused) {
      if (this.controls) {
        this.controls.update()
        this.applyWasdPan(dt)
      }
      if (this.lighting && this.controls) {
        this.lighting.updateShadowCamera(this.controls.target, this.camera, this.orthoCamera, this.perspCamera)
      }
      if (this.city) this.city.update(dt)
      if (this.game) this.game.update(dt)
      if (this.postFX && this.city) {
        const mask = []; for(const g of this.city.grids.values()){ if(g.hexMesh) mask.push(g.hexMesh); if(g.decorations?.mesh) mask.push(g.decorations.mesh); }
        this.postFX.setWaterMaskObjects(mask); this.postFX.setOverlayObjects(this.city.getOverlayObjects()); this.postFX.setWaterObjects(this.city.getWaterObjects());
        this.postFX.render()
      }
    }
    if (this.cssRenderer) this.cssRenderer.render(this.scene, this.camera)
    if (this.stats) this.stats.end()
  }

  async exportPNG(opts = {}) {
    return exportPNG(this, opts)
  }

  fadeIn(durationMs = 1000) {
    fadeIn(this, durationMs, { gsap })
  }

  panToTile(cKey, duration = 0.8) {
    panToTile(this, cKey, duration, { HexUtils, gsap })
  }

  showTurnNotification(text, duration = 2000) {
    showTurnNotification(this, text, duration, { gsap })
  }

  spawnFloatingText(text, worldPos, color = '#fff') {
    spawnFloatingText(this, text, worldPos, color, { gsap })
  }

  toggleResearchModal() {
    toggleResearchModal(this)
  }

  updateResearchModal() {
    updateResearchModal(this)
  }

  showEventModal(event) {
    showEventModal(this, event, { Sounds, refreshLucideIcons })
  }

  startResearch(id) {
    startResearch(this, id)
  }

  selectBuildingType(type) {
    if (this.gameHud) this.gameHud.selectAction('building', type)
  }

  selectUnitType(type) {
    if (this.gameHud) this.gameHud.selectAction('unit', type)
  }

  selectUnit(key) {
    if (this.unitManager) this.unitManager.selectUnit(key)
  }

  clearSelections() {
    this.selectedBuilding = null
    this.selectedUnitType = null

    if (this.gameHud) {
      this.gameHud.selectedBuilding = null
      this.gameHud.selectedUnitType = null
      for (const btn of Object.values(this.buildButtons || {})) btn.style.background = 'transparent'
      for (const btn of Object.values(this.unitButtons || {})) btn.style.background = 'transparent'
      this.gameHud.syncActionHelpBanner()
      this.gameHud.setContextHint('')
    }

    const interaction = this.city?.interaction
    if (interaction) {
      interaction.selectedUnitKey = null
      interaction.clearMovePreview?.()
    }
    this.unitManager?.selectUnit?.(null)
  }
}
