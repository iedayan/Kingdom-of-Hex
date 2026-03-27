import { log } from '../../core/logging/gameConsole.js'
import { Sounds } from '../../core/audio/Sounds.js'
import { createRng, hashSeed } from '../../SeededRandom.js'
import { CAPITAL_CUBE_KEY } from '../../game/goals.js'

/**
 * World Event System - Randomized narrative choices.
 * Fulfills GDD Section 18.
 */

export const WORLD_EVENTS = [
  {
    id: 'merchant',
    title: 'Wandering Merchant',
    text: 'A traveler from the distant East arrives with a caravan of rare spices and grains.',
    options: [
      {
        label: 'Buy Provisions (50 Gold)',
        desc: 'Gain 150 Food.',
        req: (gs) => gs.resources.gold >= 50,
        act: (gs) => {
          gs.resources.gold -= 50
          gs.resources.food += 150
          log('[EVENT] Merchant: Provisions secured.')
        }
      },
      {
        label: 'Hire a Guard (100 Gold)',
        desc: 'Recruit a veteran Knight instantly.',
        req: (gs) => gs.resources.gold >= 100,
        act: (gs) => {
          gs.resources.gold -= 100
          gs.spawnUnit('0,0,0', 'knight', 'player')
          log('[EVENT] Merchant: A veteran joins your cause.')
        }
      }
    ]
  },
  {
    id: 'drought',
    title: 'Year of Dust',
    text: 'The rains have failed. The soil turns to sand, and your silos sit empty.',
    options: [
      {
        label: 'Ration Heavily',
        desc: 'Lose 50 Food, units take 2 damage.',
        act: (gs) => {
          gs.resources.food = Math.max(0, gs.resources.food - 50)
          for (const obj of gs.objects.values()) {
            if (obj.owner === 'player' && obj.hp) obj.hp -= 2
          }
          log('[EVENT] Drought: Survival comes at a price.')
        }
      },
      {
        label: 'Perform a Ritual (50 Science)',
        desc: 'Summon rain. No penalties.',
        req: (gs) => gs.resources.science >= 50,
        act: (gs) => {
          gs.resources.science -= 50
          log('[EVENT] Drought: The scholars find a way.')
        }
      }
    ]
  }
  ,
  {
    id: 'scholar_debate',
    title: 'Scholars in Dispute',
    text: 'Two academies compete for your patronage.',
    options: [
      { label: 'Fund Theory', desc: '+45 Science', req: (gs) => gs.resources.gold >= 40, act: (gs) => { gs.resources.gold -= 40; gs.resources.science += 45 } },
      { label: 'Fund Engineering', desc: '+40 Stone, +20 Wood', req: (gs) => gs.resources.gold >= 40, act: (gs) => { gs.resources.gold -= 40; gs.resources.stone += 40; gs.resources.wood += 20 } },
    ],
  },
  {
    id: 'bandit_raid',
    title: 'Bandit Raid',
    text: 'Bandits strike your outer stores at night.',
    options: [
      { label: 'Pursue Them', desc: 'Gain 35 Gold, lose 1 random player unit HP.', act: (gs) => { gs.resources.gold += 35; for (const o of gs.objects.values()) { if (o.owner === 'player' && o.hp) { o.hp = Math.max(1, o.hp - 1); break } } } },
      { label: 'Fortify Stores', desc: 'Lose 20 Gold, avoid further loss.', act: (gs) => { gs.resources.gold = Math.max(0, gs.resources.gold - 20) } },
    ],
  },
  {
    id: 'harvest_blessing',
    title: 'Harvest Blessing',
    text: 'A mild season promises abundance.',
    options: [
      { label: 'Store Grain', desc: '+90 Food', act: (gs) => { gs.resources.food += 90 } },
      { label: 'Sell Surplus', desc: '+60 Gold, +20 Food', act: (gs) => { gs.resources.gold += 60; gs.resources.food += 20 } },
    ],
  },
  {
    id: 'ore_vein',
    title: 'Rich Ore Vein',
    text: 'Surveyors report a rich vein near your borders.',
    options: [
      { label: 'Exploit Quickly', desc: '+75 Stone, -25 Food', act: (gs) => { gs.resources.stone += 75; gs.resources.food = Math.max(0, gs.resources.food - 25) } },
      { label: 'Survey Carefully', desc: '+35 Stone, +25 Science', act: (gs) => { gs.resources.stone += 35; gs.resources.science += 25 } },
    ],
  },
  {
    id: 'refugees',
    title: 'Refugee Caravan',
    text: 'Displaced villagers ask for shelter inside your borders.',
    options: [
      { label: 'Grant Shelter', desc: '+35 Wood, -35 Food, +20 Science', act: (gs) => { gs.resources.wood += 35; gs.resources.food = Math.max(0, gs.resources.food - 35); gs.resources.science += 20 } },
      { label: 'Turn Them Away', desc: '+40 Gold, -10 Reputation (flavor)', act: (gs) => { gs.resources.gold += 40 } },
    ],
  },
  {
    id: 'supply_cache',
    title: 'Forgotten Supply Cache',
    text: 'Scouts discover an abandoned military cache.',
    options: [
      { label: 'Arm the Barracks', desc: 'Spawn a Scout and +20 Gold', act: (gs) => { gs.spawnUnit('0,0,0', 'scout', 'player'); gs.resources.gold += 20 } },
      { label: 'Scrap for Parts', desc: '+45 Wood, +25 Stone', act: (gs) => { gs.resources.wood += 45; gs.resources.stone += 25 } },
    ],
  },
  {
    id: 'sabotage',
    title: 'Sabotage in the Workshops',
    text: 'Someone has tampered with your supply chains.',
    options: [
      { label: 'Investigate', desc: '-20 Gold, +30 Science', act: (gs) => { gs.resources.gold = Math.max(0, gs.resources.gold - 20); gs.resources.science += 30 } },
      { label: 'Replace Equipment', desc: '-30 Wood, +40 Gold', act: (gs) => { gs.resources.wood = Math.max(0, gs.resources.wood - 30); gs.resources.gold += 40 } },
    ],
  },
  {
    id: 'ancient_tablet',
    title: 'Ancient Tablet',
    text: 'A cracked stone tablet reveals lost methods.',
    options: [
      { label: 'Translate Rituals', desc: '+55 Science', act: (gs) => { gs.resources.science += 55 } },
      { label: 'Sell to Collectors', desc: '+85 Gold', act: (gs) => { gs.resources.gold += 85 } },
    ],
  },
  {
    id: 'festival',
    title: 'Festival of Embers',
    text: 'A public festival lifts morale but strains supplies.',
    options: [
      { label: 'Sponsor Festival', desc: '-40 Food, +70 Gold', act: (gs) => { gs.resources.food = Math.max(0, gs.resources.food - 40); gs.resources.gold += 70 } },
      { label: 'Keep Reserves', desc: '+30 Food, +15 Science', act: (gs) => { gs.resources.food += 30; gs.resources.science += 15 } },
    ],
  },
  {
    id: 'frontier_engineers',
    title: 'Frontier Engineers',
    text: 'A guild of engineers offers rapid fortifications for a steep fee.',
    options: [
      {
        label: 'Hire Them',
        desc: '-80 Gold, +120 Stone, +20 Wood',
        req: (gs) => gs.resources.gold >= 80,
        act: (gs) => {
          gs.resources.gold -= 80
          gs.resources.stone += 120
          gs.resources.wood += 20
          log('[EVENT] Engineers: frontier fortifications established.')
        },
      },
      {
        label: 'Take the Blueprints',
        desc: '+40 Science, +25 Wood',
        act: (gs) => {
          gs.resources.science += 40
          gs.resources.wood += 25
          log('[EVENT] Engineers: knowledge banked for later.')
        },
      },
    ],
  },
  {
    id: 'signal_fires',
    title: 'Signal Fires',
    text: 'Hilltop watchmen offer to extend the beacon network across the frontier.',
    options: [
      {
        label: 'Raise the Beacons',
        desc: 'Reveal and claim a wider border ring.',
        act: (gs) => {
          gs.claimRadius(CAPITAL_CUBE_KEY, 4)
          gs.revealRadius(CAPITAL_CUBE_KEY, 4)
          log('[EVENT] Signal Fires: the frontier is revealed.')
        },
      },
      {
        label: 'Chart Safe Roads',
        desc: '+55 Science, +25 Wood',
        act: (gs) => {
          gs.resources.science += 55
          gs.resources.wood += 25
          log('[EVENT] Signal Fires: scholars map the frontier.')
        },
      },
    ],
  },
  {
    id: 'granary_accord',
    title: 'Granary Accord',
    text: 'Village elders propose a realm-wide grain compact to blunt the next lean season.',
    options: [
      {
        label: 'Fund Granaries',
        desc: '+20 Food now, Farms yield more food for the rest of the run.',
        req: (gs) => gs.resources.gold >= 30,
        act: (gs) => {
          gs.resources.gold -= 30
          gs.resources.food += 20
          gs.runRules.foodYieldMultiplier = (gs.runRules.foodYieldMultiplier || 1) + 0.15
          log('[EVENT] Granary Accord: farm output rises.')
        },
      },
      {
        label: 'Privatize Surplus',
        desc: 'Farms gain +1 Gold, +35 Food',
        act: (gs) => {
          gs.runRules.farmGoldBonus = (gs.runRules.farmGoldBonus || 0) + 1
          gs.resources.food += 35
          log('[EVENT] Granary Accord: grain now feeds the treasury.')
        },
      },
    ],
  },
  {
    id: 'war_foundry',
    title: 'War Foundry',
    text: 'Master smiths from the interior arrive with experimental armor and siege fittings.',
    options: [
      {
        label: 'Commission Weapons',
        desc: '+35 progress to current research or +35 Science if idle.',
        act: (gs) => {
          if (gs.currentResearch && gs.techTree[gs.currentResearch]) {
            const tech = gs.techTree[gs.currentResearch]
            tech.progress = Math.min(tech.cost, tech.progress + 35)
          } else {
            gs.resources.science += 35
          }
          gs.resources.stone += 20
          log('[EVENT] War Foundry: research momentum accelerates.')
        },
      },
      {
        label: 'Cast Tower Bolts',
        desc: '+70 Stone, +30 Wood',
        act: (gs) => {
          gs.resources.stone += 70
          gs.resources.wood += 30
          log('[EVENT] War Foundry: siege stores replenished.')
        },
      },
    ],
  },
]

export function pickWorldEvent(gs) {
  const recent = gs._recentEventIds || []
  const pool = WORLD_EVENTS.filter((event) => !recent.includes(event.id))
  const source = pool.length > 0 ? pool : WORLD_EVENTS
  const seed = hashSeed(gs.seed ?? 0, 'world-event', gs.turn, recent.join(','))
  const rng = createRng(seed)
  return source[Math.floor(rng() * source.length)]
}

export function tryResolveWorldEvent(gs, app) {
  // Trigger event every 10 turns
  if (gs.turn > 1 && gs.turn % 10 === 0) {
    const recent = gs._recentEventIds || []
    const event = pickWorldEvent(gs)
    gs._recentEventIds = [...recent, event.id].slice(-3)
    gs._lastWorldEventId = event.id
    app.showEventModal(event)
  }
}
