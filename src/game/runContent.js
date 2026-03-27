import { random as seededRandom } from '../SeededRandom.js'

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

export function pickEnemyVariantForWave(turn) {
  if (turn < 13) return 'goblin'
  const roll = seededRandom()
  if (turn >= 24) {
    if (roll < 0.35) return 'goblin_brute'
    if (roll < 0.7) return 'goblin_slinger'
    return 'goblin_raider'
  }
  if (roll < 0.25) return 'goblin_raider'
  if (roll < 0.4) return 'goblin_slinger'
  return 'goblin'
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
