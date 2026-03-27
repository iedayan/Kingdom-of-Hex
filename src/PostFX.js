import { RenderPipeline, RenderTarget, RGBAFormat, Color } from 'three/webgpu'
import {
  pass,
  output,
  mrt,
  normalView,
  viewportUV,
  clamp,
  uniform,
  select,
  mix,
  float,
  vec3,
  texture,
  blendOverlay,
} from 'three/tsl'
import { ao } from 'three/addons/tsl/display/GTAONode.js'
import { denoise } from 'three/addons/tsl/display/DenoiseNode.js'
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js'

export class PostFX {
  constructor(renderer, scene, camera) {
    this.renderer = renderer
    this.scene = scene
    this.camera = camera

    this.postProcessing = new RenderPipeline(renderer)

    this.aoEnabled = uniform(1)
    this.vignetteEnabled = uniform(0)
    this.dofEnabled = uniform(0)
    this.grainEnabled = uniform(0)
    this.debugView = uniform(0)
    this.aoDenoiseRadius = uniform(5)
    this.dofFocus = uniform(100)
    this.dofFocalLength = uniform(50)
    this.dofBokehScale = uniform(1)
    this.grainStrength = uniform(0.1)
    this.grainTime = uniform(0)
    this.grainFPS = uniform(0)
    this.fadeOpacity = uniform(1)

    this.width = 0
    this.height = 0
    this.aspectRatio = 1
    this._updateDimensions()

    this.overlayTarget = null
    this.waterTarget = null
    this.waterMaskTarget = null
    this._createRenderTargets()

    this.overlayObjects = []
    this.waterObjects = []
    this.waterMaskObjects = []

    this.overlaySet = new Set()
    this.waterSet = new Set()
    this.waterMaskSet = new Set()

    this.onWaterMaskRender = null

    this._lastGrainUpdate = 0

    this._buildPipeline()
  }

  _updateDimensions() {
    const dpr = Math.min(window.devicePixelRatio, 2)
    this.width = window.innerWidth * dpr
    this.height = window.innerHeight * dpr
    this.aspectRatio = this.width / this.height
  }

  _createRenderTargets() {
    if (this.overlayTarget) this.overlayTarget.dispose()
    if (this.waterTarget) this.waterTarget.dispose()
    if (this.waterMaskTarget) this.waterMaskTarget.dispose()

    this.overlayTarget = new RenderTarget(this.width, this.height, { samples: 1 })
    this.overlayTarget.texture.format = RGBAFormat

    this.waterTarget = new RenderTarget(this.width, this.height, { samples: 1 })
    this.waterTarget.texture.format = RGBAFormat

    const mw = Math.ceil(this.width / 4)
    const mh = Math.ceil(this.height / 4)
    this.waterMaskTarget = new RenderTarget(mw, mh, { samples: 1 })
    this.waterMaskTarget.texture.format = RGBAFormat
  }

  _buildPipeline() {
    const { scene, camera } = this

    const scenePass = pass(scene, camera)
    scenePass.setMRT(
      mrt({
        output: output,
        normal: normalView,
      })
    )
    const scenePassColor = scenePass.getTextureNode('output')
    const scenePassNormal = scenePass.getTextureNode('normal')
    const scenePassDepth = scenePass.getTextureNode('depth')
    const scenePassViewZ = scenePass.getViewZNode()

    const dofResult = dof(scenePassColor, scenePassViewZ, this.dofFocus, this.dofFocalLength, this.dofBokehScale)
    const afterDof = mix(scenePassColor, dofResult, this.dofEnabled)

    this.aoPass = ao(scenePassDepth, scenePassNormal, camera)
    this.aoPass.resolutionScale = 0.5
    this.aoPass.distanceExponent.value = 1
    this.aoPass.distanceFallOff.value = 0.1
    this.aoPass.radius.value = 1.0
    this.aoPass.scale.value = 1.5
    this.aoPass.thickness.value = 1

    const aoTexture = this.aoPass.getTextureNode()
    this.aoDenoisePass = denoise(aoTexture, scenePassDepth, scenePassNormal, camera)
    this.aoDenoisePass.radius = this.aoDenoiseRadius
    const denoisedAO = this.aoDenoisePass.r

    const softenedAO = denoisedAO.pow(0.5)
    const withAO = mix(afterDof, afterDof.mul(softenedAO), this.aoEnabled)

    const waterMaskSample = texture(this.waterMaskTarget.texture)
    const waterMask = waterMaskSample.r.greaterThan(0.1).toFloat()

    const waterTexture = texture(this.waterTarget.texture)
    const waterAlpha = waterTexture.a.mul(waterMask)
    const withWater = withAO.add(waterTexture.rgb.mul(waterAlpha))

    const overlayTexture = texture(this.overlayTarget.texture)
    const withOverlay = withWater.add(overlayTexture.rgb.mul(overlayTexture.a))

    const uvCentered = viewportUV.sub(0.5)
    const aspectCorrected = vec3(uvCentered.x.mul(Math.max(this.aspectRatio, 1)), uvCentered.y.div(Math.max(this.aspectRatio, 1)), 0)
    const vignetteFactor = float(1).sub(
      clamp(aspectCorrected.length().mul(1.4), 0.0, 1.0).pow(1.5)
    )
    const vignetteMultiplier = mix(float(1), vignetteFactor, this.vignetteEnabled)
    const withVignette = mix(vec3(0, 0, 0), withOverlay.rgb, vignetteMultiplier)

    const fadeColor = vec3(0, 0, 0)
    const afterFade = mix(fadeColor, withVignette, this.fadeOpacity)

    const grainSeed1 = viewportUV.x.mul(12.9898).add(viewportUV.y.mul(78.233)).add(this.grainTime)
    const grainSeed2 = viewportUV.x.mul(93.9898).add(viewportUV.y.mul(67.345)).add(this.grainTime)
    const grainSeed3 = viewportUV.x.mul(43.332).add(viewportUV.y.mul(93.532)).add(this.grainTime)
    const noiseR = grainSeed1.sin().mul(43758.5453).fract()
    const noiseG = grainSeed2.sin().mul(43758.5453).fract()
    const noiseB = grainSeed3.sin().mul(43758.5453).fract()
    const grainRaw = vec3(noiseR, noiseG, noiseB)
    const grainOverlay = blendOverlay(afterFade, grainRaw)
    const finalOutput = mix(afterFade, grainOverlay, this.grainEnabled.mul(this.grainStrength))

    const depthViz = vec3(scenePassDepth)
    const normalViz = scenePassNormal.mul(0.5).add(0.5)
    const aoViz = vec3(denoisedAO, denoisedAO, denoisedAO)
    const overlayViz = overlayTexture.rgb
    const waterMaskViz = vec3(waterMaskSample.r)

    const debugOutput = select(
      this.debugView.lessThan(0.5),
      finalOutput,
      select(
        this.debugView.lessThan(1.5),
        scenePassColor,
        select(
          this.debugView.lessThan(2.5),
          depthViz,
          select(
            this.debugView.lessThan(3.5),
            normalViz,
            select(
              this.debugView.lessThan(4.5),
              aoViz,
              select(this.debugView.lessThan(5.5), overlayViz, waterMaskViz)
            )
          )
        )
      )
    )

    this.postProcessing.outputNode = debugOutput
  }

  setCamera(camera) {
    this.camera = camera
    this._buildPipeline()
  }

  resize() {
    this._updateDimensions()
    this._createRenderTargets()
    this._buildPipeline()
  }

  setOverlayObjects(objects) {
    this.overlayObjects = objects
    this.overlaySet = new Set(objects)
  }

  setWaterObjects(objects) {
    this.waterObjects = objects
    this.waterSet = new Set(objects)
  }

  setWaterMaskObjects(objects) {
    this.waterMaskObjects = objects
    this.waterMaskSet = new Set(objects)
  }

  _updateGrainTime() {
    const fps = this.grainFPS.value
    const now = performance.now() * 0.001

    if (fps <= 0) {
      this.grainTime.value = now
      this._lastGrainUpdate = now
      return
    }

    const interval = 1 / fps
    const delta = now - this._lastGrainUpdate

    if (delta >= interval) {
      this.grainTime.value = now
      this._lastGrainUpdate = now
    }
  }

  render() {
    this._updateGrainTime()

    const { renderer, scene, camera, overlayObjects, overlayTarget } = this

    const savedClearColor = renderer.getClearColor(new Color())
    const savedClearAlpha = renderer.getClearAlpha()
    const savedBackground = scene.background
    const savedEnvironment = scene.environment

    scene.background = null
    scene.environment = null

    this.onWaterMaskRender?.(true)

    renderer.setRenderTarget(this.waterMaskTarget)
    renderer.setClearColor(0x000000, 1)
    renderer.clear()
    const savedAutoClear = renderer.autoClear
    renderer.autoClear = false

    if (this.waterMaskObjects.length > 0) {
      const savedMaskVis = new Map()
      scene.traverse((child) => {
        if (!child.isMesh && !child.isBatchedMesh && !child.isInstancedMesh &&
            !child.isLine && !child.isLineSegments && !child.isPoints) return
        const isIncluded = this.waterMaskSet.has(child) ||
          (child.parent && this.waterMaskSet.has(child.parent))
        if (!isIncluded) {
          savedMaskVis.set(child, child.visible)
          child.visible = false
        }
      })

      renderer.render(scene, camera)

      for (const [child, vis] of savedMaskVis) child.visible = vis
    }

    renderer.autoClear = savedAutoClear
    this.onWaterMaskRender?.(false)

    renderer.setRenderTarget(overlayTarget)
    renderer.setClearColor(0x000000, 0)
    renderer.clear()

    const savedVisibility = new Map()
    scene.traverse((child) => {
      if (!child.isMesh && !child.isLine && !child.isLineSegments && !child.isPoints) return
      const isIncluded = this.overlaySet.has(child) ||
        (child.parent && this.overlaySet.has(child.parent))
      if (!isIncluded) {
        savedVisibility.set(child, child.visible)
        child.visible = false
      }
    })

    renderer.render(scene, camera)

    for (const [obj, visible] of savedVisibility) {
      obj.visible = visible
    }

    const { waterObjects, waterTarget } = this
    renderer.setRenderTarget(waterTarget)
    renderer.setClearColor(0x000000, 0)
    renderer.clear()

    if (waterObjects.length > 0) {
      const savedWaterVis = new Map()
      scene.traverse((child) => {
        if (!child.isMesh && !child.isLine && !child.isLineSegments && !child.isPoints) return
        const isIncluded = this.waterSet.has(child) ||
          (child.parent && this.waterSet.has(child.parent))
        if (!isIncluded) {
          savedWaterVis.set(child, child.visible)
          child.visible = false
        }
      })

      renderer.render(scene, camera)

      for (const [child, vis] of savedWaterVis) child.visible = vis
    }

    scene.background = savedBackground
    scene.environment = savedEnvironment
    renderer.setRenderTarget(null)
    renderer.setClearColor(savedClearColor, savedClearAlpha)

    const savedMainVis = new Map()
    for (const obj of waterObjects) {
      savedMainVis.set(obj, obj.visible)
      obj.visible = false
    }
    for (const obj of overlayObjects) {
      savedMainVis.set(obj, obj.visible)
      obj.visible = false
    }

    this.postProcessing.render()

    for (const [obj, visible] of savedMainVis) {
      obj.visible = visible
    }
  }

  dispose() {
    if (this.overlayTarget) {
      this.overlayTarget.dispose()
      this.overlayTarget = null
    }
    if (this.waterTarget) {
      this.waterTarget.dispose()
      this.waterTarget = null
    }
    if (this.waterMaskTarget) {
      this.waterMaskTarget.dispose()
      this.waterMaskTarget = null
    }
    if (this.aoPass?.dispose) this.aoPass.dispose()
    if (this.aoDenoisePass?.dispose) this.aoDenoisePass.dispose()
    if (this.postProcessing?.dispose) this.postProcessing.dispose()
  }
}
