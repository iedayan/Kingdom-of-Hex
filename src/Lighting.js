import {
  Vector3,
  Box3,
  Color,
  EquirectangularReflectionMapping,
  DirectionalLight,
  DirectionalLightHelper,
  HemisphereLight,
} from 'three/webgpu'
import { HDRLoader } from 'three/examples/jsm/Addons.js'

const HDR_PATH = './assets/hdr/venice_sunset_1k.hdr'
const SCENE_SIZE = 98
const MAX_BUILDING_HEIGHT = 60
const DEFAULT_SHADOW_QUALITY = 'high'

export class Lighting {
  constructor(scene, renderer, params) {
    this.scene = scene
    this.renderer = renderer
    this.params = params

    this.dirLight = null
    this.dirLightOffset = null
    this.dirLightHelper = null
    this.hemiLight = null
    this.sceneBounds = null

    this._corners = Array(8).fill(null).map(() => new Vector3())
    this._lightViewMatrix = null
    this._initialized = false
  }

  async init() {
    const { scene, params } = this

    try {
      const texture = await new HDRLoader().loadAsync(HDR_PATH)
      texture.mapping = EquirectangularReflectionMapping
      texture.needsUpdate = true
      scene.environment = texture
    } catch (error) {
      console.warn('[Lighting] Failed to load HDR texture, continuing without environment:', error)
      scene.environment = null
    }

    scene.background = new Color(0x8492ac)

    this.hemiLight = new HemisphereLight(0xcfd8e8, 0x252830, 0.4)
    scene.add(this.hemiLight)

    this.sceneBounds = new Box3(
      new Vector3(-SCENE_SIZE / 2, 0, -SCENE_SIZE / 2),
      new Vector3(SCENE_SIZE / 2, MAX_BUILDING_HEIGHT, SCENE_SIZE / 2)
    )

    this.dirLight = new DirectionalLight(0xfff4ea, 1.05)
    this.dirLightOffset = new Vector3(50, 100, 50)
    this.dirLight.position.copy(this.dirLightOffset)
    this.dirLight.castShadow = true
    this.setShadowQuality(DEFAULT_SHADOW_QUALITY)
    this.dirLight.shadow.bias = -0.0005
    scene.add(this.dirLight)
    scene.add(this.dirLight.target)

    this.updateShadowFrustum()

    this.dirLightHelper = new DirectionalLightHelper(this.dirLight, 10)
    this.dirLightHelper.visible = params?.lighting?.showHelper ?? false
    scene.add(this.dirLightHelper)

    this._initialized = true
  }

  setShadowQuality(quality) {
    const sizes = { low: 1024, medium: 2048, high: 4096 }
    const size = sizes[quality] || 4096
    if (this.dirLight) {
      this.dirLight.shadow.mapSize.width = size
      this.dirLight.shadow.mapSize.height = size
    }
  }

  updateShadowFrustum() {
    const light = this.dirLight
    if (!light) return

    const bounds = this.sceneBounds
    const center = new Vector3()
    bounds.getCenter(center)
    const radius = bounds.min.distanceTo(bounds.max) / 2

    light.target.position.copy(center)
    light.target.updateMatrixWorld()

    light.position.copy(center).add(this.dirLightOffset)
    light.updateMatrixWorld()

    const shadowCam = light.shadow.camera
    shadowCam.left = -radius
    shadowCam.right = radius
    shadowCam.top = radius
    shadowCam.bottom = -radius
    shadowCam.near = 0.5
    shadowCam.far = this.dirLightOffset.length() + radius
    shadowCam.updateProjectionMatrix()

    if (this.dirLightHelper) {
      this.dirLightHelper.update()
    }
  }

  updateShadowCamera(cameraTarget, camera, orthoCamera, perspCamera) {
    if (!this.dirLight || !this._initialized) return
    if (!cameraTarget || !camera || !orthoCamera || !perspCamera) return

    const target = cameraTarget
    const offset = this.dirLightOffset

    this.dirLight.position.set(target.x + offset.x, offset.y, target.z + offset.z)
    this.dirLight.target.position.copy(target)
    this.dirLight.target.updateMatrixWorld()
    this.dirLight.updateMatrixWorld()

    const shadowCam = this.dirLight.shadow.camera
    shadowCam.updateMatrixWorld()

    let halfSize
    if (camera === orthoCamera) {
      const cam = orthoCamera
      const zoom = cam.zoom || 1
      halfSize = Math.max(cam.right - cam.left, cam.top - cam.bottom) / 2 / zoom
    } else {
      const cam = perspCamera
      const distance = cam.position.distanceTo(target)
      const vFov = (cam.fov * Math.PI) / 180
      const vHalf = Math.tan(vFov / 2) * distance
      const hHalf = vHalf * cam.aspect
      halfSize = Math.max(vHalf, hHalf)
    }
    halfSize = Math.max(8, Math.min(halfSize * 1.2, 120))
    const height = MAX_BUILDING_HEIGHT

    const corners = this._corners
    corners[0].set(target.x - halfSize, 0, target.z - halfSize)
    corners[1].set(target.x + halfSize, 0, target.z - halfSize)
    corners[2].set(target.x - halfSize, 0, target.z + halfSize)
    corners[3].set(target.x + halfSize, 0, target.z + halfSize)
    corners[4].set(target.x - halfSize, height, target.z - halfSize)
    corners[5].set(target.x + halfSize, height, target.z - halfSize)
    corners[6].set(target.x - halfSize, height, target.z + halfSize)
    corners[7].set(target.x + halfSize, height, target.z + halfSize)

    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity
    let minZ = Infinity, maxZ = -Infinity

    const lightViewMatrix = shadowCam.matrixWorldInverse
    for (let i = 0; i < 8; i++) {
      const corner = corners[i]
      corner.applyMatrix4(lightViewMatrix)
      if (corner.x < minX) minX = corner.x
      if (corner.x > maxX) maxX = corner.x
      if (corner.y < minY) minY = corner.y
      if (corner.y > maxY) maxY = corner.y
      if (corner.z < minZ) minZ = corner.z
      if (corner.z > maxZ) maxZ = corner.z
    }

    const padding = Math.max(2, halfSize * 0.1)
    shadowCam.left = minX - padding
    shadowCam.right = maxX + padding
    shadowCam.top = maxY + padding
    shadowCam.bottom = minY - padding
    shadowCam.near = Math.max(0.1, Math.abs(minZ) - padding)
    shadowCam.far = Math.abs(maxZ) + padding
    shadowCam.updateProjectionMatrix()

    if (this.dirLightHelper && this.dirLightHelper.visible) {
      this.dirLightHelper.update()
    }
  }

  setHelperVisible(visible) {
    if (this.dirLightHelper) {
      this.dirLightHelper.visible = visible
    }
  }

  dispose() {
    if (this.dirLightHelper) {
      this.scene.remove(this.dirLightHelper)
      this.dirLightHelper.dispose()
      this.dirLightHelper = null
    }
    if (this.dirLight) {
      this.scene.remove(this.dirLight)
      this.dirLight.dispose()
      this.dirLight = null
    }
    if (this.hemiLight) {
      this.scene.remove(this.hemiLight)
      this.hemiLight.dispose()
      this.hemiLight = null
    }
    this._initialized = false
  }
}
