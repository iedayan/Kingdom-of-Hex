import { createRng, hashSeed } from '../SeededRandom.js'

export const RUN_MODIFIERS = [
  {
    id: 'agrarian_compromise',
    name: 'Agrarian Compromise',
    desc: 'Farms yield more gold, but your military starts weaker.',
    apply(session) {
      session.runRules.farmGoldBonus = 2
      session.runRules.playerCombatMultiplier = 0.85
    },
  },
  {
    id: 'war_chest',
    name: 'War Chest',
    desc: 'Start with more resources, but raids are harsher.',
    apply(session) {
      session.resources.gold += 80
      session.resources.wood += 40
      session.resources.stone += 20
      session.runRules.harsherRaids = true
    },
  },
  {
    id: 'scholar_levy',
    name: 'Scholar Levy',
    desc: 'Faster research, but food production is lower.',
    apply(session) {
      session.runRules.sciencePerTurnBonus = 2
      session.runRules.foodYieldMultiplier = 0.85
    },
  },
]

export const ENEMY_WAVE_ARCHETYPES = [
  {
    id: 'skirmishers',
    name: 'Skirmishers',
    flavor: 'Light infantry probing the frontier.',
    minTurn: 1,
    maxTurn: 12,
    weight: 1.4,
    units: ['goblin', 'goblin'],
  },
  {
    id: 'raiding-party',
    name: 'Raiding Party',
    flavor: 'Fast raiders testing soft structures.',
    minTurn: 10,
    maxTurn: 99,
    weight: 1.2,
    units: ['goblin_raider', 'goblin', 'goblin'],
  },
  {
    id: 'hunter-volley',
    name: 'Hunter Volley',
    flavor: 'Slingers screen the approach.',
    minTurn: 12,
    maxTurn: 99,
    weight: 1,
    units: ['goblin_slinger', 'goblin', 'goblin_raider'],
  },
  {
    id: 'brute-push',
    name: 'Brute Push',
    flavor: 'Heavy goblins smash through defenses.',
    minTurn: 16,
    maxTurn: 99,
    weight: 1,
    units: ['goblin_brute', 'goblin', 'goblin_raider'],
  },
  {
    id: 'siege-pack',
    name: 'Siege Pack',
    flavor: 'Brutes and slingers press towers together.',
    minTurn: 22,
    maxTurn: 99,
    weight: 0.9,
    units: ['goblin_brute', 'goblin_slinger', 'goblin_raider', 'goblin'],
  },
]

function pickWaveArchetype(turn, rng) {
  const pool = ENEMY_WAVE_ARCHETYPES.filter(wave => turn >= wave.minTurn && turn <= wave.maxTurn)
  const total = pool.reduce((sum, wave) => sum + wave.weight, 0)
  let cursor = rng() * total

  for (const wave of pool) {
    cursor -= wave.weight
    if (cursor <= 0) return wave
  }

  return pool[pool.length - 1] ?? ENEMY_WAVE_ARCHETYPES[0]
}

export function pickEnemyVariantForWave(turn) {
  const plan = buildEnemyWavePlan(turn, { seed: turn })
  return plan.units[0] ?? 'goblin'
}

export function buildEnemyWavePlan(turn, { harsherRaids = false, seed = 0 } = {}) {
  if (turn < 1) {
    return { id: 'none', name: 'None', flavor: '', units: [] }
  }

  const rng = createRng(hashSeed(seed, 'enemy-wave', turn, harsherRaids ? 1 : 0))
  const archetype = pickWaveArchetype(turn, rng)
  const units = [...archetype.units]

  if (turn < 12) {
    units.splice(1)
  } else if (turn < 18) {
    units.splice(2)
  } else if (turn >= 28 && rng() < 0.45) {
    units.push(rng() < 0.5 ? 'goblin_brute' : 'goblin_slinger')
  }

  if (harsherRaids && units.length < 5) {
    const reinforcements = ['goblin_raider', 'goblin_slinger', 'goblin']
    units.push(reinforcements[Math.floor(rng() * reinforcements.length)])
  }

  return {
    id: archetype.id,
    name: archetype.name,
    flavor: archetype.flavor,
    units,
  }
}

export function describeEnemyWavePlan(plan) {
  if (!plan || !plan.units || plan.units.length === 0) return 'No raid forecast'
  const labels = plan.units.map((unit) => unit.replace('goblin_', '').replace('goblin', 'goblin').replace(/_/g, ' '))
  return `${plan.name}: ${labels.join(', ')}`
}

export function defineOptionalObjectives() {
  return [
    {
      id: 'hold_choke',
      title: 'Hold the Choke',
      flavor: 'Fortify the pass with towers before the horde swells.',
      deadline: 20,
      reward: { gold: 60, stone: 30 },
      completed: false,
      failed: false,
      check(session) {
        const towers = [...session.objects.values()].filter((o) => o.owner === 'player' && o.type === 'tower').length
        return towers >= 2
      },
    },
    {
      id: 'clear_nest',
      title: 'Clear the Nest',
      flavor: 'Break the raiders early and keep momentum.',
      deadline: 15,
      reward: { gold: 120 },
      completed: false,
      failed: false,
      check(session) {
        return session.runStats.enemyKills >= 8
      },
    },
    {
      id: 'protect_caravan',
      title: 'Protect the Caravan',
      flavor: 'Keep a scout alive through the escort window.',
      deadline: 18,
      reward: { science: 40, food: 80 },
      completed: false,
      failed: false,
      check(session) {
        return [...session.objects.values()].some((o) => o.owner === 'player' && o.type === 'scout')
      },
    },
    {
      id: 'iron_frontier',
      title: 'Iron Frontier',
      flavor: 'Establish a forward industry before late waves begin.',
      deadline: 16,
      reward: { stone: 70, gold: 50 },
      completed: false,
      failed: false,
      check(session) {
        const mines = [...session.objects.values()].filter((o) => o.owner === 'player' && o.type === 'mine').length
        return mines >= 2
      },
    },
  ]
}
