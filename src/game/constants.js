/**
 * Game Constants - Single source of truth for all magic numbers and game tuning.
 * 
 * Organized by domain to make balance changes easy to find and modify.
 */

export const GAME = {
  STARTING_GOLD: 150,
  STARTING_WOOD: 75,
  STARTING_FOOD: 75,
  STARTING_STONE: 25,
  STARTING_SCIENCE: 0,
  BASE_SCIENCE_PER_TURN: 2,
  UNIT_FOOD_UPKEEP: 2,
}

export const VICTORY = {
  GOLD_GOAL: 1000,
  MAX_TURNS: 50,
}

export const UNITS = {
  scout: {
    hp: 10,
    maxHp: 10,
    atk: 2,
    range: 1,
    mp: 3,
    cost: 40,
    sight: 2,
  },
  archer: {
    hp: 8,
    maxHp: 8,
    atk: 4,
    range: 2,
    mp: 2,
    cost: 60,
    sight: 1,
  },
  knight: {
    hp: 20,
    maxHp: 20,
    atk: 6,
    range: 1,
    mp: 2,
    cost: 100,
    sight: 1,
  },
  goblin: {
    hp: 6,
    maxHp: 6,
    atk: 3,
    range: 1,
    mp: 1,
    cost: 0,
    sight: 1,
  },
  goblin_raider: {
    hp: 5,
    maxHp: 5,
    atk: 3,
    range: 1,
    mp: 2,
    cost: 0,
    sight: 1,
  },
  goblin_brute: {
    hp: 10,
    maxHp: 10,
    atk: 4,
    range: 1,
    mp: 1,
    cost: 0,
    sight: 1,
  },
  goblin_slinger: {
    hp: 5,
    maxHp: 5,
    atk: 2,
    range: 2,
    mp: 1,
    cost: 0,
    sight: 1,
  },
  goblin_warlord: {
    hp: 16,
    maxHp: 16,
    atk: 6,
    range: 1,
    mp: 1,
    cost: 0,
    sight: 1,
  },
}

export const COMBAT = {
  DAMAGE_VARIANCE: 0.2,
  XP_ON_ATTACK: 2,
  XP_ON_KILL: 5,
  RANK_THRESHOLDS: [0, 10, 25, 50],
  HP_PER_RANK: 2,
  ATK_PER_RANK: 1,
  HIGH_GROUND_BONUS: 1,
  FORTIFIED_TARGET_REDUCTION: 1,
  ATTACK_BONUSES: {
    scout: {
      goblin_slinger: 1,
      goblin_raider: 1,
      tower: -1,
    },
    archer: {
      scout: 1,
      archer: 1,
      goblin: 1,
      goblin_raider: 2,
      goblin_slinger: 2,
      goblin_brute: -1,
      goblin_warlord: 2,
      knight: -1,
      tower: -1,
    },
    knight: {
      scout: 1,
      archer: 1,
      goblin: 1,
      goblin_brute: 2,
      goblin_raider: 2,
      goblin_slinger: 2,
      goblin_warlord: 2,
      tower: -1,
    },
    tower: {
      goblin: 1,
      goblin_raider: 1,
      goblin_slinger: 2,
      goblin_warlord: 1,
    },
    goblin_raider: {
      scout: 1,
      archer: 1,
      farm: 2,
      lumberjack: 2,
      market: 1,
      library: 1,
    },
    goblin_brute: {
      knight: 1,
      mine: 2,
      market: 2,
      library: 2,
      farm: 2,
      lumberjack: 2,
      tower: 3,
    },
    goblin_slinger: {
      scout: 2,
      archer: 1,
      farm: 1,
      lumberjack: 1,
    },
    goblin_warlord: {
      knight: 2,
      archer: 2,
      scout: 2,
      market: 2,
      library: 2,
      tower: 2,
    },
  },
  TARGET_PRIORITIES: {
    tower: 6,
    archer: 5,
    knight: 4,
    scout: 3,
    market: 3,
    library: 3,
    mine: 2,
    lumberjack: 2,
    farm: 2,
  },
  BOUNTY_BY_TYPE: {
    goblin: 18,
    goblin_raider: 22,
    goblin_slinger: 24,
    goblin_brute: 32,
    goblin_warlord: 48,
  },
}

export const ECONOMY = {
  LUMBERJACK_YIELD: 10,
  LUMBERJACK_BONUS_PER_ADJACENT: 2,
  FARM_YIELD: 10,
  FARM_GOLD_YIELD: 2,
  FARM_BONUS_PER_ADJACENT: 3,
  MINE_YIELD: 5,
  MINE_BONUS_PER_ADJACENT: 3,
  LIBRARY_YIELD: 8,
  MARKET_GOLD_BASE: 15,
  MARKET_GOLD_PER_ADJACENT: 3,
  MARKET_FOOD_COST: 5,
  MARKET_FOOD_THRESHOLD: 5,
}

export const BIOME = {
  MODIFIERS: {
    temperate: 1.0,
    winter: 0.7,
    wasteland: 0.5,
  },
}

export const ENEMY = {
  FIRST_WAVE_TURN: 8,
  WAVE_PERIOD: 5,
  SPAWN_DISTANCE_MIN: 3,
  SPAWN_DISTANCE_MAX: 7,
}

export const META = {
  LP_WIN_FORMULA: (gold, science) => Math.floor(gold / 10) + science,
  LP_LOSE_FORMULA: (gold, science) => Math.floor(gold / 20) + Math.floor(science / 2),
}

export const VISION = {
  CAPITAL_CLAIM_RADIUS: 3,
}

export default {
  GAME,
  VICTORY,
  UNITS,
  COMBAT,
  ECONOMY,
  BIOME,
  ENEMY,
  META,
  VISION,
}
