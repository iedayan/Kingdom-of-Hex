# Kingdom of Hex - Itch.io Page Content

## Title
Kingdom of Hex

## Short Description
Turn-based strategy roguelike. Build your kingdom, deploy units, defend against goblin hordes, and accumulate 1000 gold to claim victory.

## Full Description

```
Build. Defend. Survive.

Kingdom of Hex is a turn-based strategy roguelike where every run takes place on a unique procedurally-generated hex world.

## HOW TO PLAY

◆ Build your economy - Place Lumberjacks, Farms, and Mines to generate resources
◆ Deploy units - Train Scouts, Archers, and Knights to defend your realm
◆ End turn - Collect income, trigger enemy waves, and watch your back
◆ Survive - Goblin raids come every 5 turns. The horde never sleeps.
◆ Win - Accumulate 1000 gold before turn 50

## FEATURES

▸ Procedural Maps - Every run generates a unique hex world using Wave Function Collapse
▸ Enemy Intent System - See exactly what enemies plan to do before they act
▸ Meta-Progression - Earn Legacy Points to unlock permanent upgrades
▸ Tech Tree - Research technologies to unlock advanced buildings and units
▸ Resource Management - Balance gold, wood, food, stone, and science

## CONTROLS

1-6     Select buildings
U/A/K   Deploy units
Space   End turn
Tab     Cycle units
Esc     Cancel selection

## TIPS

• Scouts have high movement - use them to explore and find optimal building spots
• Markets convert food to gold - essential for late-game income
• Towers auto-attack adjacent enemies - place them at chokepoints
• Research tech early to unlock powerful units

## TECHNICAL

Requires WebGPU (Chrome 113+, Edge 113+). If unavailable, try an updated browser.

Built with Three.js and WebGPU. Procedural terrain powered by Wave Function Collapse.
```

## Tags (copy all)
```
turn-based
strategy
roguelike
hexagonal
medieval
fantasy
tower-defense
resource-management
webgpu
html5
browser-game
```

## Cover Image
Recommended: 630x500px screenshot or artwork showing:
- Hex grid terrain
- UI elements visible
- Clean, appealing composition

## Screenshots
Take 4-6 screenshots showing:
1. Gameplay overview (full HUD visible)
2. Combat/attack
3. Building placement
4. Meta-progression screen
5. Win/lose screen

## Pricing
**Free** (recommended for v1)

## Download Settings
- **Upload files**: ZIP the `dist` folder contents
- **Embed options**: 
  - Width: 100%
  - Height: "Fit to window" or 720px
- **Background**: Black

## Suggested Launch Checklist
- [ ] Create Itch.io account
- [ ] Create game page with above content
- [ ] Upload cover image
- [ ] Add 4-6 screenshots
- [ ] Add all tags
- [ ] Set to "Free"
- [ ] Upload zip from `dist/` folder
- [ ] Test embedded version
- [ ] Set "Publish" when ready
- [ ] Share on Twitter/Reddit/Discord

## Pre-Launch QA Blockers (PearceStarr Playtest)

### P0 - Must Fix Before Public Launch
- [ ] **Enemy control exploit fixed**: player can no longer select or move enemy goblins.
- [ ] **Enemy movement validation added**: enemy units cannot be dragged into ocean or invalid tiles.
- [ ] **Combat loop verified**: at least one test run requires real combat (no bypass exploit possible).
- [ ] **Fullscreen start rendering fixed**: launching directly in fullscreen shows full hex map correctly.
- [ ] **Camera input in fullscreen verified**: zoom and pan function on first load without reload/workaround.

### P0 - Economy Progression Gate
- [ ] **Starting economy unblocked**: player can generate gold in first 3-5 turns.
- [ ] **Farm gold behavior verified**: farm output matches design and is visible in UI.
- [ ] **Mine placement fixed**: valid mine tiles always exist on generated maps (or fallback map rule added).
- [ ] **Market progression fixed**: market cost and unlock order no longer create dead-end economy.
- [ ] **Military timing balanced**: player can field first defensive unit before first meaningful goblin pressure.

### P1 - Onboarding and Clarity
- [ ] Add short interactive tutorial for: building placement, income, research, and unit combat.
- [ ] Add clear placement rule hints ("why invalid" + tile requirements).
- [ ] Add obvious ownership visuals so player units vs enemies are unmistakable.
- [ ] Add reliable deselect/cancel behavior (`Esc`) and prevent accidental move-on-select.
- [ ] Clarify stacked unit presentation (count, order, or selector UI).
- [ ] Replace/augment resource abbreviations with labels or icons (`Stone` vs `Science` confusion).

### P1 - UX and Fairness
- [ ] Remove forced camera rotation during enemy turns, or add toggle.
- [ ] Add manual camera rotation controls if dynamic camera remains.
- [ ] Rebalance repeated disaster events (avoid same unavoidable penalty loops).
- [ ] Add cost/tradeoff to expansion reveal, or reveal by default.

### Verification Pass (Required)
- [ ] Fresh run in fullscreen from first launch works with no gray map.
- [ ] Fresh run reaches stable economy and first military unit without exploits.
- [ ] Fresh run cannot move enemy units under any input path.
- [ ] At least one external playtester confirms clarity of controls and early progression.
