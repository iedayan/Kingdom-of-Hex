/**
 * Centralized game data definitions for UI and Logic.
 * Fulfills GDD Section 24: Data-driven defs.
 */

export const BUILDINGS = {
  lumberjack: { id: 'lumberjack', name: 'Lumber', icon: 'axe', cost: { gold: 20 }, desc: '+10 Wood. +2 per adjacent Lumberjack.' },
  farm: { id: 'farm', name: 'Farm', icon: 'wheat', cost: { wood: 20 }, desc: '+10 Food, +2 Gold. +3 Food per adjacent Farm.' },
  mine: { id: 'mine', name: 'Mine', icon: 'pickaxe', cost: { wood: 50 }, desc: '+5 Stone. +3 per adjacent Mine.' },
  market: { id: 'market', name: 'Market', icon: 'shopping-cart', cost: { wood: 50, stone: 25 }, tech: 'currency', desc: 'Consumes 5 Food for 15 Gold. +3 Gold per adjacent building.' },
  tower: { id: 'tower', name: 'Tower', icon: 'castle', cost: { stone: 50 }, tech: 'ballistics', desc: 'Automatically attacks nearby Goblins.' },
  library: { id: 'library', name: 'Library', icon: 'book-open', cost: { wood: 50 }, tech: 'scholarship', desc: '+8 Science / turn.' }
}

export const UNITS = {
  scout: { id: 'scout', name: 'Scout', icon: 'compass', cost: { gold: 40 }, hp: 10, maxHp: 10, atk: 2, range: 1, mp: 3, sight: 2, desc: 'Fast exploration. Upkeep: -2 Food/turn.' },
  archer: { id: 'archer', name: 'Archer', icon: 'target', cost: { gold: 60 }, tech: 'archery', hp: 8, maxHp: 8, atk: 4, range: 2, mp: 2, sight: 1, desc: 'Ranged attack. Upkeep: -2 Food/turn.' },
  knight: { id: 'knight', name: 'Knight', icon: 'shield', cost: { gold: 100 }, tech: 'steel_working', hp: 20, maxHp: 20, atk: 6, range: 1, mp: 2, sight: 1, desc: 'Heavy frontline. Upkeep: -2 Food/turn.' },
  goblin: { id: 'goblin', name: 'Goblin', icon: 'skull', cost: {}, hp: 6, maxHp: 6, atk: 3, range: 1, mp: 2, sight: 1, desc: 'Enemy raider.' }
}

export const TECH_TREE = {
  archery: { name: 'Archery', cost: 25, unlocks: ['archer'], requires: [] },
  steel_working: { name: 'Steel Working', cost: 55, unlocks: ['knight'], requires: [] },
  currency: { name: 'Currency', cost: 35, unlocks: ['market'], requires: [] },
  ballistics: { name: 'Ballistics', cost: 70, unlocks: ['tower'], requires: ['archery'] },
  scholarship: { name: 'Scholarship', cost: 15, unlocks: ['library'], requires: [] }
}

export function formatCost(costObj) {
  const parts = []
  if (costObj.gold) parts.push(`${costObj.gold} G`)
  if (costObj.wood) parts.push(`${costObj.wood} W`)
  if (costObj.stone) parts.push(`${costObj.stone} S`)
  return parts.join(' ')
}
