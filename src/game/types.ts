export type Owner = 'player' | 'enemy'
export type UnitType =
  | 'scout'
  | 'archer'
  | 'knight'
  | 'outrider'
  | 'sentinel'
  | 'sageguard'
  | 'goblin'
  | 'goblin_raider'
  | 'goblin_brute'
  | 'goblin_slinger'
  | 'goblin_warlord'
export type BuildingType = 'lumberjack' | 'farm' | 'mine' | 'market' | 'tower' | 'library'
export type ObjectType = UnitType | BuildingType
export type BiomeType = 'temperate' | 'winter' | 'wasteland'

export interface Resources {
  gold: number
  wood: number
  food: number
  stone: number
  science: number
}

export interface UnitStats {
  hp: number
  maxHp: number
  atk: number
  range: number
  mp: number
  cost: number
  sight: number
}

export interface GameUnit extends UnitStats {
  type: UnitType
  owner: Owner
  cKey: string
  xp: number
  rank: number
  mpRemaining: number
  movedThisTurn: boolean
  turnCreated: number
  level?: number
}

export interface GameBuilding {
  type: BuildingType
  owner: Owner
  cKey: string
  level?: number
  hp?: number
  maxHp?: number
}

export type GameObject = GameUnit | GameBuilding

export interface HexCoord {
  q: number
  r: number
  s: number
}

export interface TechDefinition {
  name: string
  cost: number
  unlocks: string[]
  requires: string[]
  progress: number
}

export interface BuildingDefinition {
  id: string
  name: string
  icon: string
  cost: Partial<Resources>
  tech?: string
  desc: string
}

export interface UnitDefinition extends UnitStats {
  id: string
  name: string
  icon: string
  tech?: string
  desc: string
}

export interface TechTree {
  [key: string]: TechDefinition
}

export type GamePhase = 'playing' | 'won' | 'lost' | 'stopped'

export type LoseReason = 'time' | 'capital'

export interface GameConfig {
  seed: number
  app: AppInterface
}

export interface AppInterface {
  unitManager: UnitManagerInterface
  showTurnNotification: (msg: string, duration: number) => void
  panToTile: (key: string) => void
  spawnFloatingText: (text: string, pos: { x: number; y: number; z: number }, color: string) => void
  showEventModal: (event: WorldEvent) => void
  actionBar: HTMLElement | null
  city: { grids: Map<number, HexGridInterface> }
}

export interface UnitManagerInterface {
  getWorldPosition: (coord: HexCoord, level: number) => { x: number; y: number; z: number }
  fireProjectile: (fromKey: string, toKey: string, type: string) => Promise<void>
  animateHit: (key: string) => void
}

export interface HexGridInterface {
  hexTiles: HexTileData[]
  gridRadius: number
  globalCenterCube: HexCoord
}

export interface HexTileData {
  type: number
  gridX: number
  gridZ: number
}

export interface WorldEvent {
  id: string
  title: string
  text: string
  options: WorldEventOption[]
}

export interface WorldEventOption {
  label: string
  desc: string
  req?: (gs: GameSessionInterface) => boolean
  act: (gs: GameSessionInterface) => void
}

export interface GameSessionInterface {
  seed: number
  phase: GamePhase
  loseReason: LoseReason | null
  elapsed: number
  resources: Resources
  turn: number
  researched: Set<string>
  currentResearch: string | null
  revealed: Set<string>
  ownedTiles: Set<string>
  biomes: Map<string, BiomeType>
  techTree: TechTree
  objects: Map<string, GameObject>
  onUpdateUI: (() => void) | null
  onObjectAdded: ((cKey: string, obj: GameObject) => void) | null
  onObjectRemoved: ((cKey: string, obj: GameObject) => void) | null
  onUnitSpawned: ((cKey: string, unit: GameUnit) => void) | null
  onUnitMoved: ((from: string, to: string, unit: GameUnit) => void) | null
  onUnitRemoved: ((cKey: string, unit: GameUnit) => void) | null
}
