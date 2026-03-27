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
import { Pointer } from './lib/Pointer.js'
import { GUIManager } from './GUI.js'
import { HexMap } from './hexmap/HexMap.js'
import { Lighting } from './Lighting.js'
import { PostFX } from './PostFX.js'
import { WavesMask } from './hexmap/effects/WavesMask.js'
import { setSeed, randomSeed } from './SeededRandom.js'
import { rebuildNoiseTables } from './hexmap/Decorations.js'
import { LEVELS_COUNT } from './hexmap/HexTileData.js'
import {
  KingdomDirector,
  KINGDOM_IDENTITIES,
  THREAT_PROFILES,
  parseKingdomConfig,
} from './game/KingdomDirector.js'
import gsap from 'gsap'

// Global status update function
export function setStatus(text) {
  if (App.instance?.statusElement) {
    App.instance.statusElement.textContent = text
  }
}

// Set status and yield to browser so the paint is visible
export function setStatusAsync(text) {
  setStatus(text)
  return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
}

// Log to both console and status bar
export function log(text, style = '') {
  if (style) {
    console.log(`%c${text}`, style)
  } else {
    console.log(text)
  }
  setStatus(text, style)
}

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
    this.cssRenderer = null  // CSS2DRenderer for debug labels
    this.buildMode = false  // false = Move (camera only), true = Build (click to WFC)
    this.currentSeed = null
    this.kingdom = null
    this.selectedRealmId = null
    this.selectedThreatId = null
    this._buildAllOrder = [
      [0,0],[0,-1],[1,-1],[1,0],[0,1],[-1,0],[-1,-1],[-1,-2],[0,-2],[1,-2],[2,-1],[2,0],[2,1],[1,1],[0,2],[-1,1],[-2,1],[-2,0],[-2,-1]
    ]

    if (App.instance != null) {
      console.warn('App instance already exists')
      return null
    }
    App.instance = this
    window.app = this  // Expose for console debugging
  }

  async init() {
    if (WebGPU.isAvailable() === false) {
      return
    }

    const runConfig = parseKingdomConfig(window.location.search)
    const seed = runConfig.seed ?? randomSeed()
    this.currentSeed = seed
    setSeed(seed)
    rebuildNoiseTables()
    this.kingdom = new KingdomDirector({
      seed,
      realmId: runConfig.realmId,
      threatId: runConfig.threatId,
    })
    this.selectedRealmId = this.kingdom.realm.id
    this.selectedThreatId = this.kingdom.threat.id
    console.log(`%c[SEED] ${seed}`, 'color: black')
    console.log(`%c[LEVELS] ${LEVELS_COUNT}`, 'color: black')
    this.renderer = new WebGPURenderer({ canvas: this.canvas, antialias: true })
    await this.renderer.init()
    // DPR 2 with half-res AO gives good quality/perf balance
    this.renderer.setPixelRatio(2)
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFShadowMap

    window.addEventListener('resize', this.onResize.bind(this))

    // Initialize params from defaults before creating modules
    this.params = JSON.parse(JSON.stringify(GUIManager.defaultParams))

    this.initCamera()
    this.initPostProcessing()
    this.initStats()
    this.initCSSRenderer()
    this.initStatusOverlay()
    this.initModeButtons()

    this.seedElement.textContent = `${seed}`

    this.onResize()
    this.pointerHandler = new Pointer(
      this.renderer,
      this.camera,
      new Plane(new Vector3(0, 1, 0), 0)
    )

    // Initialize modules
    this.lighting = new Lighting(this.scene, this.renderer, this.params)
    this.city = new HexMap(this.scene, this.params)
    // Pass coast mask RT texture so water shader can sample it directly
    this.city.coastMaskTexture = this.wavesMask.texture
    this.city.coveMaskTexture = this.wavesMask.coveTexture

    await this.lighting.init()
    await this.city.init()
    this.city.setCampaignHooks({
      getSolveOptions: (context) => this.kingdom?.getSolveOptions(context),
      afterGridPopulated: (payload) => { void this.onKingdomAction('expand', payload) },
      afterRegionRebuilt: (payload) => {
        if (payload.source === 'player') {
          void this.onKingdomAction('rebuild', payload)
          return
        }
        this.kingdom?.syncWorld(payload.summary)
        this.renderKingdomState()
      },
    })
    this.kingdom.syncWorld(this.city.getKingdomSummary())
    this.renderKingdomState()
    this.updateShareUrl()

    // Water mask: swap tile materials to unlit B&W mask material for mask RT render
    this._savedMats = new Map()
    this.postFX.onWaterMaskRender = (enabled) => {
      if (enabled) {
        const maskMat = this.city.waterMaskMaterial
        for (const grid of this.city.grids.values()) {
          if (grid.hexMesh) {
            this._savedMats.set(grid.hexMesh, grid.hexMesh.material)
            grid.hexMesh.material = maskMat
          }
          if (grid.decorations?.mesh) {
            this._savedMats.set(grid.decorations.mesh, grid.decorations.mesh.material)
            grid.decorations.mesh.material = maskMat
          }
        }
      } else {
        for (const [mesh, mat] of this._savedMats) mesh.material = mat
        this._savedMats.clear()
      }
    }

    // Shared tween target for wave uniforms — gsap.to overwrites previous tweens automatically
    this._waveFade = { opacity: 0, gradOpacity: 0, mask: 0 }

    // Fade out waves immediately when a new grid starts building
    this.city.onBeforeTilesChanged = () => {
      if (this.city._autoBuilding) return
      const opacity = this.city._waveOpacity
      if (!opacity || opacity.value === 0) return

      // Cancel any pending mask render from a previous build
      if (this._pendingMaskRender) {
        this._pendingMaskRender.cancelled = true
        this._pendingMaskRender = null
      }

      // Kill any running wave tweens and sync target with current uniforms
      gsap.killTweensOf(this._waveFade)
      this._waveFade.opacity = opacity.value
      this._waveFade.gradOpacity = this.city._waveGradientOpacity?.value ?? 0
      this._waveFade.mask = this.city._waveMaskStrength?.value ?? 1

      gsap.to(this._waveFade, {
        opacity: 0, gradOpacity: 0, mask: 0,
        duration: 0.5,
        onUpdate: () => {
          opacity.value = this._waveFade.opacity
          if (this.city._waveGradientOpacity) this.city._waveGradientOpacity.value = this._waveFade.gradOpacity
          if (this.city._waveMaskStrength) this.city._waveMaskStrength.value = this._waveFade.mask
        },
      })
    }

    // After tiles drop, re-render mask and fade waves back in
    this._pendingMaskRender = null
    this.city.onTilesChanged = (animDonePromise) => {
      if (this.city._autoBuilding) return
      const opacity = this.city._waveOpacity
      if (!opacity) return

      // Kill previous pending mask render (e.g. during rapid sequential builds)
      if (this._pendingMaskRender) {
        this._pendingMaskRender.cancelled = true
        this._pendingMaskRender = null
      }

      const token = { cancelled: false }
      this._pendingMaskRender = token

      const renderMask = () => {
        if (token.cancelled) return

        // Kill any running wave tweens, snap to 0, render mask, fade back up
        gsap.killTweensOf(this._waveFade)
        opacity.value = 0
        if (this.city._waveGradientOpacity) this.city._waveGradientOpacity.value = 0
        if (this.city._waveMaskStrength) this.city._waveMaskStrength.value = 0
        this._waveFade.opacity = 0
        this._waveFade.gradOpacity = 0
        this._waveFade.mask = 0

        const tileMeshes = []
        for (const grid of this.city.grids.values()) {
          if (grid.hexMesh) tileMeshes.push(grid.hexMesh)
        }
        this.wavesMask.render(this.scene, tileMeshes, this.city.waterPlane, this.city.globalCells)

        gsap.to(this._waveFade, {
          opacity: this.params.waves.opacity,
          gradOpacity: this.params.waves.gradientOpacity,
          mask: 1,
          duration: 2, delay: 1,
          onUpdate: () => {
            opacity.value = this._waveFade.opacity
            if (this.city._waveGradientOpacity) this.city._waveGradientOpacity.value = this._waveFade.gradOpacity
            if (this.city._waveMaskStrength) this.city._waveMaskStrength.value = this._waveFade.mask
          },
        })
      }

      // Wait for drop animation to finish, then render mask
      const promise = animDonePromise || Promise.resolve()
      promise.then(renderMask)
    }

    // Set up hover and click detection on hex tiles and placeholders
    this.pointerHandler.setRaycastTargets(
      [],  // Dynamic targets - we'll handle raycasting in callbacks
      {
        onHover: (intersection) => this.city.onHover(intersection),
        onPointerDown: (intersection, clientX, clientY, isTouch) => {
          // Convert client coords to normalized device coordinates
          const pointer = new Vector2(
            (clientX / window.innerWidth) * 2 - 1,
            -(clientY / window.innerHeight) * 2 + 1
          )
          // Check placeholders
          if (this.city.onPointerDown(pointer, this.camera)) {
            return true  // Placeholder was clicked
          }
          return false
        },
        onPointerUp: (isTouch, touchIntersection) => this.city.onPointerUp(isTouch, touchIntersection),
        onPointerMove: (clientX, clientY) => {
          // Convert client coords to normalized device coordinates
          const pointer = new Vector2(
            (clientX / window.innerWidth) * 2 - 1,
            -(clientY / window.innerHeight) * 2 + 1
          )
          // Update placeholder hover state
          this.city.onPointerMove(pointer, this.camera)
        },
        onRightClick: (intersection) => this.city.onRightClick(intersection)
      }
    )

    // Initialize GUI after modules are ready
    this.gui = new GUIManager(this)
    this.gui.init()
    this.gui.gui.domElement.classList.add('gui-hidden')
    this.gui.applyParams()

    // Move FPS meter into GUI panel, above DPR
    this.stats.dom.style.display = ''
    this.stats.dom.style.position = 'relative'
    this.stats.dom.style.top = ''
    this.stats.dom.style.left = '106px'
    const guiChildren = this.gui.gui.domElement.querySelector('.children')
    const dprEl = guiChildren?.firstElementChild
    if (dprEl) guiChildren.insertBefore(this.stats.dom, dprEl)
    else this.gui.gui.domElement.prepend(this.stats.dom)

    // Pre-render full pipeline to compile GPU shaders while screen is still black
    // BatchedMeshes already have a dummy instance from initMeshes()
    const tileMeshes = []
    for (const grid of this.city.grids.values()) {
      if (grid.hexMesh) tileMeshes.push(grid.hexMesh)
    }
    this.wavesMask.render(this.scene, tileMeshes, this.city.waterPlane, this.city.globalCells)
    this.postFX.setOverlayObjects(this.city.getOverlayObjects())

    this.postFX.setWaterObjects(this.city.getWaterObjects())
    this.postFX.render()

    this.timer.connect(document)

    // Frame rate limiting with drift compensation
    const targetFPS = 60
    const frameInterval = 1000 / targetFPS
    let lastFrameTime = 0

    const loop = (currentTime) => {
      requestAnimationFrame(loop)
      const delta = currentTime - lastFrameTime
      if (delta >= frameInterval) {
        lastFrameTime = currentTime - (delta % frameInterval)
        this.animate()
      }
    }
    requestAnimationFrame(loop)
  }

  initCamera() {
    // Isometric camera setup
    const isoAngle = Math.PI / 4 // 45 degrees
    const isoDist = 150

    const camPos = new Vector3(
      Math.cos(isoAngle) * isoDist,
      isoDist * 0.8,
      Math.sin(isoAngle) * isoDist
    )

    // Set up orthographic camera
    this.orthoCamera.position.copy(camPos)
    this.updateOrthoFrustum()

    // Set up perspective camera - top-down view of hex map
    this.perspCamera.position.set(0, 100, 58.5)
    this.perspCamera.fov = 20
    this.updatePerspFrustum()

    this.controls = new OrbitControls(this.camera, this.canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.1
    this.controls.enableRotate = true
    // Swap mouse buttons: left=pan, right=rotate (like Townscaper)
    this.controls.mouseButtons = {
      LEFT: 2,  // PAN
      MIDDLE: 1, // DOLLY
      RIGHT: 0   // ROTATE
    }
    // Touch: 1 finger=rotate, 2 fingers=pan+zoom (OrbitControls default)
    // TOUCH constants: ROTATE=0, PAN=1, DOLLY_PAN=2, DOLLY_ROTATE=3
    this.controls.touches = {
      ONE: 0,  // TOUCH.ROTATE
      TWO: 2   // TOUCH.DOLLY_PAN
    }
    // Zoom/rotation limits - defaults allow unlimited (debugCam: true)
    this.controls.minDistance = 25
    this.controls.maxDistance = 410
    this.controls.maxPolarAngle = 1.424
    // Pan parallel to ground plane instead of screen
    this.controls.screenSpacePanning = false
    this.controls.target.set(0, 1, 0)
    this.controls.update()
  }

  updateOrthoFrustum() {
    const frustumSize = 100
    const aspect = window.innerWidth / window.innerHeight
    this.orthoCamera.left = -frustumSize * aspect / 2
    this.orthoCamera.right = frustumSize * aspect / 2
    this.orthoCamera.top = frustumSize / 2
    this.orthoCamera.bottom = -frustumSize / 2
    this.orthoCamera.updateProjectionMatrix()
  }

  updatePerspFrustum() {
    this.perspCamera.aspect = window.innerWidth / window.innerHeight
    this.perspCamera.updateProjectionMatrix()
  }

  initPostProcessing() {
    this.postFX = new PostFX(this.renderer, this.scene, this.camera)
    this.postFX.fadeOpacity.value = 0 // Start black
    this.wavesMask = new WavesMask(this.renderer)

    // Expose uniforms for GUI access (aliased from PostFX)
    this.aoEnabled = this.postFX.aoEnabled
    this.vignetteEnabled = this.postFX.vignetteEnabled
    this.debugView = this.postFX.debugView
    this.aoDenoiseRadius = this.postFX.aoDenoiseRadius
    this.aoIntensity = this.postFX.aoIntensity
    this.aoPass = this.postFX.aoPass
    this.dofEnabled = this.postFX.dofEnabled
    this.dofFocus = this.postFX.dofFocus
    this.dofFocalLength = this.postFX.dofFocalLength
    this.dofBokehScale = this.postFX.dofBokehScale
    this.grainEnabled = this.postFX.grainEnabled
    this.grainStrength = this.postFX.grainStrength
  }

  initStats() {
    this.stats = new Stats()
    this.stats.showPanel(0) // 0: fps, 1: ms, 2: mb
    this.stats.dom.style.display = 'none'
    document.body.appendChild(this.stats.dom)
  }

  initCSSRenderer() {
    this.cssRenderer = new CSS2DRenderer()
    this.cssRenderer.setSize(window.innerWidth, window.innerHeight)
    this.cssRenderer.domElement.style.position = 'absolute'
    this.cssRenderer.domElement.style.top = '0'
    this.cssRenderer.domElement.style.left = '0'
    this.cssRenderer.domElement.style.pointerEvents = 'none'
    this.cssRenderer.domElement.style.zIndex = '1'  // Below GUI (lil-gui uses z-index 9999)
    document.body.appendChild(this.cssRenderer.domElement)
  }

  initStatusOverlay() {
    this.statusElement = document.getElementById('status-text')
    const panel = document.createElement('section')
    panel.id = 'kingdom-panel'
    panel.style.cssText = `
      position: fixed;
      top: 12px;
      right: 12px;
      width: min(360px, calc(100vw - 24px));
      padding: 16px 16px 14px;
      border-radius: 18px;
      border: 1px solid rgba(224, 203, 159, 0.28);
      background:
        linear-gradient(180deg, rgba(27, 33, 45, 0.9), rgba(13, 17, 26, 0.88)),
        radial-gradient(circle at top, rgba(182, 148, 85, 0.12), transparent 58%);
      color: rgba(245, 239, 227, 0.94);
      box-shadow: 0 18px 60px rgba(0, 0, 0, 0.42);
      backdrop-filter: blur(12px);
      z-index: 1000;
      pointer-events: auto;
      font-family: 'Inter', sans-serif;
    `
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
        <div>
          <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(245,239,227,0.54);">Kingdom Mode</div>
          <div data-role="realm-name" style="margin-top:4px;font-size:24px;font-weight:600;line-height:1.05;"></div>
          <div data-role="realm-tagline" style="margin-top:6px;font-size:12px;line-height:1.45;color:rgba(245,239,227,0.72);"></div>
        </div>
        <div data-role="status-pill" style="padding:6px 10px;border-radius:999px;border:1px solid rgba(245,239,227,0.14);font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(245,239,227,0.72);">Active</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px;">
        <div style="padding:10px;border-radius:12px;background:rgba(255,255,255,0.045);">
          <div style="font-size:11px;color:rgba(245,239,227,0.54);text-transform:uppercase;">Seed</div>
          <div data-role="seed" style="margin-top:4px;font-size:16px;font-weight:600;"></div>
        </div>
        <div style="padding:10px;border-radius:12px;background:rgba(255,255,255,0.045);">
          <div style="font-size:11px;color:rgba(245,239,227,0.54);text-transform:uppercase;">Prestige</div>
          <div data-role="prestige" style="margin-top:4px;font-size:16px;font-weight:600;"></div>
        </div>
        <div style="padding:10px;border-radius:12px;background:rgba(255,255,255,0.045);">
          <div style="font-size:11px;color:rgba(245,239,227,0.54);text-transform:uppercase;">Threat</div>
          <div data-role="threat" style="margin-top:4px;font-size:16px;font-weight:600;"></div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px;">
        <label style="display:flex;flex-direction:column;gap:6px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(245,239,227,0.54);">
          Realm
          <select data-role="realm-select" style="padding:10px 12px;border-radius:12px;border:1px solid rgba(245,239,227,0.16);background:rgba(9,12,19,0.75);color:inherit;font:inherit;text-transform:none;"></select>
        </label>
        <label style="display:flex;flex-direction:column;gap:6px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(245,239,227,0.54);">
          Threat
          <select data-role="threat-select" style="padding:10px 12px;border-radius:12px;border:1px solid rgba(245,239,227,0.16);background:rgba(9,12,19,0.75);color:inherit;font:inherit;text-transform:none;"></select>
        </label>
      </div>
      <div style="margin-top:14px;padding:12px;border-radius:14px;background:rgba(255,255,255,0.045);">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
          <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(245,239,227,0.54);">Victory Path</div>
          <div data-role="turn" style="font-size:12px;color:rgba(245,239,227,0.72);"></div>
        </div>
        <div data-role="objective-label" style="margin-top:8px;font-size:16px;font-weight:600;"></div>
        <div data-role="objective-progress" style="margin-top:6px;font-size:12px;line-height:1.5;color:rgba(245,239,227,0.74);"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px;">
        <div style="padding:12px;border-radius:14px;background:rgba(255,255,255,0.045);">
          <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(245,239,227,0.54);">Active Effects</div>
          <div data-role="effects" style="margin-top:8px;font-size:12px;line-height:1.5;color:rgba(245,239,227,0.72);"></div>
        </div>
        <div style="padding:12px;border-radius:14px;background:rgba(255,255,255,0.045);">
          <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(245,239,227,0.54);">War Room</div>
          <div data-role="messages" style="margin-top:8px;font-size:12px;line-height:1.5;color:rgba(245,239,227,0.72);"></div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
        <button data-role="reset-run" style="flex:1 1 130px;padding:10px 12px;border-radius:12px;border:1px solid rgba(224,203,159,0.22);background:rgba(191,151,84,0.12);color:inherit;font:inherit;cursor:pointer;">New Kingdom</button>
        <button data-role="new-seed" style="flex:1 1 100px;padding:10px 12px;border-radius:12px;border:1px solid rgba(245,239,227,0.14);background:rgba(255,255,255,0.06);color:inherit;font:inherit;cursor:pointer;">New Seed</button>
        <button data-role="copy-link" style="flex:1 1 100px;padding:10px 12px;border-radius:12px;border:1px solid rgba(245,239,227,0.14);background:rgba(255,255,255,0.06);color:inherit;font:inherit;cursor:pointer;">Copy Link</button>
      </div>
    `
    document.body.appendChild(panel)
    panel.addEventListener('pointerdown', (e) => e.stopPropagation())
    panel.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true })

    this.kingdomPanel = panel
    this.seedElement = panel.querySelector('[data-role="seed"]')
    this.kingdomRealmName = panel.querySelector('[data-role="realm-name"]')
    this.kingdomRealmTagline = panel.querySelector('[data-role="realm-tagline"]')
    this.kingdomStatusPill = panel.querySelector('[data-role="status-pill"]')
    this.kingdomPrestige = panel.querySelector('[data-role="prestige"]')
    this.kingdomThreat = panel.querySelector('[data-role="threat"]')
    this.kingdomTurn = panel.querySelector('[data-role="turn"]')
    this.kingdomObjectiveLabel = panel.querySelector('[data-role="objective-label"]')
    this.kingdomObjectiveProgress = panel.querySelector('[data-role="objective-progress"]')
    this.kingdomEffects = panel.querySelector('[data-role="effects"]')
    this.kingdomMessages = panel.querySelector('[data-role="messages"]')
    this.realmSelect = panel.querySelector('[data-role="realm-select"]')
    this.threatSelect = panel.querySelector('[data-role="threat-select"]')

    for (const realm of KINGDOM_IDENTITIES) {
      const option = document.createElement('option')
      option.value = realm.id
      option.textContent = realm.label
      this.realmSelect.appendChild(option)
    }
    for (const threat of THREAT_PROFILES) {
      const option = document.createElement('option')
      option.value = threat.id
      option.textContent = threat.label
      this.threatSelect.appendChild(option)
    }

    this.realmSelect.value = this.selectedRealmId ?? this.kingdom?.realm?.id ?? KINGDOM_IDENTITIES[0].id
    this.threatSelect.value = this.selectedThreatId ?? this.kingdom?.threat?.id ?? THREAT_PROFILES[0].id

    this.realmSelect.addEventListener('change', () => {
      this.selectedRealmId = this.realmSelect.value
      void this.restartKingdom({ realmId: this.selectedRealmId, threatId: this.selectedThreatId, seed: this.currentSeed })
    })
    this.threatSelect.addEventListener('change', () => {
      this.selectedThreatId = this.threatSelect.value
      void this.restartKingdom({ realmId: this.selectedRealmId, threatId: this.selectedThreatId, seed: this.currentSeed })
    })
    panel.querySelector('[data-role="reset-run"]').addEventListener('click', () => {
      void this.restartKingdom({ realmId: this.selectedRealmId, threatId: this.selectedThreatId, seed: this.currentSeed })
    })
    panel.querySelector('[data-role="new-seed"]').addEventListener('click', () => {
      void this.restartKingdom({ realmId: this.selectedRealmId, threatId: this.selectedThreatId, seed: randomSeed() })
    })
    panel.querySelector('[data-role="copy-link"]').addEventListener('click', async () => {
      this.updateShareUrl()
      try {
        await navigator.clipboard.writeText(window.location.href)
        this.kingdom?.rememberMessage('Run link copied to clipboard.')
        this.renderKingdomState()
      } catch (_error) {
        this.kingdom?.rememberMessage('Clipboard access failed.')
        this.renderKingdomState()
      }
    })
  }

  initModeButtons() {
    const addHover = (btn) => {
      btn.addEventListener('mouseenter', () => {
        if (!btn._noHoverBorder) btn.style.borderColor = 'rgba(255,255,255,0.7)'
      })
      btn.addEventListener('mouseleave', () => {
        btn.style.borderColor = btn._activeBorder || 'rgba(255,255,255,0.3)'
      })
    }

    const btnBase = `
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.3);
      background: transparent;
      color: rgba(255,255,255,0.8);
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      cursor: pointer;
      backdrop-filter: blur(4px);
      padding: 8px 13px;
      text-shadow: 0 1px 3px rgba(0,0,0,0.48);
    `

    // Buttons container (bottom-left)
    const container = document.createElement('div')
    container.id = 'ui-menu'
    container.style.cssText = `
      position: fixed;
      bottom: 10px;
      left: 10px;
      display: flex;
      flex-direction: row;
      gap: 9px;
      z-index: 1000;
    `
    document.body.appendChild(container)

    // Mode toggle (Move | Build)
    const toggle = document.createElement('div')
    toggle.style.cssText = `
      display: flex;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.3);
      background: transparent;
      overflow: hidden;
      backdrop-filter: blur(4px);
    `
    const modeButtons = {}
    const setMode = (key) => {
      this.buildMode = key === 'build'
      for (const [k, btn] of Object.entries(modeButtons)) {
        btn.style.background = k === key ? 'rgba(255,255,255,0.3)' : 'transparent'
      }
    }
    for (const { key, label } of [{ key: 'move', label: 'Move' }, { key: 'build', label: 'Build' }]) {
      const btn = document.createElement('button')
      btn.textContent = label
      btn.style.cssText = `
        padding: 8px 13px;
        border: none;
        background: ${key === 'move' ? 'rgba(255,255,255,0.3)' : 'transparent'};
        color: rgba(255,255,255,0.8);
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        cursor: pointer;
        text-shadow: 0 1px 3px rgba(0,0,0,0.48);
      `
      btn.addEventListener('mouseenter', () => { toggle.style.borderColor = 'rgba(255,255,255,0.7)' })
      btn.addEventListener('mouseleave', () => { toggle.style.borderColor = 'rgba(255,255,255,0.3)' })
      btn.addEventListener('pointerdown', (e) => e.stopPropagation())
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        setMode(key)
      })
      modeButtons[key] = btn
      toggle.appendChild(btn)
      if (key === 'move') {
        const divider = document.createElement('div')
        divider.style.cssText = 'width: 1px; background: rgba(255,255,255,0.3); align-self: stretch;'
        toggle.appendChild(divider)
      }
    }
    container.appendChild(toggle)

    // Action buttons
    const actions = [
      { label: 'Build All', action: () => {
        this.city.autoBuild(this._buildAllOrder)
      }},
      { label: 'Clear All', action: () => {
        void this.restartKingdom({ realmId: this.selectedRealmId, threatId: this.selectedThreatId, seed: this.currentSeed })
      }},
    ]

    for (const { label, action } of actions) {
      const btn = document.createElement('button')
      btn.textContent = label
      btn.style.cssText = btnBase
      addHover(btn)
      btn.addEventListener('pointerdown', (e) => e.stopPropagation())
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        action()
      })
      container.appendChild(btn)
    }

    // Settings toggle
    const guiBtn = document.createElement('button')
    guiBtn.textContent = 'Controls'
    guiBtn.style.cssText = btnBase
    let guiVisible = false
    const guiEl = this.gui?.gui?.domElement
    if (guiEl) guiEl.classList.add('gui-hidden')
    const updateGuiBtn = () => {
      guiBtn.style.background = guiVisible ? 'rgba(255,255,255,0.3)' : 'transparent'
    }
    updateGuiBtn()
    addHover(guiBtn)
    guiBtn.addEventListener('pointerdown', (e) => e.stopPropagation())
    guiBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      const guiEl = this.gui?.gui?.domElement
      if (!guiEl) return
      guiVisible = !guiVisible
      guiEl.classList.toggle('gui-hidden', !guiVisible)
      updateGuiBtn()
    })
    container.appendChild(guiBtn)
  }

  updateShareUrl() {
    const params = new URLSearchParams(window.location.search)
    params.set('seed', `${this.currentSeed}`)
    params.set('realm', this.selectedRealmId)
    params.set('threat', this.selectedThreatId)
    const nextUrl = `${window.location.pathname}?${params.toString()}`
    window.history.replaceState({}, '', nextUrl)
  }

  renderKingdomState(snapshot = this.kingdom?.getSnapshot()) {
    if (!snapshot || !this.kingdomPanel) return

    this.seedElement.textContent = `${snapshot.seed}`
    this.kingdomRealmName.textContent = snapshot.realm.label
    this.kingdomRealmTagline.textContent = snapshot.realm.tagline
    this.kingdomPrestige.textContent = `${snapshot.prestige}`
    this.kingdomThreat.textContent = `${snapshot.threatMeter}/12`
    this.kingdomTurn.textContent = `Turn ${snapshot.turn}`
    this.kingdomObjectiveLabel.textContent = snapshot.objective.label
    this.kingdomObjectiveProgress.textContent = snapshot.objectiveText
    this.kingdomEffects.textContent = snapshot.activeEffects.length > 0
      ? snapshot.activeEffects.map(effect => `${effect.label} (${effect.remainingTurns})`).join(' | ')
      : 'No temporary realm effects.'
    this.kingdomMessages.textContent = snapshot.messages.slice(0, 3).join(' | ')
    this.realmSelect.value = snapshot.realm.id
    this.threatSelect.value = snapshot.threat.id

    const statusMap = {
      active: { label: 'Active', color: 'rgba(245,239,227,0.72)', border: 'rgba(245,239,227,0.14)' },
      won: { label: 'Victory', color: '#7fe0a6', border: 'rgba(127,224,166,0.34)' },
      lost: { label: 'Broken', color: '#ff9f83', border: 'rgba(255,159,131,0.34)' },
    }
    const status = statusMap[snapshot.status] ?? statusMap.active
    this.kingdomStatusPill.textContent = status.label
    this.kingdomStatusPill.style.color = status.color
    this.kingdomStatusPill.style.borderColor = status.border
  }

  async restartKingdom({
    realmId = this.selectedRealmId,
    threatId = this.selectedThreatId,
    seed = this.currentSeed,
  } = {}) {
    this.currentSeed = seed
    this.selectedRealmId = realmId
    this.selectedThreatId = threatId
    setSeed(seed)
    rebuildNoiseTables()
    this.kingdom.reset({ seed, realmId, threatId })
    this.selectedRealmId = this.kingdom.realm.id
    this.selectedThreatId = this.kingdom.threat.id
    this.updateShareUrl()

    if (this.city) {
      await this.city.reset()
      this.city.setHelpersVisible(this.params.debug.hexGrid)
      this.perspCamera.position.set(0, 100, 58.5)
      this.controls.target.set(0, 1, 0)
      this.controls.update()
      this.kingdom.syncWorld(this.city.getKingdomSummary())
    }

    this.renderKingdomState()
  }

  async onKingdomAction(actionType, payload) {
    if (!this.kingdom || this.city?._autoBuilding) {
      this.kingdom?.syncWorld(payload.summary)
      this.renderKingdomState()
      return
    }

    const result = this.kingdom.applyAction({
      actionType,
      summary: payload.summary,
      cells: [...this.city.globalCells.values()],
    })

    this.renderKingdomState(result.state)

    if (result.incursion) {
      await this.city.triggerCampaignIncursion(result.incursion)
      this.kingdom.syncWorld(this.city.getKingdomSummary())
      this.renderKingdomState()
    }

    this.updateShareUrl()
  }

  onResize(_e, toSize) {
    const { renderer, cssRenderer, postFX } = this
    const size = new Vector2(window.innerWidth, window.innerHeight)
    if (toSize) size.copy(toSize)

    this.updateOrthoFrustum()
    this.updatePerspFrustum()

    renderer.setSize(size.x, size.y)
    renderer.domElement.style.width = `${size.x}px`
    renderer.domElement.style.height = `${size.y}px`

    if (cssRenderer) {
      cssRenderer.setSize(size.x, size.y)
    }

    // Resize overlay render target
    if (postFX) {
      postFX.resize()
    }
  }

  animate() {
    this.stats.begin()

    const { controls, timer, postFX } = this

    timer.update()
    const dt = timer.getDelta()

    controls.update(dt)
    // Clamp target Y to prevent panning under the city
    if (controls.target.y < 0) controls.target.y = 0
    this.lighting.updateShadowCamera(this.controls.target, this.camera, this.orthoCamera, this.perspCamera)

    // Auto-focus DOF on orbit target, scale focal length with zoom
    const dist = this.camera.position.distanceTo(controls.target)
    postFX.dofFocus.value = dist
    const t = Math.min(Math.max((dist - 25) / (410 - 25), 0), 1) // 0=zoomed in, 1=zoomed out
    postFX.dofFocalLength.value = 20 + t * 80 // 20 at close, 100 at far

    // Animate grain noise — quantize to noiseFPS for film-like grain (0 = static)
    const noiseFPS = this.params.fx.grainFPS
    if (noiseFPS > 0) {
      postFX.grainTime.value = Math.floor(timer.getElapsed() * noiseFPS) / noiseFPS
    }

    // Update debris physics
    this.city.update(dt)

    // Update render layers
    const maskObjects = []
    for (const grid of this.city.grids.values()) {
      if (grid.hexMesh) maskObjects.push(grid.hexMesh)
      if (grid.decorations?.mesh) maskObjects.push(grid.decorations.mesh)
    }
    postFX.setWaterMaskObjects(maskObjects)
    postFX.setOverlayObjects(this.city.getOverlayObjects())
    postFX.setWaterObjects(this.city.getWaterObjects())

    postFX.render()

    // Debug: show coast mask RT in bottom-left corner
    if (this.wavesMask?.showDebug) this.wavesMask.renderDebug()

    // Always render CSS labels (individual label.visible controls what shows)
    if (this.cssRenderer) {
      this.cssRenderer.render(this.scene, this.camera)
    }

    this.stats.end()
  }

  exportPNG({ format = 'image/jpeg', quality = 0.85, filename } = {}) {
    // Render one frame to ensure canvas is up to date
    this.postFX.render()

    // Get canvas data
    const canvas = this.renderer.domElement
    const ext = format === 'image/png' ? 'png' : 'jpg'
    const name = filename || `city-${Date.now()}.${ext}`
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = name
      link.click()
      URL.revokeObjectURL(url)
    }, format, quality)
  }

  fadeIn(duration = 1000) {
    gsap.to(this.postFX.fadeOpacity, { value: 1, duration: duration / 1000 })
  }
}
