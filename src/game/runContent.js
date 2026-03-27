import { createRng, hashSeed } from '../SeededRandom.js'

export const RUN_MODIFIERS = [
  {
    id: 'guild_compact',
    name: 'Guild Compact',
    desc: 'A mercantile realm with stronger farms and richer early coffers.',
    flavor: 'Trade first, then buy your way through the crisis.',
    apply(session) {
      session.resources.gold += 60
      session.runRules.farmGoldBonus = 2
      session.runRules.marketGoldBonus = 4
    },
  },
  {
    id: 'frontier_march',
    name: 'Frontier March',
    desc: 'A fortified border realm with stronger defenses and harsher pressure.',
    flavor: 'Stone, towers, and hard borders define the campaign.',
    apply(session) {
      session.resources.gold += 30
      session.resources.wood += 40
      session.resources.stone += 40
      session.runRules.harsherRaids = true
      session.techTree.ballistics.progress += 20
    },
  },
  {
    id: 'scholar_court',
    name: 'Scholar Court',
    desc: 'A learned kingdom that reaches late-game tools faster, but runs leaner.',
    flavor: 'Knowledge accelerates, but every field matters.',
    apply(session) {
      session.runRules.sciencePerTurnBonus = 3
      session.runRules.foodYieldMultiplier = 0.85
      session.techTree.scholarship.progress += 10
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
  {
    id: 'warlord-host',
    name: 'Warlord Host',
    flavor: 'A warlord leads a disciplined late-wave push.',
    minTurn: 30,
    maxTurn: 99,
    weight: 0.75,
    units: ['goblin_warlord', 'goblin_brute', 'goblin_slinger', 'goblin_raider'],
    boss: 'goblin_warlord',
  },
  {
    id: 'crownbreaker-siege',
    name: 'Crownbreaker Siege',
    flavor: 'The warlord returns with a tower-breaking host.',
    minTurn: 40,
    maxTurn: 99,
    weight: 0.55,
    units: ['goblin_warlord', 'goblin_brute', 'goblin_brute', 'goblin_slinger', 'goblin_raider'],
    boss: 'goblin_warlord',
  },
]

export const DECREES = [
  {
    id: 'granary_edict',
    name: 'Granary Edict',
    desc: '+25 Food now. Farms yield more food for the rest of the run.',
    apply(session) {
      session.resources.food += 25
      session.runRules.foodYieldMultiplier = (session.runRules.foodYieldMultiplier || 1) + 0.15
    },
  },
  {
    id: 'merchant_guilds',
    name: 'Merchant Guilds',
    desc: '+40 Gold now. Markets gain +5 Gold per conversion.',
    apply(session) {
      session.resources.gold += 40
      session.runRules.marketGoldBonus = (session.runRules.marketGoldBonus || 0) + 5
    },
  },
  {
    id: 'watcher_beacons',
    name: 'Watcher Beacons',
    desc: '+35 Stone and a wider revealed frontier.',
    apply(session) {
      session.resources.stone += 35
      session.claimRadius('0,0,0', 4)
      session.revealRadius('0,0,0', 4)
    },
  },
  {
    id: 'scholastic_grant',
    name: 'Scholastic Grant',
    desc: '+30 Science now. +2 Science each turn.',
    apply(session) {
      session.resources.science += 30
      session.runRules.sciencePerTurnBonus = (session.runRules.sciencePerTurnBonus || 0) + 2
    },
  },
  {
    id: 'martial_code',
    name: 'Martial Code',
    desc: '+20 Stone. Player units deal more damage for the rest of the run.',
    apply(session) {
      session.resources.stone += 20
      session.runRules.playerCombatMultiplier = (session.runRules.playerCombatMultiplier || 1) + 0.1
      session.refreshPlayerCombatBonuses?.()
    },
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

  if (turn === 30) {
    const encounter = ENEMY_WAVE_ARCHETYPES.find((wave) => wave.id === 'warlord-host')
    return { ...encounter, units: [...encounter.units], encounter: 'boss' }
  }
  if (turn >= 40 && (turn - 40) % 10 === 0) {
    const encounter = ENEMY_WAVE_ARCHETYPES.find((wave) => wave.id === 'crownbreaker-siege')
    return { ...encounter, units: [...encounter.units], encounter: 'boss' }
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
    boss: archetype.boss || null,
    encounter: archetype.boss ? 'boss' : 'raid',
  }
}

export function describeEnemyWavePlan(plan) {
  if (!plan || !plan.units || plan.units.length === 0) return 'No raid forecast'
  const labels = plan.units.map((unit) => unit.replace('goblin_', '').replace('goblin', 'goblin').replace(/_/g, ' '))
  const prefix = plan.boss ? 'Boss Raid' : plan.name
  return `${prefix}: ${labels.join(', ')}`
}

export function pickDecreeChoices(turn, seed = 0, count = 3) {
  const rng = createRng(hashSeed(seed, 'decrees', turn))
  const pool = [...DECREES]
  const picked = []
  while (pool.length > 0 && picked.length < count) {
    const idx = Math.floor(rng() * pool.length)
    picked.push(pool.splice(idx, 1)[0])
  }
  return picked
}

export function buildDecreeEvent(turn, seed = 0) {
  const options = pickDecreeChoices(turn, seed).map((decree) => ({
    decreeId: decree.id,
    label: decree.name,
    desc: decree.desc,
    act: (session) => decree.apply(session),
  }))

  return {
    id: `decree-${turn}`,
    title: turn <= 12 ? 'Royal Decree' : 'High Council Edict',
    text: turn <= 12
      ? 'The court demands a defining policy. Choose the law that will shape the rest of the campaign.'
      : 'The late court convenes. One lasting decree can still reshape the war.'
      ,
    options,
  }
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
        return session.turn >= 12 && [...session.objects.values()].some((o) => o.owner === 'player' && o.type === 'scout')
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
    {
      id: 'market_charter',
      title: 'Market Charter',
      flavor: 'Create a true district of coin and knowledge before the war economy hardens.',
      deadline: 24,
      reward: { gold: 90, science: 45 },
      completed: false,
      failed: false,
      check(session) {
        const marketCount = [...session.objects.values()].filter((o) => o.owner === 'player' && o.type === 'market').length
        const libraryCount = [...session.objects.values()].filter((o) => o.owner === 'player' && o.type === 'library').length
        return marketCount >= 1 && libraryCount >= 1
      },
    },
    {
      id: 'standing_host',
      title: 'Standing Host',
      flavor: 'Field a disciplined force before the warlord banners rise.',
      deadline: 22,
      reward: { gold: 70, stone: 50, food: 40 },
      completed: false,
      failed: false,
      check(session) {
        const hasKnight = [...session.objects.values()].some((o) => o.owner === 'player' && o.type === 'knight')
        const hasArcher = [...session.objects.values()].some((o) => o.owner === 'player' && o.type === 'archer')
        return hasKnight && hasArcher
      },
    },
    {
      id: 'breadbasket',
      title: 'Breadbasket',
      flavor: 'Grow enough grain that the realm can support a real army.',
      deadline: 14,
      reward: { food: 120, gold: 35 },
      completed: false,
      failed: false,
      check(session) {
        const farms = [...session.objects.values()].filter((o) => o.owner === 'player' && o.type === 'farm').length
        return farms >= 3
      },
    },
  ]
}
